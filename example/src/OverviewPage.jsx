import React from 'react';

export function OverviewPage({ session }) {
  return (
    <div>
      <h2>Welcome, {session.name}</h2>
      <p className="subtitle">Reload this page - the local session cookie keeps you here, no sign-in required.</p>
      <h3>Signed in as</h3>
      <pre>{JSON.stringify({ its_id: session.its_id, email: session.email, status: session.status }, null, 2)}</pre>
      <h3>Role (miqaat_core.user_roles)</h3>
      <pre>{JSON.stringify(session.role, null, 2)}</pre>
      <h3>Modules visible to this role (real role_permissions grants, not hardcoded)</h3>
      <pre>{JSON.stringify(session.permissions, null, 2)}</pre>
    </div>
  );
}
