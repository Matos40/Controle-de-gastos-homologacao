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
- No live Firestore transaction tests, remote integration or production rollout yet.
- Current handler reuses restricted experimental Firebase project and legacy service credential adapter; ADC/identity setup, secure secret injection, IAM, CORS and client authentication integration require validation before enablement. No secrets included.
- Final authorization checks valid current account; original reserved plan is used for settlement. Review tier changes mid-request and policy compatibility before release.
- Candidate uses JSON transport; binary input is deliberately not accepted at this stage.
- 08.4 blocked. Production, published homologation, official databases, API key flow and restoration point remain outside scope.

## Smart AI UX candidate

`GET /v1/credits` uses the same verified, revocation-checked Firebase bearer token as extraction. It is read-only and returns `plan`, `remaining`, `busy` and the next Premium renewal date in the Bahia calendar. The server derives UID from the token and does not accept a UID selector.

The experimental client consists of `ux/smart-ai.mjs` and `ux/smart-ai.css`. Mount it in an isolated authenticated host on the same origin as the API. Use the host's existing Firebase session for `getIdToken`, and connect the host's Premium information and review actions through `onUpgrade` and `onReview`. The review hook only receives the extraction result. No purchase or entry into a financial database is performed. For browser POST requests, configure `SMART_AI_UI_ORIGIN` to the isolated host's exact origin. Load the host's existing Orbitron and Plus Jakarta Sans fonts before the stylesheet.

```js
import {mountSmartAI} from '/smart-ai/smart-ai.mjs';
mountSmartAI(container, {
  getIdToken: () => firebaseAuth.currentUser?.getIdToken(),
  onUpgrade: showPremiumInformation,
  onReview: showInvoiceReview,
});
```

The browser tests mount the component over loopback with synthetic tokens and responses. They exercise a desktop Chromium viewport, an Android Chromium viewport and an iOS WebKit viewport. No official session or remote Firebase data is used.

## Smart Admin AI candidate

Mount `mountSmartAdminAI(container, {getIdToken})` from `/smart-ai/smart-admin-ai.mjs` inside the isolated administrative host using its verified Firebase session and the shared Smart AI stylesheet. `POST /v1/admin/ai` rechecks token revocation, account and role on each call. Active Owner and Admin can see aggregates and search up to 20 matching UID prefixes. Individual credit reads are performed in the authorized read transaction. Only Owner can change admission or global limits.

The switch and limits are updated with an expected version and an append-only audit entry in one transaction. The switch is checked when reserving a new attempt. Settlements and recovery of existing attempts remain available. Daily and monthly limits use UTC and can be configured within the current lab ceiling of 30 and 60 attempts respectively. No billing is connected.

Dashboard periods use America/Bahia and count reservations by original day, month and plan. The average is completed extractions divided by distinct users with at least one registered attempt in that month. A conversion is the first observed Premium attempt after the same UID consumed a Free credit. This measures adoption observed by the reader, not subscriptions or revenue. Refunds count terminal failed attempts that released a credit. New aggregates start with instrumented attempts and do not infer historical plan splits or backfill them. Existing commercial records are retained. The monetary simulator multiplies recorded monthly attempts by a value entered by the operator and leaves the estimate blank until a value is provided. No raw invoice or extraction content is stored by the new metrics or audit.

UID prefix search uses a bounded Firestore query and additionally needs the experimental service identity to have `datastore.entities.list` before any later remote integration. The local emulator and synthetic CI validate this candidate without changing cloud IAM.
