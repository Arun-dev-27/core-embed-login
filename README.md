# miqaat-core-embed-react

A small React component + hook that embeds Miqaat Core Identity's federated login iframe into any
Business Unit application. It manages the login transaction and relays Core's `postMessage` handoff — it
never sees a password and never verifies the resulting token itself. Background on why it's built this way:
[docs/HANDOFF.md](./docs/HANDOFF.md).

## Install

Not yet published. Until it is, either build and `npm link`/`npm pack` it locally, or point your
`package.json` at the folder/git URL directly:

```json
{ "dependencies": { "miqaat-core-embed-react": "file:../core-embed-react" } }
```

```bash
npm run build   # produces dist/ (ESM + CJS + .d.ts)
```

(Package name and registry are placeholders — rename in `package.json` and set `publishConfig` once you
know which internal registry this ships to.)

## Quick start

```tsx
import { MiqaatEmbedLogin } from 'miqaat-core-embed-react';

function LoginPanel() {
  return (
    <MiqaatEmbedLogin
      config={{
        coreBaseUrl: 'https://auth.miqaat.com',
        clientId: 'rms-web-prod',
        onSuccess: async ({ transactionId, state, coreAssertion }) => {
          // Forward UNCHANGED to your own backend. Never decode/trust it in the browser.
          await fetch('/auth/core/callback', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ transaction_id: transactionId, state, core_assertion: coreAssertion }),
          });
          window.location.assign('/dashboard');
        },
        onError: (err) => console.warn('sign-in failed', err.code),
      }}
      loading={<Spinner />}
    />
  );
}
```

Your backend then verifies `core_assertion` against Core's JWKS before trusting it — see
`core-authentication/docs/bu-integration-guide.md` §4 for the exact steps, or copy the reference verifier
from `core-authentication/examples/bu-reference-app`.

## Config reference

| Field | Required | Notes |
|---|---|---|
| `coreBaseUrl` | yes | Core Identity issuer, e.g. `https://auth.miqaat.com`. No trailing slash. |
| `clientId` | yes | Your registered federation client id for this app + environment. |
| `onSuccess` | yes | `({ transactionId, state, coreAssertion }) => void`. Forward `coreAssertion` to your backend as-is. |
| `onError` | no | `({ code, transactionId, state }) => void`. Fires on `TRANSACTION_EXPIRED` / `LOGIN_FAILED`. |
| `onTopLevelRequired` | no | Fires when third-party-cookie restrictions block the iframe (see HANDOFF.md). |
| `transaction` | no | See "Two ways to start a transaction" below. Omit for the zero-backend default. |
| `origin` | no | Overrides `window.location.origin`. Rarely needed. |
| `prompt` | no | `'login'` (always show the form) or `'auto'` (silently continue an existing Core session). |

`<MiqaatEmbedLogin>` also takes `className`, `style`, `loading` (node shown before the iframe URL is ready),
and `renderError(message, retry)` (shown if the transaction itself can't be created — a config/network
problem, distinct from a failed login attempt).

## Two ways to start a transaction

**Default — no backend involvement.** The SDK calls `POST {coreBaseUrl}/auth/transaction` itself with your
`clientId`, the page's own origin, and an auto-generated `state`. This is safe because `client_id` isn't a
secret; Core's control is checking the calling origin against what's registered for that client. Nothing
above needs to change for this — it's what happens if you omit `transaction`.

**Backend-owned** — pass `transaction`, either as a ready object or an async function, if you want your own
server to create the transaction first (e.g. to bind it to a session cookie, per
`bu-integration-guide.md` §2):

```tsx
config={{
  coreBaseUrl,
  clientId,
  transaction: async () => {
    const res = await fetch('/api/start-login', { method: 'POST' });
    const { transaction_id, state, login_url } = await res.json();
    return { transactionId: transaction_id, state, loginUrl: login_url };
  },
  onSuccess: /* ... */,
}}
```

## Headless usage: `useMiqaatEmbed`

If you need custom chrome around the iframe (a modal, a specific layout, a micro-frontend host shell),
use the hook directly instead of `<MiqaatEmbedLogin>`:

```tsx
import { useMiqaatEmbed } from 'miqaat-core-embed-react';

function CustomLoginModal({ config }) {
  const { iframeRef, loginUrl, status, error, restart } = useMiqaatEmbed(config);
  if (status === 'error') return <RetryPanel message={error} onRetry={restart} />;
  if (!loginUrl) return <Spinner />;
  return (
    <iframe
      ref={iframeRef}
      src={loginUrl}
      title="Sign in"
      sandbox="allow-scripts allow-forms allow-same-origin allow-storage-access-by-user-activation"
      style={{ width: '100%', height: 560, border: 0 }}
    />
  );
}
```

`<MiqaatEmbedLogin>` is just this hook with a default iframe wrapper — both are exported so you can pick
whichever fits.

## Packaging: plain npm import, not a runtime micro-frontend

This ships as a normal versioned npm package that you `import` and bundle with your app — not as a
Module Federation remote or a runtime-loaded widget. Two reasons:

1. **The security boundary doesn't depend on the packaging.** Whether this component is bundled into your
   app at build time or loaded at runtime, it only ever renders a sandboxed, cross-origin `<iframe>`. Your
   app cannot read into that iframe either way — that's enforced by the browser and by Core's CSP, not by
   how this SDK is distributed.
2. **It's simpler.** A plain dependency avoids Module Federation host/remote version coordination for a
   component that's a thin wrapper around an iframe and a `postMessage` listener.

If a genuine need for runtime loading shows up later (e.g. a non-React host site), the natural next step is
adding a framework-agnostic Web Component / UMD build on top of the same `useMiqaatEmbed` logic — worth a
separate discussion when that requirement is concrete, not before.

## What this SDK deliberately does not do

- Render or configure the credentials form, "Forgot password", or any branding — that's Core's login page,
  inside the iframe, driven by config Core reads from core-authorization. See
  [docs/HANDOFF.md](./docs/HANDOFF.md).
- Decode, verify, or store the assertion. It is handed to `onSuccess` exactly as Core produced it.
- Manage your application's session/cookie after sign-in — that's entirely your backend's responsibility.

## Later (not in v0.1)

- Web Component / UMD build for non-React consumers.
- A helper for the `MIQAAT_AUTH_TOP_LEVEL_REQUIRED` → `display=page` fallback flow (HANDOFF.md has the
  current gap noted).
- Any theming/branding API — intentionally absent until Core has a server-side branding config to surface.
