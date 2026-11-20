# 08.3.3 — Cloud Run candidate (not deployed)

Base: b3d3b22f7b9e17ec8ae828378edd70b0aa62e13f. Commercial strategy: ../EXECUTION-STRATEGY.md.

New isolated modules: quota, transactional store, candidate authorization and extraction, HTTP handler, Node adapter and Dockerfile. Legacy files and deployment configuration unchanged. Default startup denies requests until SMART_AI_EXPERIMENT_ENABLED=true. No cloud commands or billing activation.

## Local validation
From repository root:
```sh
node --test experiments/smart-ai-server/cloud-run/commercial.test.mjs experiments/smart-ai-server/remote/worker.test.mjs experiments/smart-ai-server/legacy/invoice.test.mjs
docker build -f experiments/smart-ai-server/cloud-run/Dockerfile -t smart-ai-candidate .
```
The test workflow is scoped to the experimental branch. It builds the image and verifies the default entry point returns HTTP 503 with external networking disabled. Unit tests use synthetic accounts and a serialized in-memory transaction double. Live Firestore and Cloud Run latency are outside this validation.

From `experiments/smart-ai-server`, run the separate integration check against the guarded loopback emulators:

```sh
firebase emulators:exec --only auth,firestore --project demo-raytech-v340 'node cloud-run/smoke.firestore.mjs'
```

## Limits and cost model
Defaults reserve one global attempt unit per admitted request, 30 per UTC day and 60 per UTC month. These are laboratory attempt units, not BRL or actual provider fees. The Firestore config document raytechLabCommercialGlobalV350/config may provide enabled=false to stop admission, or a validated budget object (day, month, perAttempt). Its write path must remain restricted to a trusted operator. No UI or operator write endpoint is implemented. Global attempts are not refunded even when commercial credits are released.

For N new Free accounts, P active Premium accounts, typical demand <= 2N+3P successful extractions; maximum <= 2N+15P, plus failed attempts. Estimate actual cost from measured CPU/memory duration, Gemini input/output tokens, Firestore reads/writes and network, including failures and idle/registry costs; no zero-cost guarantee. Proposed deployment settings for later review: minimum instances 0, maximum 1, concurrency 1, 512 MiB memory, 1 vCPU, application deadline 30 s. Budget alerts are not hard billing caps. No tariff estimate is asserted without measurement and current pricing.

## Remaining gates
- Existing trusted Premium profiles are eligible without `premiumUntil`. When supplied, the server requires a valid timestamp and returns an expired account to its original Free balance. Subscription changes and account provisioning remain external to this candidate.
- On the next reservation for the same UID, expired pending work is recovered atomically after a two-minute grace period. Recovery preserves the consumed rate and global attempt budget, records a failed outcome, and rejects a late settlement. An explicit Firestore `ABORTED` conflict is retried with bounded jitter. Ambiguous commit failures are not retried.
- No real Firestore transaction tests, remote integration, UI credit route, subscription CTA, Smart Admin metrics interface or production rollout yet.
- Current handler reuses restricted experimental Firebase project and legacy service credential adapter; ADC/identity setup, secure secret injection, IAM, CORS and client authentication integration require validation before enablement. No secrets included.
- Final authorization checks valid current account; original reserved plan is used for settlement. Review tier changes mid-request and policy compatibility before release.
- Candidate uses JSON transport; binary input is deliberately not accepted at this stage.
- 08.4 blocked. Production, published homologation, official databases, API key flow and restoration point remain outside scope.
