import React, { useState } from 'react';

/**
 * Shown when POST /authorization/session comes back with selection_required: true - the ITS ID holds more
 * than one active miqaat_core role (one per tenant, see LocalSessionService.listRolesForUser). No session
 * cookie exists yet; picking a card and continuing calls POST /authorization/session/select with the
 * pending_token this screen was handed, which is what actually establishes the session, scoped to that
 * role's tenant_id.
 */
export function RoleSelectionPage({ selection, onChoose, onBack, error, submitting }) {
  const [roleId, setRoleId] = useState(selection.roles[0]?.role_id ?? null);

  return (
    <div className="app-shell">
      <aside className="hero">
        <img className="logo" src="/mumin-login-logo.svg" alt="" />
      </aside>
      <main className="panel">
        <div className="card">
          <h1>Where do you want to log in?</h1>
          <p className="subtitle">
            Welcome back, {selection.name}. You&rsquo;ve been assigned more than one role — choose which one to sign in as.
          </p>

          <div className="role-select-list">
            {selection.roles.map((role) => (
              <label key={role.role_id} className={`role-card${roleId === role.role_id ? ' selected' : ''}`}>
                <span className="role-card-icon" aria-hidden="true">
                  🏢
                </span>
                <span className="role-card-text">
                  <span className="role-card-title">{role.tenant_name ?? role.role_name}</span>
                  <span className="role-card-subtitle">{role.role_name}</span>
                </span>
                <input type="radio" name="role_id" value={role.role_id} checked={roleId === role.role_id} onChange={() => setRoleId(role.role_id)} />
              </label>
            ))}
          </div>

          <p className="footnote">To switch roles later, log out and sign in again.</p>

          {error && <p className="err">{error}</p>}

          <div className="role-select-actions">
            <button type="button" className="link-back" onClick={onBack}>
              ← Back to sign in
            </button>
            <button type="button" className="btn btn-continue" disabled={!roleId || submitting} onClick={() => onChoose(roleId)}>
              {submitting ? 'Continuing…' : 'Continue →'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
