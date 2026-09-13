# World Selfie Check Integration Feedback — RiskSearcher

## Project context

RiskSearcher is a smart-contract risk analysis application that uses World Selfie Check as an **abuse-prevention and eligibility signal** for its free trial.

The intended flow is:

1. A user connects/signs in to RiskSearcher.
2. The user completes World Selfie Check.
3. RiskSearcher verifies the returned proof server-side.
4. A successful, unique verification unlocks **3 free scans**.
5. The World ID nullifier is persisted server-side so the same verified human cannot repeatedly claim the free trial with different wallets.

This makes Selfie Check a meaningful product control rather than a decorative identity badge.

## 1. Selfie Check docs and integration flow

### What worked well

The overall product concept is clear once the pieces are understood: Selfie Check is a good fit for low-friction abuse prevention where an application needs a lightweight proof that a real human is behind a claim.

For RiskSearcher, the fit is natural because the product offers a limited free trial and needs to reduce repeated claims from throwaway accounts or wallets.

### What was confusing or difficult

The documentation did not make the full setup sequence obvious enough from the perspective of a developer integrating Selfie Check into an existing external web application.

The biggest source of confusion was understanding which setup items were:
- required for Selfie Check itself,
- required for publishing/listing the app in World,
- required for RP signing,
- and required only for testing.

A clearer end-to-end checklist for **external integrations** would help:

1. Create app
2. Choose External Integration
3. Configure RP/app identifiers
4. Create the action used by the product
5. Enable/test Selfie Check in Sandbox
6. Generate RP signature server-side
7. Open IDKit flow
8. Send proof to backend
9. Verify proof server-side
10. Persist nullifier / application-specific entitlement

### RP-signature guidance

The RP-signature step was one of the harder parts to integrate.

World's current IDKit documentation does explain that the RP signature must be generated on the backend and shows a JavaScript example using `@worldcoin/idkit-core/signing`. The gap I ran into was more specific: I could not find clear runtime-compatibility guidance for common hosted environments, especially the distinction between Vercel Edge and Node/serverless runtimes.

During implementation, attempting to use the server-side signer in an Edge-style deployment caused confusing failures before the World verification UI opened.

It would help if the documentation were more explicit about **runtime compatibility for server-side RP signing** — particularly whether Vercel Edge, Vercel Node/serverless functions, and other common deployment runtimes are supported, with a small compatibility matrix or troubleshooting note.

The current developer-docs repository documents IDKit SDKs for JavaScript/React, Swift, Kotlin, and Go, but I could not find an official Python RP-signing example/helper. A Python reference implementation or SDK helper would therefore be useful for teams whose backend is Python rather than JavaScript/TypeScript.

## 2. Developer Portal navigation, search, product discovery, and debugging guidance

### Verification / publishing page was unclear

While configuring credentials in `developer.world.org`, the **Verification** page was confusing from a developer-experience perspective.

At first, I interpreted it as a required prerequisite before Selfie Check would work. The portal UI did not make the purpose of that page clear enough to me, especially while I was still using a temporary Vercel URL rather than a production domain.

This feedback is about the **clarity of the portal UI**, not a claim that the World documentation says publishing is required for Selfie Check. The page itself should explain what the information is used for, whether completing it is required for verification functionality, and whether those values can be edited later.

### App URL vs App Official Website

The page showed an **App URL** field prefilled with `https://docs.world.org/`, while **App Official Website** was empty.

That was confusing because it was not clear:
- why a World documentation URL was prefilled,
- whether the developer should replace it,
- what the difference is between “App URL” and “App Official Website,”
- or where each value will be shown.

Each field should have short helper text describing its purpose and whether it affects verification, display, redirect behavior, or publishing.

### Create Action page needs more explanation

World's API documentation does define an action and exposes fields such as its identifier, human-readable name, description, and maximum verifications. However, the **Create Action** page itself did not give me enough inline context when arriving there directly.

A developer following an integration guide, or using an AI coding assistant, may land directly on this page without having read the concept/API pages first.

The portal page would benefit from a short explanation that an Action identifies the specific verification use case in the app and scopes verification behavior for that use case, plus one concrete example such as `claim-free-trial`.

### Debugging guidance

When an integration fails before the World UI opens, it can be difficult to determine whether the problem is:
- app configuration,
- RP signing,
- frontend IDKit setup,
- the Sandbox app,
- credential availability,
- or backend verification.

A troubleshooting page organized by symptom would be valuable, for example:
- Widget never opens
- RP signature request fails
- Proof is generated but verify endpoint rejects it
- Selfie Check option is unavailable
- Sandbox app is slow or stuck
- Face identity cannot be deleted/reset

## 3. Sandbox App states, proof flows, test users, errors, and edge cases

### Sandbox performance

On my test device, the Sandbox app felt slow and some actions took noticeable time to complete.

If this is device-specific, it would help to document minimum/recommended device requirements. If it is not device-specific, general performance improvements would make testing much smoother.

Visible loading states or progress feedback would help developers distinguish between an operation that is still processing and one that has stalled.

### Face dedupe deletion error

When testing the Sandbox verification tools, **Delete Face Dedupe** returned:

> “Failed to delete face identity and PCP”

This made it difficult to reset the test state and repeat the Selfie Check flow.

For testing-oriented functionality, reset actions should ideally provide:
- a more specific error,
- whether the operation partially succeeded,
- what state remains,
- and how the tester can recover.

### Personal custody package error

When trying the deeper face-auth experience, after taking the selfie the app displayed:

> “Personal custody package is unavailable on your device”

and explained that face authentication requires the custody package created by the Orb and that it could not currently be recreated.

This was confusing in the context of Selfie Check testing because it was not immediately clear whether:
- this feature was unrelated to Selfie Check,
- the device was unsupported,
- the account lacked a required prior state,
- or the test flow could continue in another way.

The Sandbox app should distinguish more clearly between:
- Orb-dependent functionality,
- Selfie Check functionality,
- and generic test-only verification controls.

### Test-state clarity

The Sandbox verification page exposes multiple options such as:
- Orb verification
- simulated Orb verification
- document verification
- secure document verification
- Selfie Check / face authentication
- deletion/reset controls

For a developer specifically testing Selfie Check, the page can feel broader than necessary.

A dedicated “Selfie Check test flow” mode or clearer grouping would help developers focus on the exact credential they are integrating.

## 4. UX feedback on the Selfie Check flow

World's current Selfie Check documentation explicitly describes the handoff to World App: on mobile, IDKit opens World App through a deep link; on desktop, the user scans a QR code and completes the flow in World App. The general verification-flow documentation also explains the hot/warm/cold flows around World App installation and credential availability.

My feedback here is therefore **not that this behavior is undocumented**. It is a product-UX suggestion: for a product like RiskSearcher, a more embedded-feeling verification experience would reduce context switching if World can support that securely in the future.

The current handoff is understandable and documented, but it adds friction for a user who only wants to unlock a small free trial. If the handoff must remain external for security, custody, or privacy reasons, surfacing that rationale prominently in the integration guide would help developers explain the experience to their users.

## 5. What was confusing, missing, broken, or hard to test

### Confusing
- The purpose of the Developer Portal Verification/publishing page.
- Whether the Verification page is required for Selfie Check to function.
- Whether publishing information can be edited later.
- The difference between App URL and App Official Website.
- Why `docs.world.org` was prefilled in the App URL field.
- What an Action represents and why it is required.
- Which Sandbox verification controls are relevant specifically to Selfie Check.
- Whether the “personal custody package unavailable” state affects Selfie Check itself.

### Missing / could be improved
- A more consolidated end-to-end Selfie Check checklist for external web apps. The current docs do cover IDKit, backend RP signing, verification flows, and proof verification, but I found the information easier to understand once I manually connected those pieces.
- Runtime compatibility guidance for RP-signing code, especially Edge vs Node/serverless environments.
- A Python backend RP-signing example or SDK/helper.
- Symptom-based debugging documentation.
- Clear descriptions directly inside Developer Portal forms.
- Clear recovery instructions for failed Sandbox reset/delete operations.
- Better loading/progress indicators in the Sandbox app.

### Broken / errors encountered
- `Delete Face Dedupe` returned “Failed to delete face identity and PCP.”
- A face-auth test reached “Personal custody package is unavailable on your device.”
- Server-side RP-signing integration required extra debugging because runtime compatibility was not obvious.

### Hard to test
- Repeating Selfie Check tests after face-dedupe reset failed.
- Determining whether a slow Sandbox action was still processing or had stalled.
- Distinguishing Selfie Check-specific states from Orb/personal-custody-related states.

## 6. Suggested improvements

1. Add a more consolidated “External Web App + Selfie Check” quick-start/checklist that links the existing setup, backend signing, verification-flow, and proof-verification guidance into one path.
2. Explain every Developer Portal field inline, especially App URL, Official Website, Action identifier, RP ID, and publishing/verification settings.
3. Separate publishing setup from credential setup visually so developers do not think they must publish the app before Selfie Check works.
4. Document runtime support for RP signing with examples for Node, Vercel, Edge runtimes, and Python backends.
5. Provide a Python RP-signing SDK or official reference implementation.
6. Improve Sandbox reset reliability and provide actionable error messages when dedupe deletion fails.
7. Make Selfie Check testing a first-class Sandbox path rather than placing it among many unrelated verification controls without context.
8. Improve Sandbox performance/loading feedback so developers can distinguish a slow operation from a failed one.
9. Clarify Orb/personal-custody dependencies anywhere they appear in a Selfie Check testing environment.
10. Consider a more embedded verification experience for external applications where possible, or clearly explain why an app handoff is required.

## 7. Overall assessment

Selfie Check is a strong fit for lightweight eligibility and abuse-prevention use cases such as RiskSearcher’s one-person/one-free-trial model.

The integration became reliable once the complete architecture was understood: frontend proof request, server-side RP signing, World verification, and application-side nullifier persistence.

The main opportunity for improvement is **developer clarity**. A more explicit setup sequence, clearer Developer Portal field descriptions, stronger runtime guidance, and more predictable Sandbox reset/debug behavior would reduce integration time significantly and make Selfie Check much easier to adopt under hackathon or production deadlines.


## 8. Fact-check notes against current World documentation

I reviewed the current official World documentation and developer-docs repository before finalizing this feedback.

- **Backend RP signing is documented.** The current IDKit core documentation shows `signRequest` from `@worldcoin/idkit-core/signing` and says the RP signing key must stay on the backend. My feedback is specifically about deployment/runtime compatibility guidance, not the absence of backend-signing documentation.
- **Selfie Check's World App handoff is documented.** The Selfie Check page explains mobile deep-link handoff and desktop QR-code handoff, while the verification-flow page documents hot, warm, and cold paths. My UX comment is a suggestion for a more embedded experience, not a claim that the current behavior is undocumented.
- **Actions are documented in the API reference.** The create-action API defines the action identifier, name, description, and maximum verifications. My criticism is that the portal page itself could provide more inline explanation for developers arriving there directly.
- **Official SDK documentation currently lists JavaScript/React, Swift, Kotlin, and Go.** I did not find an official Python IDKit/RP-signing SDK/example in the current docs repository.
- **Selfie Check is explicitly positioned for liveness, Sybil resistance, and continuity.** This matches RiskSearcher's use of it as an abuse-prevention gate for a one-person/one-free-trial entitlement.
