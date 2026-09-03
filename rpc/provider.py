"""
rpc/provider.py — Blockchain data fetcher.
Tries Alchemy first, falls back to Infura. Returns raw on-chain context.

Source code: fetched from Etherscan if verified (primary).
Bytecode:    always fetched via RPC as fallback / complement.
"""

import json
import os
import requests
from web3 import Web3


def _extract_etherscan_sources(source: str) -> tuple[str, dict]:
    """Normalize Etherscan source payloads.

    Etherscan may return:
    - a plain Solidity string for single-file contracts
    - a JSON object/string for multi-file verified contracts; sometimes this is
      wrapped one level too deep, requiring a second JSON decode pass.
    """
    if not source or source == "0x":
        return "", {}

    candidate = source.strip()
    seen = set()

    for _ in range(4):
        if not candidate:
            break
        if candidate in seen:
            break
        seen.add(candidate)

        if candidate.startswith('"') and candidate.endswith('"'):
            try:
                decoded = json.loads(candidate)
                if isinstance(decoded, str):
                    candidate = decoded.strip()
                    continue
            except Exception:
                break

        if candidate.startswith("{{") or candidate.startswith("{"):
            try:
                json_candidate = candidate[1:-1] if candidate.startswith("{{") and candidate.endswith("}}") else candidate
                parsed = json.loads(json_candidate)
            except Exception:
                break

            if isinstance(parsed, str):
                candidate = parsed.strip()
                continue

            if isinstance(parsed, dict):
                files = parsed.get("sources") or {}
                if files:
                    contents = []
                    ordered_files = []
                    for file_info in files.values():
                        if isinstance(file_info, dict):
                            ordered_files.append(file_info)
                    for file_info in ordered_files:
                        content = file_info.get("content", "")
                        if isinstance(content, str):
                            contents.append(content)
                    if contents:
                        return "\n\n".join(contents), files

                content = parsed.get("content")
                if isinstance(content, str):
                    return content, {}

                return candidate, {}

        break

    return source.strip(), {}

ETHERSCAN_API = "https://api.etherscan.io/v2/api"

CHAIN_REGISTRY = {
    "ethereum": {"chainid": "1", "alchemy_url": "https://eth-mainnet.g.alchemy.com/v2/{api_key}"},
    "base": {"chainid": "8453", "alchemy_url": "https://base-mainnet.g.alchemy.com/v2/{api_key}"},
    "arbitrum": {"chainid": "42161", "alchemy_url": "https://arb-mainnet.g.alchemy.com/v2/{api_key}"},
    "optimism": {"chainid": "10", "alchemy_url": "https://opt-mainnet.g.alchemy.com/v2/{api_key}"},
    "polygon": {"chainid": "137", "alchemy_url": "https://polygon-mainnet.g.alchemy.com/v2/{api_key}"},
    "bnb": {"chainid": "56", "alchemy_url": "https://bnb-mainnet.g.alchemy.com/v2/{api_key}"},
    "avalanche": {"chainid": "43114", "alchemy_url": "https://avax-mainnet.g.alchemy.com/v2/{api_key}"},
}

CHAIN_ALIASES = {
    "eth": "ethereum",
    "ethereum": "ethereum",
    "mainnet": "ethereum",
    "base": "base",
    "base-mainnet": "base",
    "arbitrum": "arbitrum",
    "arb": "arbitrum",
    "optimism": "optimism",
    "op": "optimism",
    "polygon": "polygon",
    "matic": "polygon",
    "bnb": "bnb",
    "bsc": "bnb",
    "binance": "bnb",
    "avalanche": "avalanche",
    "avax": "avalanche",
}


def _normalize_chain(chain: str | None) -> str:
    key = (chain or "ethereum").strip().lower().replace(" ", "")
    normalized = CHAIN_ALIASES.get(key)
    if normalized:
        return normalized
    raise ValueError(f"Unsupported chain '{chain}'. Supported: {', '.join(sorted(CHAIN_REGISTRY))}")


def _get_chain_config(chain: str | None = "ethereum") -> dict:
    return CHAIN_REGISTRY[_normalize_chain(chain)]


def _alchemy_rpc_url(chain: str | None = "ethereum") -> str:
    config = _get_chain_config(chain)
    alchemy_key = os.environ.get("ALCHEMY_API_KEY", "")
    if not alchemy_key:
        raise ValueError("Set ALCHEMY_API_KEY in your .env")
    return config["alchemy_url"].format(api_key=alchemy_key)


def _get_w3(chain: str | None = "ethereum") -> Web3:
    alchemy_key = os.environ.get("ALCHEMY_API_KEY", "")
    infura_key = os.environ.get("INFURA_API_KEY", "")
    chain_name = _normalize_chain(chain)

    if alchemy_key:
        url = _alchemy_rpc_url(chain_name)
    elif chain_name == "ethereum" and infura_key:
        url = f"https://mainnet.infura.io/v3/{infura_key}"
    else:
        raise ValueError("Set ALCHEMY_API_KEY in your .env")

    w3 = Web3(Web3.HTTPProvider(url))
    if not w3.is_connected() and chain_name == "ethereum" and alchemy_key and infura_key:
        url = f"https://mainnet.infura.io/v3/{infura_key}"
        w3 = Web3(Web3.HTTPProvider(url))
    return w3


def get_source_code(address: str, chain: str | None = "ethereum") -> dict:
    """
    Fetch verified source code from Etherscan.
    Returns a dict with:
      - verified: bool
      - source_code: str (full Solidity source, or "" if unverified)
      - contract_name: str
      - compiler_version: str
      - abi: list (parsed ABI, or [])
      - license: str
      - is_proxy: bool (Etherscan proxy detection)
      - implementation: str (implementation address if proxy)

    Falls back gracefully — if ETHERSCAN_API_KEY is not set or request fails,
    returns verified=False so the caller knows to rely on bytecode only.
    """
    etherscan_key = os.environ.get("ETHERSCAN_API_KEY", "")
    empty = {
        "verified": False,
        "source_code": "",
        "contract_name": "",
        "compiler_version": "",
        "abi": [],
        "license": "",
        "is_proxy": False,
        "implementation": "",
    }

    try:
        addr = Web3.to_checksum_address(address)
        params = {
            "module": "contract",
            "action": "getsourcecode",
            "address": addr,
        }
        if etherscan_key:
            params["apikey"] = etherscan_key

        params["chainid"] = _get_chain_config(chain)["chainid"]
        r = requests.get(ETHERSCAN_API, params=params, timeout=10)
        data = r.json()

        if data.get("status") != "1" or not data.get("result"):
            print(f"    [ETHERSCAN] No result for {address}: {data.get('message', '')}")
            return empty

        result = data["result"][0]
        source = result.get("SourceCode", "").strip()
        source, sources = _extract_etherscan_sources(source)

        # Etherscan returns empty string or "0x" for unverified contracts
        if not source or source == "0x":
            return empty

        abi_raw = result.get("ABI", "[]")
        try:
            abi = json.loads(abi_raw) if abi_raw != "Contract source code not verified" else []
        except Exception:
            abi = []

        # Etherscan proxy detection field
        impl = result.get("Implementation", "").strip()
        is_etherscan_proxy = bool(impl and impl != "0x0000000000000000000000000000000000000000")

        return {
            "verified": True,
            "source_code": source,
            "sources": sources,
            "contract_name": result.get("ContractName", ""),
            "compiler_version": result.get("CompilerVersion", ""),
            "abi": abi,
            "license": result.get("LicenseType", ""),
            "is_proxy": is_etherscan_proxy,
            "implementation": impl if is_etherscan_proxy else "",
        }

    except Exception as e:
        print(f"    [ETHERSCAN] Error fetching source for {address}: {e}")
        return empty


def get_contract_context(address: str, chain: str | None = "ethereum") -> dict:
    """
    Fetch on-chain data for an address. Returns a dict with:
    - bytecode_hex: raw deployed bytecode
    - bytecode_size: bytes
    - is_contract: bool
    - tx_count: outbound tx count (nonce)
    - balance_eth: ETH balance
    - is_proxy: heuristic proxy detection
    - storage_slot0: first storage slot value (often owner/admin)
    """
    try:
        w3 = _get_w3(chain)
        addr = Web3.to_checksum_address(address)

        bytecode = w3.eth.get_code(addr)
        bytecode_hex = bytecode.hex()
        is_contract = len(bytecode) > 2

        balance = w3.eth.get_balance(addr)
        balance_eth = w3.from_wei(balance, "ether")

        tx_count = w3.eth.get_transaction_count(addr)

        # EIP-1967 proxy slot: storage slot for implementation address
        EIP1967_IMPL_SLOT = (
            0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC
        )
        storage_impl = w3.eth.get_storage_at(addr, EIP1967_IMPL_SLOT)
        impl_addr = "0x" + storage_impl.hex()[-40:]
        is_proxy = impl_addr != "0x" + "0" * 40

        # Slot 0 often holds owner/admin on simple contracts
        slot0 = w3.eth.get_storage_at(addr, 0).hex()

        return {
            "address": addr,
            "bytecode_hex": bytecode_hex,
            "bytecode_size": len(bytecode),
            "is_contract": is_contract,
            "tx_count": tx_count,
            "balance_eth": float(balance_eth),
            "is_proxy": is_proxy,
            "impl_address": impl_addr if is_proxy else None,
            "storage_slot0": slot0,
            "error": None,
        }
    except Exception as e:
        return {
            "address": address,
            "bytecode_hex": "",
            "bytecode_size": 0,
            "is_contract": False,
            "tx_count": 0,
            "balance_eth": 0.0,
            "is_proxy": False,
            "impl_address": None,
            "storage_slot0": "",
            "error": str(e),
        }


def get_transfer_history(address: str, limit: int = 50, chain: str | None = "ethereum") -> dict:
    """
    Fetch complete transfer picture for a contract:
      - inbound:     asset transfers TO the address (Alchemy)
      - outbound:    asset transfers FROM the address (Alchemy)
      - normal_txs:  regular ETH transactions (Etherscan) — includes isError flag for revert detection

    Returns dict with keys: inbound, outbound, normal_txs.
    Each is a list; empty list if provider not configured or request fails.
    """
    result = {"inbound": [], "outbound": [], "normal_txs": []}

    alchemy_key = os.environ.get("ALCHEMY_API_KEY", "")
    etherscan_key = os.environ.get("ETHERSCAN_API_KEY", "")
    addr = address.lower()

    # ── Alchemy: inbound asset transfers ──────────────────────────────────────
    if alchemy_key:
        url = _alchemy_rpc_url(chain)
        for direction, param_key in [("inbound", "toAddress"), ("outbound", "fromAddress")]:
            payload = {
                "id": 1,
                "jsonrpc": "2.0",
                "method": "alchemy_getAssetTransfers",
                "params": [{
                    "fromBlock": "0x0",
                    "toBlock": "latest",
                    param_key: addr,
                    "category": ["erc20", "erc721", "erc1155", "external", "internal"],
                    "maxCount": hex(limit),
                    "withMetadata": True,   # gets blockTimestamp for timing analysis
                    "excludeZeroValue": False,
                    "order": "desc",
                }],
            }
            try:
                r = requests.post(url, json=payload, timeout=12)
                transfers = r.json().get("result", {}).get("transfers", [])
                result[direction] = transfers
            except Exception:
                pass

    # ── Etherscan: normal transactions (ETH txs with isError flag) ────────────
    if etherscan_key:
        try:
            params = {
                "module": "account",
                "action": "txlist",
                "address": Web3.to_checksum_address(address),
                "startblock": 0,
                "endblock": 99999999,
                "page": 1,
                "offset": limit,
                "sort": "desc",
                "apikey": etherscan_key,
            }
            params["chainid"] = _get_chain_config(chain)["chainid"]
            r = requests.get(ETHERSCAN_API, params=params, timeout=12)
            data = r.json()
            if data.get("status") == "1":
                result["normal_txs"] = data.get("result", [])
        except Exception:
            pass

    return result


def get_contract_creation_time(address: str, chain: str | None = "ethereum"):
    """
    Attempt to find the contract's creation timestamp using Etherscan's txlist.
    This fetches the earliest normal transaction involving the address (sort=asc, offset=1)
    and returns a datetime parsed from the tx's timeStamp if present.
    Returns None on failure.
    """
    etherscan_key = os.environ.get("ETHERSCAN_API_KEY", "")
    if not etherscan_key:
        return None
    try:
        params = {
            "module": "account",
            "action": "txlist",
            "address": Web3.to_checksum_address(address),
            "startblock": 0,
            "endblock": 99999999,
            "page": 1,
            "offset": 1,
            "sort": "asc",
            "apikey": etherscan_key,
        }
        params["chainid"] = _get_chain_config(chain)["chainid"]
        r = requests.get(ETHERSCAN_API, params=params, timeout=12)
        data = r.json()
        if data.get("status") == "1" and data.get("result"):
            tx = data["result"][0]
            ts = tx.get("timeStamp") or tx.get("blockNumber")
            # Etherscan returns timeStamp as a unix string
            try:
                import datetime as _dt
                return _dt.datetime.fromtimestamp(int(ts), _dt.timezone.utc)
            except Exception:
                return None
    except Exception:
        pass
    return None