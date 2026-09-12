# Prior State of the Project (before ETHOnline 2026)

This file is a permanent, stable record of exactly what RiskSearcher was before ETHOnline 2026 (Sep 4–13, 2026) — kept separate from README.md so it stays intact even as the README is rewritten to describe the final submitted product. See CHANGELOG.md for the iteration-by-iteration record of what was built *during* the event.

The validator agent this is built on is my own prior work — I built it as a contributor to SpotBlock, a community project for scanning reported contracts, originally with a single-model local Ollama LLM layer that was disabled because it kept hitting RAM limits on real hardware. In an earlier build phase, I fixed a broken Etherscan V1 endpoint, added multi-chain support, replaced the disabled local model with a cloud-based multi-backend LLM client (Anthropic/AgentRouter) plus a specialist+judge pipeline, fixed a FAISS self-contamination bug, a SELFDESTRUCT opcode false-positive bug, a zero-value-transfer detection bug, and a verdict/score consistency bug, and decoupled the tool entirely from SpotBlock's queue/wallet flow into RiskSearcher, a standalone tool.

As of the start of ETHOnline 2026, RiskSearcher was a working CLI (`python main.py`) with a full test suite, a documented baseline comparison against manual due-diligence (firsthand: 2/4 correct verdicts manually vs. 4/4 with the tool), and a real ground-truth evaluation set — but it had no UI, no live on-chain data source beyond direct RPC/Etherscan calls, and no payment layer; it was a tool you run locally, not a product a non-technical user could reach.

Everything built from this point forward — The Graph integration, the Circle/Arc payment layer, and the web UI — is new work built during ETHOnline 2026.
