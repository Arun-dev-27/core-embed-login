# Example: verifying `miqaat-core-embed-react` locally

A minimal Vite + React host app that imports the SDK from the parent folder and renders
`<MiqaatEmbedLogin>` against a locally running `core-authentication` (+ `core-authorization`, which
`core-authentication` reads client/origin config from).

This is the "second project" you need to see the iframe actually load — the SDK itself is a library with
nothing to run on its own.

## 1. Bring up Core Identity + Core Authorization

In two more terminals, from `core-authentication/` and `core-authorization/` respectively (each already
has an `.env`):

```bash
# both repos
npm run infra:up        # docker compose: postgres + redis (+ localstack for authn's signing key secret)
npm run migration:run

# core-authentication only
npm run keys:generate    # writes the local RS256 signing keyset into localstack Secrets Manager
npm run seed:dev-users   # creates a dev user you can actually sign in with

# core-authorization only
npm run seed             # seeds the catalog (business units, applications, roles) if you haven't already
```

Then start both services:

```bash
# core-authorization
npm run start:dev        # http://localhost:3002

# core-authentication
npm run start:dev        # http://localhost:3001
```

## 2. Register this example's origin as an allowed embed origin

From `core-authorization/`:

```bash
npm run client -- show rms-web-dev               # confirm the dev client already exists and is ACTIVE
npm run client -- origins add rms-web-dev http://localhost:5175
```

`rms-web-dev` already exists if you've used `core-authentication/examples/embed-playground` before — if
not, create it first via the Clients API/CLI per `core-authorization/docs/onboarding-new-application.md`.

## 3. Install and run this example

From `core-embed-react/` (the SDK root, one level up):

```bash
npm run build            # rebuild the SDK's dist/ — the example imports it via file:..
cd example
npm install
npm run dev               # http://localhost:5175
```

## 4. What you should see

Open `http://localhost:5175`. The page should mount an iframe served from `http://localhost:3001/embed/login`
— that confirms the SDK correctly called `POST http://localhost:3001/auth/transaction` and put the
returned `login_url` in the iframe. Sign in with the user created by `seed:dev-users`. On success you'll see
the raw `onSuccess` payload (`transactionId`, `state`, `coreAssertion`) plus a client-side-decoded (not
verified) view of the JWT for sanity-checking `iss`/`aud`/`kid`/`sub`.

To see the *real* backend-verification half of the flow (JWKS fetch, signature check, replay protection),
run `core-authentication/examples/embed-playground` side by side instead of/alongside this example — it
does the same iframe embed without the SDK and additionally verifies the assertion and calls
core-authorization's `/authorization/check`.

## Troubleshooting

- **Iframe shows "Unable to start sign-in" / origin not allowed** — step 2 wasn't done, or you're running
  the example on a different port than `5175`.
- **`fetch` to `/auth/transaction` fails outright (network error, no response)** — `core-authentication`
  isn't running on `:3001`, or `core-authorization` isn't running on `:3002` (Core reads client config from
  it on every transaction).
- **Iframe loads but shows Core's own error page instead of a form** — check the `core-authentication`
  terminal log; the `code` in the rendered page usually names the exact `DomainError` (e.g.
  `CLIENT_INACTIVE`, `ORIGIN_NOT_ALLOWED`).
