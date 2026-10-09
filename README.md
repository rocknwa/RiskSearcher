# RiskSearcher

**AI-powered smart contract risk intelligence for Ethereum and EVM-compatible networks.**

RiskSearcher helps users examine an unfamiliar smart contract before interacting with it. Enter a contract address, select a supported chain, and receive a structured risk assessment supported by on-chain evidence and clear explanations.

**[Launch RiskSearcher](https://risksearcher.vercel.app/)**

> **Status:** Live product with select features operating on test networks. Risk assessments are informational, not guarantees of safety or financial advice.

## Why RiskSearcher?

Evaluating an unfamiliar token or smart contract can require reading verified source code, interpreting bytecode, reviewing transaction patterns, and assessing available liquidity data. That takes time and specialist knowledge, while meaningful risks can still be overlooked.

RiskSearcher brings relevant signals into one interface to make an initial risk review more accessible, consistent, and evidence-driven.

## What you can do

- **Assess contract risk:** Review a verdict, risk score, supporting observations, and a human-readable explanation.
- **Inspect technical signals:** Surface relevant findings from verified source or deployed bytecode, where available.
- **Examine on-chain activity:** Add transaction-behavior context to a contract assessment.
- **Review liquidity context:** See available liquidity and market-activity indicators for supported tokens and networks.
- **Follow analysis progress:** Watch the assessment progress in the browser as findings become available.
- **Keep a history:** Return to previous scans through your authenticated account.

RiskSearcher combines automated checks with contextual AI-assisted analysis to produce evidence-backed findings in a single report.

## Get started

1. Open **https://risksearcher.vercel.app/**.
2. Sign in with a supported passkey-based account.
3. Verify eligibility for free trial scans, or access available scan credits.
4. Enter a smart contract address and choose a supported network.
5. Review the streamed analysis, evidence, and final assessment.

### Account access and testnet payments

- **Passkey-based access:** Passwordless authentication through Circle wallet infrastructure.
- **Human verification:** World ID Selfie Check helps limit repeat free-trial claims.
- **Trial access:** Eligible verified users can claim three free scans.
- **Credit packs:** The current testnet flow offers ten scan credits for 5 USDC on **Arc Testnet**.
- **Account history:** Scan history, access entitlements, and ledger activity persist across sessions.

**Important:** Arc Testnet USDC is test currency, not real-value USDC. Testnet flows do not represent a live fiat on-ramp, off-ramp, or recurring subscription.

## Technology overview

RiskSearcher is a full-stack application built using technologies including:

| Area | Technologies |
| --- | --- |
| Web application | React, TypeScript, Vite |
| Backend | Python, FastAPI |
| Risk intelligence | EVM source/bytecode analysis, on-chain signals, AI-assisted assessment |
| Blockchain data | EVM RPC infrastructure, The Graph |
| Authentication and wallets | Circle, passkey-based smart accounts |
| Human verification | World ID |
| Payment network | Circle Arc Testnet, USDC |
| Persistent account data | Firestore |

This overview describes public product capabilities and major integrations, rather than implementation details or an operational deployment guide.

## Origins

RiskSearcher began as a command-line smart contract analysis project and evolved into a browser-accessible product. Its web application, authenticated access, streamed reports, account features, and partner integrations were developed further during **ETHOnline 2026**.

The project showcases practical work across blockchain analysis, backend engineering, AI integration, authentication, payments, and full-stack product development.

## Security and limitations

- A low risk score **does not certify** that a contract is secure, legitimate, or safe to trade.
- Results depend on the quality and availability of source code, transaction data, chain infrastructure, liquidity feeds, and automated analysis.
- Some vulnerabilities, malicious behaviors, and market risks may not be observable through automated checks.
- Always conduct independent due diligence before making financial decisions or interacting with an unfamiliar contract.

## Intellectual property and permissions

**© 2026 Therock Ani. All rights reserved, subject to applicable prior grants and third-party licenses.**

RiskSearcher's original name, logo, and branding are reserved. No permission is granted to use them to identify another product or imply endorsement or affiliation. Source-code permissions are described in [LICENSE](./LICENSE); earlier valid license grants and independent third-party licenses remain effective.

## Contact

Developed by **Therock Ani**.

- [LinkedIn](https://www.linkedin.com/in/therock-ani-13336224b/)
- [Live product](https://risksearcher.vercel.app/)
