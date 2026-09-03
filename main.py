"""
main.py — RiskSearcher entry point.

Usage:
  python main.py --address 0xABC...
"""

import argparse
import sys

from dotenv import load_dotenv

from rpc.provider import CHAIN_REGISTRY

load_dotenv("config.env")
load_dotenv(".env")


def _print_banner() -> None:
    print("RiskSearcher")
    print("Smart contract security analysis combining deterministic rules with expert LLM analysis.")
    print()


def _prompt_for_chain() -> str:
    chains = list(sorted(CHAIN_REGISTRY.keys()))
    print("Select chain:")
    for idx, name in enumerate(chains, start=1):
        print(f"  {idx}. {name.title()}")
    choice = input("Chain [1]: ").strip()
    if not choice:
        return "ethereum"
    try:
        idx = int(choice)
    except ValueError:
        return "ethereum"
    if 1 <= idx <= len(chains):
        return chains[idx - 1]
    return "ethereum"


def main():
    parser = argparse.ArgumentParser(
        description="Run a single-address contract risk analysis with RiskSearcher."
    )
    parser.add_argument("--address", help="Contract address to analyze")
    parser.add_argument(
        "--chain",
        default=None,
        choices=sorted(CHAIN_REGISTRY.keys()),
        help="Chain to fetch source/bytecode/transfer data from",
    )
    args = parser.parse_args()

    _print_banner()

    if args.address:
        address = args.address
        selected_chain = args.chain or "ethereum"
    else:
        address = input("Contract address: ").strip()
        if not address:
            print("No contract address supplied. Exiting.")
            raise SystemExit(1)
        selected_chain = _prompt_for_chain()

    from core.analyzer import analyze
    from core.report import write_markdown_report

    print(f"\nStarting analysis for {address} on {selected_chain}...\n")
    result = analyze(address, chain=selected_chain)
    report_path = write_markdown_report(result)

    print("Analysis complete.")
    print()
    print(f"Verdict: {result.verdict.upper()}")
    print(f"Score: {result.score}")
    print(f"Reason: {result.comment or 'No risk signals detected'}")
    print()
    print(f"Full report: {report_path}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted by user. Exiting.")
        sys.exit(0)
