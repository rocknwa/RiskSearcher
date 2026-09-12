# RiskSearcher — Interface

Frontend for RiskSearcher: paste a token address, get a scam-token risk verdict from
the rules + specialist + judge pipeline. This is the UI layer only — the
analysis engine lives in the main RiskSearcher backend repo.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` to the backend URL supplied by your deployment configuration. Do not commit that value.
3. Run the app:
   `npm run dev`
