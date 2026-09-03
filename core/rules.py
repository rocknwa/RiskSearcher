"""
core/rules.py — Bytecode-level pattern detection.

Scans deployed bytecode for function selectors and opcode patterns
that indicate user-harm behaviors. No ABI required.
"""

# Known 4-byte selectors for dangerous functions
# Generated from: keccak256("functionName(types)")[0:4] → hex
DANGEROUS_SELECTORS = {
    # Fund control / drain
    "0x947bc65f": "recoverFunds()",
    "0x9e281a98": "rescueTokens(address,uint256)",
    "0xdb006a75": "rescue(uint256)",
    "0xcee2b5ef": "rescueERC20(address,address,uint256)",
    "0x5e8ab3b5": "adminWithdraw(address,uint256)",
    "0x8da5cb5b": "owner()",           # not malicious alone, flag for context
    "0x13af4035": "setOwner(address)",
    "0xf2fde38b": "transferOwnership(address)",

    # Transfer restrictions
    "0x40c10f19": "mint(address,uint256)",
    "0x42966c68": "burn(uint256)",
    "0x9dc29fac": "burn(address,uint256)",
    "0xf5537ede": "burnFrom(address,uint256)",  # admin burn
    "0x44337ea1": "blacklist(address)",
    "0xe4997dc5": "removeFromBlacklist(address)",
    "0x8f9a55a0": "setBlacklist(address,bool)",
    "0x35ba5098": "blockAddress(address)",
    "0x8456cb59": "pause()",
    "0x3f4ba83a": "unpause()",
    "0x5c975abb": "paused()",

    # Honeypot / sell restriction indicators
    "0x7afa1eed": "setCooldown(bool)",
    "0x0498c0c1": "setMaxTxAmount(uint256)",
    "0xc9567bf9": "openTrading()",         # common in rug-pull tokens
    "0x18160ddd": "totalSupply()",         # alone safe, context matters
    "0x23b872dd": "transferFrom(address,address,uint256)",

    # Proxy / upgrade
    "0x3659cfe6": "upgradeTo(address)",
    "0x4f1ef286": "upgradeToAndCall(address,bytes)",
    "0x52d1902d": "proxiableUUID()",
    "0x715018a6": "renounceOwnership()",

    # Fee manipulation
    "0x4a62bb65": "swapEnabled()",
    "0xa9059cbb": "transfer(address,uint256)",
    "0x70a08231": "balanceOf(address)",
}

# Selectors that strongly indicate malicious intent when combined
HIGH_RISK_SELECTORS = {
    "0x947bc65f",  # recoverFunds
    "0x9e281a98",  # rescueTokens
    "0xdb006a75",  # rescue
    "0xcee2b5ef",  # rescueERC20
    "0x5e8ab3b5",  # adminWithdraw
    "0x44337ea1",  # blacklist
    "0x8f9a55a0",  # setBlacklist
    "0x35ba5098",  # blockAddress
    "0x3659cfe6",  # upgradeTo (unguarded)
    "0x4f1ef286",  # upgradeToAndCall
    "0x40c10f19",  # mint (uncapped)
}

# Opcode signatures in bytecode (as hex substrings)
# SELFDESTRUCT = 0xFF — catastrophic drain
OPCODE_FLAGS = {
    "ff": "SELFDESTRUCT opcode detected — contract can be destroyed draining all ETH",
}


def scan_bytecode(bytecode_hex: str) -> dict:
    """
    Scan bytecode for known dangerous selectors and opcodes.
    Returns detected findings with labels.
    """
    if not bytecode_hex or bytecode_hex == "0x":
        return {"found_selectors": [], "found_opcodes": [], "high_risk_count": 0}

    # Normalize and remove leading 0x
    raw = bytecode_hex.lower().replace("0x", "")

    # Attempt to strip known CBOR/metadata suffixes (ipfs/bzzr markers)
    def _strip_metadata(hexstr: str) -> str:
        # Common CBOR markers for metadata: a2 64 69 70 66 73 ('a26469706673' -> 'ipfs')
        # or a2 64 62 7a 7a 72 ('a264627a7a72' -> 'bzzr'). If present, cut at that index.
        for marker in ("a26469706673", "a264627a7a72"):
            idx = hexstr.find(marker)
            if idx != -1:
                return hexstr[:idx]
        return hexstr

    code_no_metadata = _strip_metadata(raw)

    # Disassemble: walk byte-by-byte, skipping PUSHn operand bytes so
    # they are not mistaken for opcodes. Produce a list of opcode bytes
    # and their original offsets so we can apply a reachability-ish
    # proximity heuristic for suspicious opcodes.
    def _opcodes_only_with_offsets(hexstr: str):
        try:
            data = bytes.fromhex(hexstr)
        except Exception:
            return [], []

        pc = 0
        op_bytes = []
        offsets = []
        ln = len(data)

        # Walk the bytecode and record only actual opcode bytes.
        # For PUSH1..PUSH32 (0x60..0x7f), skip the declared number
        # of immediate operand bytes so they are not treated as opcodes.
        while pc < ln:
            op = data[pc]
            offsets.append(pc)
            op_bytes.append(op)
            pc += 1
            if 0x60 <= op <= 0x7F:
                push_len = op - 0x5F  # PUSH1 -> 1, PUSH32 -> 32
                # Ensure we don't run past the end
                if pc + push_len > ln:
                    # If malformed/truncated, jump to end
                    pc = ln
                else:
                    pc += push_len

        return op_bytes, offsets

    opcodes_list, opcode_offsets = _opcodes_only_with_offsets(code_no_metadata)

    # Find selectors in the raw code excluding only the trailing metadata.
    found_selectors = []
    for selector, label in DANGEROUS_SELECTORS.items():
        sel = selector.replace("0x", "").lower()
        if sel in code_no_metadata:
            is_high_risk = selector in HIGH_RISK_SELECTORS
            found_selectors.append({
                "selector": selector,
                "label": label,
                "high_risk": is_high_risk,
            })

    # Opcode detection uses the opcode-stream (operands removed)
    found_opcodes = []
    # No positional heuristics: accept opcode matches anywhere once
    # PUSH operand bytes are already skipped by the disassembler.

    for opcode, label in OPCODE_FLAGS.items():
        target = int(opcode, 16)
        # scan the opcode stream by index (safe against hex-boundary substring matches)
        for i, op in enumerate(opcodes_list):
            if op != target:
                continue
            orig_offset = opcode_offsets[i] if i < len(opcode_offsets) else None

            accept = orig_offset is not None

            if accept:
                found_opcodes.append({"opcode": opcode, "label": label})
                break  # only one occurrence per opcode type

    high_risk_count = sum(1 for s in found_selectors if s["high_risk"]) + len(found_opcodes)

    return {
        "found_selectors": found_selectors,
        "found_opcodes": found_opcodes,
        "high_risk_count": high_risk_count,
    }


# Source-level patterns — only applicable when verified source is available
SOURCE_PATTERNS = [
    # Fund control
    (r"\bonlyOwner\b.*\btransfer\b",              "onlyOwner transfer — owner can move funds"),
    (r"\brecoverFunds?\b",                         "recoverFunds function present"),
    (r"\brescue\w*\b",                             "rescue/withdraw function present"),
    (r"\bwithdrawAll\b",                           "withdrawAll — full drain risk"),
    (r"\bemergencyWithdraw\b",                     "emergencyWithdraw — admin drain path"),

    # Blacklist / freeze
    (r"\bblacklist\b|\bisBlacklisted\b",           "blacklist mapping — can block user transfers"),
    (r"\bfrozen\b|\bfreeze\b",                     "freeze mechanism on user balances"),
    (r"\brequire\s*\(\s*!\s*blacklisted",          "require(!blacklisted) transfer gate"),

    # Uncapped mint
    # Match implemented mint functions (with a body). Exclude bare interface signatures
    (r"\bfunction\s+mint\b[^;{]*\{(?:(?!maxSupply).)*\}",        "mint() with no visible maxSupply cap"),
    (r"\b_mint\s*\([^)]*\)\s*;(?!![^}]*maxSupply)|\b_mint\s*\([^)]*\)\s*\{(?:(?!maxSupply).)*\}", "internal _mint call without supply cap check"),

    # Hidden tax / fee manipulation
    (r"\b_taxFee\s*=\s*\d{2,}\b",                 "tax fee set ≥10% in source"),
    (r"\bsetTaxFee\b|\bsetFee\b",                  "dynamic fee setter — tax can be raised to block sells"),
    (r"\bliquidityFee\b.*\bsetLiquidityFee\b",     "liquidity fee with admin setter"),

    # Honeypot indicators
    (r"\brequire\s*\(\s*false\b",                  "require(false) — unconditional revert (honeypot)"),
    (r"\bcanSell\s*==\s*false\b|\b!canSell\b",     "canSell flag — sells can be disabled by admin"),
    (r"\btradingEnabled\b|\btradingOpen\b",        "trading gate — buys work, sells may be blocked"),
    (r"\bcooldown\[",                              "per-address cooldown mapping — sell rate limiting"),

    # SELFDESTRUCT in source
    (r"\bselfdestruct\b|\bsuicide\b",              "selfdestruct() in source — contract and ETH can be destroyed"),

    # Proxy / upgradeability
    (r"\bUUPSUpgradeable\b",                       "UUPS proxy — logic can be replaced by upgrade admin"),
    (r"\bTransparentUpgradeableProxy\b",           "Transparent proxy — admin can silently replace logic"),
    (r"\b_authorizeUpgrade\b",                     "_authorizeUpgrade present — upgrade path exists"),
]

import re as _re


def _remove_interfaces_and_abstracts(text: str) -> str:
    """Remove `interface` and `abstract contract` blocks from a multi-file string.

    This uses a simple brace-matching scanner to avoid accidentally chopping
    other contract bodies. It's conservative but effective for typical
    Etherscan-provided source bundles.
    """
    out = []
    i = 0
    ln = len(text)
    while i < ln:
        # look for 'interface' or 'abstract contract'
        if text[i:i+9].lower().startswith('interface') or text[i:i+16].lower().startswith('abstract contract'):
            # find the next '{'
            start = text.find('{', i)
            if start == -1:
                break
            depth = 1
            j = start + 1
            while j < ln and depth > 0:
                if text[j] == '{':
                    depth += 1
                elif text[j] == '}':
                    depth -= 1
                j += 1
            # skip this block
            i = j
            continue
        out.append(text[i])
        i += 1
    return ''.join(out)


def select_contract_implementation(sources: dict, contract_name: str = None) -> str:
    """Select the most likely implementation file content for `contract_name`.

    If `contract_name` is provided, search files for a concrete `contract`/`library`
    declaration matching the name and return that file's content. If not found,
    fall back to concatenating all files with interface/abstract blocks removed.
    """
    if not sources:
        return ""
    # Try to find a file that declares the contract by name
    if contract_name:
        pat = _re.compile(rf"\b(contract|library|abstract\s+contract)\s+{_re.escape(contract_name)}\b", _re.IGNORECASE)
        for fname, info in sources.items():
            content = info.get('content') if isinstance(info, dict) else info
            if content and pat.search(content):
                return content

    # Fallback: return concatenation of all files with interfaces/abstracts stripped
    joined = "\n\n".join((v.get('content') if isinstance(v, dict) else v) for v in sources.values())
    cleaned = _remove_interfaces_and_abstracts(joined)
    return cleaned


def scan_source(source_input, contract_name: str = None) -> dict:
    """
    Scan verified Solidity source for dangerous patterns using regex.
    Much more precise than bytecode scanning — actual function names,
    modifiers, and logic flow are visible.

    Returns:
      - findings: list of {pattern, label, high_risk}
      - high_risk_count: int
    """
    if not source_input:
        return {"findings": [], "high_risk_count": 0}

    # Accept either a flat source blob or a mapping of sources (filename -> content)
    if isinstance(source_input, dict):
        source_code = select_contract_implementation(source_input, contract_name)
    else:
        source_code = source_input

    HIGH_RISK_SOURCE_LABELS = {
        "selfdestruct() in source — contract and ETH can be destroyed",
        "recoverFunds function present",
        "rescue/withdraw function present",
        "withdrawAll — full drain risk",
        "emergencyWithdraw — admin drain path",
        "blacklist mapping — can block user transfers",
        "require(false) — unconditional revert (honeypot)",
        "canSell flag — sells can be disabled by admin",
        "mint() with no visible maxSupply cap",
    }

    findings = []
    for pattern, label in SOURCE_PATTERNS:
        try:
            if _re.search(pattern, source_code, _re.IGNORECASE | _re.DOTALL):
                findings.append({
                    "pattern": pattern,
                    "label": label,
                    "high_risk": label in HIGH_RISK_SOURCE_LABELS,
                })
        except Exception:
            # On pathological regex failures, skip the pattern
            continue

    high_risk_count = sum(1 for f in findings if f["high_risk"])
    return {"findings": findings, "high_risk_count": high_risk_count}
