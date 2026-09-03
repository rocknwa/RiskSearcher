import sys
import os
import json
from dotenv import load_dotenv
load_dotenv('config.env')
load_dotenv('.env')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from core.analyzer import analyze

addresses = [
    "0x42eDA42459A18F155FAaaBE9aa55246ed1D0a571",  # FARTPEPE (confirmed malicious)
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  # WETH9 (safe)
    "0x0bed281bdfc7bf127cadca5f77e05b20cfb4e100",  # OverlayerOriginShrimp (expected safe)
    "0x92df135c27ab5a2080f5cbcbb0a693c07a283e9c",  # OverlayerOriginDolphin (expected safe)
]

results = {}
for addr in addresses:
    print(f"\n=== ANALYZING {addr} ===")
    res = analyze(addr)
    if hasattr(res, 'to_dict'):
        d = res.to_dict()
    else:
        d = {
            'address': res.address,
            'verdict': res.verdict,
            'severity': res.severity,
            'score': res.score,
            'breakdown': res.breakdown,
            'bytecode_selectors': res.bytecode_selectors,
            'bytecode_opcodes': res.bytecode_opcodes,
            'source_findings_list': res.source_findings_list,
            'behavioral_findings': res.behavioral_findings,
            'similar_scams': res.similar_scams,
            'called_functions': res.called_functions,
            'llm_report': res.llm_report,
        }

    # Print full raw output
    print(json.dumps(d, indent=2, default=str))
    results[addr] = d

# Also write results to file for review
out_path = os.path.join(os.path.dirname(__file__), 'ground_truth_results.json')
with open(out_path, 'w') as f:
    json.dump(results, f, indent=2, default=str)

print(f"\nResults written to {out_path}")
