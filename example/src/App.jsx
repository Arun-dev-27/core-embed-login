import React, { useEffect, useState } from 'react';
import { MiqaatEmbedLogin } from 'miqaat-core-embed-react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout.jsx';
import { ModulePage } from './ModulePage.jsx';
import { OverviewPage } from './OverviewPage.jsx';
import { RoleSelectionPage } from './RoleSelectionPage.jsx';
import './theme.css';

// core-authentication - the SDK calls it directly (no backend in between) to create the transaction and
// load the iframe. core-authentication answers the browser's CORS preflight for this one endpoint;
// the actual origin-vs-client check still happens server-side, same as it always did.
const CORE_BASE_URL = import.meta.env.VITE_CORE_BASE_URL;
const CLIENT_ID = import.meta.env.VITE_CLIENT_ID;
// core-authorization - the frontend posts the raw core_assertion here directly, and later re-checks
// /session/me with the resulting cookie. Both calls use credentials: 'include' since the session is a
// cross-origin httpOnly cookie, not a bearer token this code ever holds.
const AUTHORIZATION_BASE_URL = import.meta.env.VITE_AUTHORIZATION_BASE_URL;

function Hero() {
  return (
    <aside className="hero">
      <img className="logo" src="/mumin-login-logo.svg" alt="" />
      <div className="hero-divider">
        <span className="line" />
        <span>۞</span>
        <span className="line right" />
      </div>
      <img className="ahlan" src="/ahlan-wa-sahlan.png" alt="Ahlan wa Sahlan — welcome" />
      <p className="tagline">Your Miqaat, in one place</p>
    </aside>
  );
}

function LoginPage({ onSuccess, onError, error, verifying, attempt, onRetry }) {
  return (
    <div className="app-shell">
      <Hero />
      <main className="panel">
        <div className="card">
          <h1>Login to Continue</h1>
          <p className="subtitle">Use your ITS credentials to access the portal</p>

          <MiqaatEmbedLogin
            key={attempt}
            // prompt: 'login' - this app's own local session (miqaat_core.user_sessions) is the only thing
            // that decides "signed in" here. Without this, Core's own SSO session would show its "Continue
            // as X" screen after we sign out locally, since core-authentication's federation session is
            // a separate cookie this app never touches - see the logout flow below.
            config={{ coreBaseUrl: CORE_BASE_URL, clientId: CLIENT_ID, prompt: 'login', onSuccess, onError }}
            loading={<p className="footnote">Starting sign-in…</p>}
            renderError={(message, retry) => (
              <div className="state-panel">
                <p className="err">{message}</p>
                <button className="btn" onClick={retry}>
                  Retry
                </button>
              </div>
            )}
            className="embed-frame"
          />

          {verifying && <p className="footnote">Verifying with the backend…</p>}

          {error && (
            <div className="state-panel">
              <p className="err">Sign-in failed: {error.code}</p>
              <button className="btn" onClick={onRetry}>
                Try again
              </button>
            </div>
          )}

          <p className="footnote">
            Host {window.location.origin} · client {CLIENT_ID}
          </p>
        </div>
      </main>
    </div>
  );
}

export function App() {
  const [attempt, setAttempt] = useState(0);
  const [checkingSession, setCheckingSession] = useState(true);
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [verifying, setVerifying] = useState(false);
  // Set only when POST /authorization/session comes back selection_required: true - the ITS ID holds more
  // than one miqaat_core role. No cookie exists yet; { pendingToken, name, roles } drives RoleSelectionPage.
  const [pendingSelection, setPendingSelection] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const [selectError, setSelectError] = useState(null);
  const navigate = useNavigate();

  // On load: is there already a valid local session cookie? If so, skip straight to the dashboard -
  // this is the "next time the user opens the login it should be redirected to the dashboard" behaviour.
  useEffect(() => {
    let cancelled = false;
    fetch(`${AUTHORIZATION_BASE_URL}/authorization/session/me`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled) return;
        if (body?.verified) {
          setSession(body);
          navigate('/dashboard', { replace: true });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSuccess(payload) {
    setError(null);
    setVerifying(true);
    try {
      // Forward the assertion UNCHANGED, straight to core-authorization. It verifies the RS256 signature
      // against core-authentication's JWKS, establishes the local session, and sets its cookie.
      const res = await fetch(`${AUTHORIZATION_BASE_URL}/authorization/session`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ core_assertion: payload.coreAssertion }),
      });
      const body = await res.json();
      if (!res.ok || !body.verified) throw new Error(body.error || body.message || 'Verification failed');
      if (body.selection_required) {
        // Multiple roles (tenants): hold off on the dashboard until the user picks one via /session/select.
        setPendingSelection({ pendingToken: body.pending_token, itsId: body.its_id, name: body.name, roles: body.roles });
        return;
      }
      setSession(body);
      navigate('/dashboard');
    } catch (e) {
      setError({ code: e.message });
    } finally {
      setVerifying(false);
    }
  }

  function onError(err) {
    setError(err);
  }

  function retry() {
    setError(null);
    setAttempt((n) => n + 1); // remounts <MiqaatEmbedLogin>, forcing a fresh transaction
  }

  async function chooseRole(roleId) {
    setSelectError(null);
    setSelecting(true);
    try {
      const res = await fetch(`${AUTHORIZATION_BASE_URL}/authorization/session/select`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pending_token: pendingSelection.pendingToken, role_id: roleId }),
      });
      const body = await res.json();
      if (!res.ok || !body.verified) throw new Error(body.error || body.message || 'Could not sign in with that role');
      setPendingSelection(null);
      setSession(body);
      navigate('/dashboard');
    } catch (e) {
      setSelectError(e.message);
    } finally {
      setSelecting(false);
    }
  }

  function cancelSelection() {
    setPendingSelection(null);
    setSelectError(null);
    setAttempt((n) => n + 1); // the burned pending_token can't be reused - a fresh login is required
  }

  async function signOut() {
    await fetch(`${AUTHORIZATION_BASE_URL}/authorization/session/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    setSession(null);
    setAttempt((n) => n + 1);
    navigate('/');
  }

  if (checkingSession) {
    return (
      <div className="app-shell">
        <Hero />
        <main className="panel">
          <div className="card">
            <p className="footnote">Checking for an existing session…</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          session ? (
            <Navigate to="/dashboard" replace />
          ) : pendingSelection ? (
            <RoleSelectionPage selection={pendingSelection} onChoose={chooseRole} onBack={cancelSelection} error={selectError} submitting={selecting} />
          ) : (
            <LoginPage onSuccess={onSuccess} onError={onError} error={error} verifying={verifying} attempt={attempt} onRetry={retry} />
          )
        }
      />
      <Route path="/dashboard" element={session ? <DashboardLayout session={session} onSignOut={signOut} /> : <Navigate to="/" replace />}>
        <Route index element={<OverviewPage session={session} />} />
        <Route path=":code" element={<ModulePage session={session} />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
