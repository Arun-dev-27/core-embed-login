# Handoff: what this SDK sits on top of

Written for: whoever builds or maintains `miqaat-core-embed-react`, without necessarily having read the
full core-authentication / core-authorization codebases. This explains the two backend services in plain
terms, and exactly where this SDK's responsibility starts and stops.

## The two services, in one sentence each

- **core-authentication** ("Core Identity") is the only thing that ever sees a password. It renders the
  login screen, checks credentials, and hands back a signed proof of who the user is.
- **core-authorization** is the guest list. It owns which Business Unit apps exist (`client_id`), which
  web origins are allowed to embed their login, what callback URLs they use, and — separately — each
  user's roles/permissions. core-authentication reads this from core-authorization on every login attempt;
  it does not store it itself.

Neither service ever knows or cares about a Business Unit's own application data (registrations, bookings,
whatever RMS/AMS/VMS actually do). That stays entirely on the Business Unit side.

## The flow this SDK automates

1. A Business Unit page (say, RMS) wants the user signed in. It mounts this SDK's `<MiqaatEmbedLogin>`.
2. The SDK asks core-authentication to start a **transaction**: "someone from origin X, for client Y, wants
   to sign in." Core checks that origin X is on the allowed list for client Y (configured in
   core-authorization) and hands back a `transaction_id`, a `login_url`, and an expiry (5 minutes by
   default).
3. The SDK puts that `login_url` in an `<iframe>`. Everything inside the iframe — the actual form, the
   password field, "Forgot password", branding, error states — is rendered by core-authentication itself.
   The SDK never sees, builds, or touches that UI. It is not allowed to: the iframe is sandboxed and
   cross-origin, and Core sends a `Content-Security-Policy: frame-ancestors <exact-origin>` header that
   only that one Business Unit origin is allowed to frame.
4. The user types credentials **inside the iframe**. That request goes same-origin to core-authentication
   — it never touches the Business Unit's origin, and never touches this SDK.
5. On success, core-authentication signs a short-lived JWT (the "assertion") and the iframe's own script
   sends it to the parent window with `postMessage`, targeted at the exact registered origin — never `*`.
6. This SDK is the thing listening for that `postMessage`. It checks the sender is really the Core iframe,
   unwraps the payload, and calls your `onSuccess(payload)` callback with the raw
   `{ transactionId, state, coreAssertion }`.
7. **That's where the SDK's job ends.** Your own backend must take `coreAssertion`, fetch
   `{coreBaseUrl}/.well-known/jwks.json`, verify the RS256 signature by `kid`, check `iss`/`aud`/`exp`/`txn`,
   and reject replayed `jti`s — only then is `sub` a trustworthy ITS ID. Reference implementation:
   `core-authentication/docs/bu-integration-guide.md` §4, and a runnable example in
   `core-authentication/examples/embed-playground`.
8. Your backend then does whatever it wants with that trusted identity — map it to a local user, load
   roles from core-authorization, issue your own session/cookie. Core is not involved in any of that.

## Why the SDK is allowed to call `/auth/transaction` directly from the browser

`client_id` is not a secret and this endpoint requires no auth header — the security control is that Core
checks the calling `origin` against the list registered for that client in core-authorization. So a
browser-only integration (no Business Unit backend call needed to *start* sign-in) is a supported, intended
mode, not a shortcut. If a team wants their backend to own transaction creation instead (e.g. to bind it to
their own session cookie before the iframe loads), the SDK supports that too via the `transaction` config
option — see the README.

## Two things that live in Core config, not in this SDK

- **"Forgot password"**: on the reference login screen you shared (`Miqaat-Registration.html`, saved from
  `rms-mumin.underdev.in/login`), it links out to `https://www.its52.com/` — the external ITS identity
  site. Whether that link shows at all, and where it points, should be a per-client setting held in
  core-authorization and rendered by core-authentication's own login page
  (`core-authentication/src/modules/embed/services/login-views.ts` /
  `core-authentication/public/login.js`). It is **not** something this SDK renders or configures, because
  the SDK never has access to the login screen's DOM — that's the whole point of the iframe boundary.
- **Branding** (logo, colours): same story — a future Core-side config, applied inside the iframe. This SDK
  intentionally has no theming API yet; there is nothing for it to theme.

## Things that are Core's job and must never move into this SDK or a host app

- Accepting a password.
- Deciding the CSP `frame-ancestors` value for a given transaction.
- Validating that an embedding origin is allowed.

These are enforced server-side by core-authentication on every request, independent of how this SDK is
packaged (plain npm import vs. a runtime-loaded micro-frontend) — the browser's cross-origin/sandbox rules
make that boundary real regardless of the packaging choice. See the README's "Packaging" section for why
we're shipping this as a normal npm component rather than a Module Federation remote.

## Known gaps in v0.1 (intentionally deferred)

- `MIQAAT_AUTH_TOP_LEVEL_REQUIRED` (Safari/third-party-cookie-blocked fallback) is surfaced via
  `onTopLevelRequired`, but the SDK does not yet implement the full `display=page` → top-level redirect →
  form-post-to-your-callback dance from `bu-integration-guide.md` §7. A host that needs this today has to
  wire it up manually; a helper for it is a natural v0.2 addition.
- No built-in retry/backoff UI beyond `renderError` + `restart()`.
- No non-React build (Web Component / UMD) yet — see README "Later".
