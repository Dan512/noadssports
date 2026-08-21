# NoAdsSports — Project Memory

NoAdsSports is a static PWA at **noadssports.com** that lets users follow sports teams and receive ad-free live scores, schedules, standings, injury reports, match stats, and push notifications. Source of truth is the code in this repo and the two Cloud Run backends in `backend/` (gitignored).

## Non-Negotiables

- **Dan handles all git commits.** Never auto-commit. Never push without explicit instruction.
- **Offer choices.** Don't auto-decide design or product questions.
- **Brand voice:** never use the word "donate" in user-facing text. Use "tip" or "support".
- **Privacy posture is a brand promise.** No analytics, no tracking, no cookies. Any new feature must keep that claim true.
- **Backend lives outside the public repo.** `backend/` is gitignored. Frontend repo is public.
- **Never commit secrets.** API keys, VAPID keys, and `ADMIN_TOKEN` only live in Cloud Run env vars and Dan's local notes.

## Repo Map

| Path | Purpose |
|------|---------|
| `index.html`, `css/style.css`, `js/app.js`, `js/i18n.js`, `js/teams.js`, `sw.js` | Static frontend (GitHub Pages) |
| `img/teams/`, `img/ncaa/`, `img/flags/`, `img/notif/` | Locally hosted logos and icons |
| `backend/sports-proxy/` (gitignored) | Cloud Run service: proxies TheSportsDB, NCAA, ESPN unofficial, RSS; stores feedback in Firestore |
| `backend/push-server/` (gitignored) | Cloud Run service: Web Push via VAPID; polls livescores; subscriptions in Firestore |
| `docs/` | Project memory (this folder) |
| `CNAME` | `noadssports.com` for GitHub Pages |

## Common Commands

```
# Frontend: push to main → GitHub Pages serves it (Dan commits)
# Local syntax check before pushing JS changes:
node -c js/app.js

# Backend syntax check:
node -c backend/sports-proxy/index.js
node -c backend/push-server/index.js

# Tail Cloud Run logs (most recent 15 min):
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=sports-proxy" --limit=20 --freshness=15m --format="value(textPayload)"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=push-server"  --limit=20 --freshness=15m --format="value(textPayload)"
```

Deploy commands and admin-only diagnostics live in `docs/commands.md` and `docs/deployment.md` — they use placeholders for URLs and tokens.

## Where To Look

| Topic | File |
|-------|------|
| What the product is, user flows, supported leagues | `docs/product.md` |
| System diagram, frontend/backend split, data flow | `docs/architecture.md` |
| Day-to-day dev/debug commands (incl. admin-only) | `docs/commands.md` |
| Deploy procedure for each service + DNS | `docs/deployment.md` |
| Env var reference per service | `docs/env-vars.md` |
| HTTP endpoint reference (proxy + push server) | `docs/api-endpoints.md` |
| Firestore collections + localStorage keys | `docs/data-model.md` |
| External data providers + league IDs | `docs/sports-data-sources.md` |
| Cache TTLs and polling intervals | `docs/data-freshness.md` |
| What's collected vs. not collected | `docs/privacy-and-analytics.md` |
| Threat model, auth, CORS, known issues | `docs/security.md` |
| Manual test plan (no automated tests yet) | `docs/testing.md` |
| Commit/deploy/branch flow + brand voice | `docs/workflow.md` |
| Done, pending, deferred | `docs/roadmap.md` |
| Open TODOs, in-flight work, things to verify | `docs/session-state.md` |
| Decision records | `docs/decisions/` |
| Implementation plans (active and archived) | `docs/plans/` |

## Rules of Use

1. **Code is the highest source of truth.** When docs and code disagree, fix the doc.
2. **Mark uncertain claims as `TODO/VERIFY`** so they can be checked rather than acted on.
3. **Use placeholders for URLs/secrets in committed docs:** `<SPORTS_PROXY_URL>`, `<PUSH_SERVER_URL>`, `<TSDB_API_KEY>`, `<VAPID_PUBLIC_KEY>`, `<VAPID_PRIVATE_KEY>`, `<ADMIN_TOKEN>`, `<GCP_PROJECT_ID>`.
4. **Active plans → `docs/plans/`. Completed plans → `docs/plans/archive/`.** Decisions → `docs/decisions/`.
