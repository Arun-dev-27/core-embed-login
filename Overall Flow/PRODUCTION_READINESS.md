# Production readiness — gap list

Written for: the dev team, as the punch list for turning the embedded federation login POC (see
`HANDOFF.md`) into something deployable. Nothing here is urgent for continuing to demo or iterate on the
POC locally — this is what's left before it should carry real traffic or real user data.

## Architecture decisions that need a real owner, not a POC default

- **The two schemas in `core-authorization` (`public` vs `miqaat_core`).** They coexist today because the
  POC needed a working local session *now* and `miqaat_core` was the schema with a `tenants`/`roles`/`users`
  model already designed for it. Long-term this needs an explicit decision: consolidate into one schema,
  keep them permanently separate with clear ownership boundaries, or split into two services. Living with
  an undocumented split is the riskiest option.
- **`LocalSessionService`/`session.controller.ts` is a first draft**, built in this POC after the team
  indicated they'd design the real session/permission subsystem. Specific open questions before it's the
  real thing:
  - Should the hot path (session lookup on every request) hit Postgres directly, as it does now, or should
    there be a Redis layer in front of it (the pattern used elsewhere in this codebase for exactly this
    kind of check)?
  - ~~`pickRoleForUser()` just takes the first assigned role~~ — **resolved**: a user holding more than one
    active role now gets a "Where do you want to log in?" selection step
    (`POST /authorization/session` returns `selection_required: true` + the role list instead of a cookie;
    `POST /authorization/session/select` finalizes it). See `HANDOFF.md` §9. Still open: the choice isn't
    remembered — a multi-role user sees the picker on every login, since nothing persists a "last selected
    tenant" preference per user. Minor, but worth a product decision.
  - **Who owns the role-selection screen itself?** Today it's hand-built inside `core-embed-react/example`
    (`RoleSelectionPage.jsx`) — every Business Unit that has multi-tenant users would need to build this
    screen themselves against the raw `selection_required` / `pending_token` API contract (see the README
    §2 diagram). Worth deciding whether that UI (or at least the fetch/branch logic around it) belongs in
    the SDK itself as a second exported component, the way `<MiqaatEmbedLogin>` already is, so BUs get it
    for free instead of every team re-implementing the same picker against the same contract.
  - No admin-facing session management exists (list a user's active sessions, force-revoke one, see
    `last_seen_at`). `expires_at`/`revoked_at` are already columns; nothing reads them except the resolve
    path.
  - Session TTL is hardcoded to 8 hours in `local-session.service.ts` (`SESSION_TTL_SECONDS`) — arbitrary,
    needs a product decision, probably belongs in `platform_settings` alongside the other duration configs
    that table already holds.
- **True single-logout is not implemented.** Signing out of the local session does not end
  `core-authentication`'s federation SSO session — only `prompt: 'login'` hides its "Continue as X" screen
  on the next visit. The federation session self-expires on its own idle TTL. If the product requirement is
  "signing out here signs you out everywhere," that's `core-authentication`'s `POST /embed/logout` (same
  browser) or the full `POST /federation/logout` (all BUs, back-channel push) — both call for real design
  work, not a quick fetch call, since neither is trivially callable from a plain cross-origin frontend fetch.

## Security review items

- **Cookie `Secure` + `SameSite=None` currently relies on Chrome's localhost exemption.** Confirmed working
  in Chrome; not verified in Safari/Firefox. Behind real TLS (any staging/prod deployment) this stops
  mattering, but it should be explicitly tested cross-browser before this ships, and the
  `MIQAAT_AUTH_TOP_LEVEL_REQUIRED` fallback (Safari ITP / third-party cookie blocking — see
  `core-embed-react`'s own `docs/HANDOFF.md` "Known gaps") needs to actually be built if Safari support
  matters, since the SDK currently just surfaces the event without a default handler.
- **CORS hooks in both `bootstrap.ts` files are hand-rolled, path-scoped, origin-reflecting.** This is safe
  *because* the real trust decision (origin-vs-client_id, or the assertion signature) is still enforced
  inside each handler — CORS here only ever controls whether a browser can read a response it could get
  another way. Still worth a second pair of eyes, and worth deciding whether preflight should instead check
  against a live "registered origins" set (discussed with the user; deferred as unnecessary for the POC).
- **No rate limiting on `POST /authorization/session`.** It's public, and does real work (JWKS fetch on
  first `kid`, a DB write) per call. `core-authentication`'s own login endpoints have `LoginThrottleService`
  patterns to copy from.
- **No automated tests** were added for any new code this POC introduced: `AssertionVerifierService`,
  `LocalSessionService`, `SessionController` (including the new `/session/select` step), or the SDK's
  `useMiqaatEmbed` fixes. This is the biggest gap before merging any of this into a real branch — POC
  velocity traded off coverage deliberately.
- **The pending-selection token (`authz:pending-login:*` in Redis) has no rate limiting or lockout**, same
  as the rest of `/authorization/session*`. It's short-lived (5 min) and one-time, but a script could still
  hammer `POST /authorization/session` to mint many pending tokens for a valid assertion before it expires.
- **Key management is dev-only.** `core-authentication`'s signing key lives in localstack's fake Secrets
  Manager; production needs the real AWS Secrets Manager + rotation runbook the architecture doc already
  specifies (§21, §aws-signing-keys.md) — nothing here changes that plan, just flagging it's untouched by
  this POC.

## Cleanup

- **`core-authorization`'s own `clients` / `client_origins` / `client_redirect_uris` tables (`public`
  schema) are now vestigial for federation purposes** — `core-authentication` has its own `auth_clients` /
  `auth_client_origins` / `auth_client_callbacks` and no longer reads these (see `HANDOFF.md` §8). They
  still back `core-authorization`'s own `ClientsController` admin API and its `AuthorizationEngine`'s
  client-to-application scoping, so they're not dead — but two registries can now drift out of sync (e.g.
  `rms-web-dev`'s origins are registered in both places, separately, and nothing keeps them consistent).
  Worth an explicit decision: does `core-authorization` still need its own copy of origins/callbacks at all,
  or only the client-to-application/business-unit mapping it uses for authorization scoping?
- **`core-embed-react` is unpublished** (`file:..` local dependency). Needs a real package name, a target
  registry, and a versioning policy before any other BU frontend can depend on it.
- **Demo seed data** (`core-authorization/scripts/seed-miqaat-core-demo.ts`) creates a fake "RMS Demo"
  tenant and three throwaway personas in the `miqaat_core` schema. Fine for local dev; should not run
  against a shared/staging database without renaming or gating it behind an environment check.

## Functionally out of scope, not started

- Non-ITS member login (`login_otp_codes`) — explicitly deferred in the original `MiqaatCoreSchema`
  migration note, untouched here.
- Any real module screen behind the dashboard sidebar — `ModulePage.jsx` is a placeholder that only proves
  which actions a role holds; no actual Business Unit Management / Role Management / etc. UI exists yet.
- Back-channel / federation-wide force logout wiring into the local session.
