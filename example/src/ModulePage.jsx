import React from 'react';
import { useParams } from 'react-router-dom';
import { moduleLabel } from './modules.js';

const ACTIONS = ['create', 'read', 'update', 'approve'];

/** Dummy content: the real module screen for `code` isn't implemented - this only proves which actions this role holds. */
export function ModulePage({ session }) {
  const { code } = useParams();
  const granted = session.permissions[code] ?? {};
  return (
    <div>
      <h2>{moduleLabel(code)}</h2>
      <p className="subtitle">Not implemented in this demo - shown only because this role holds a permission here.</p>
      <div className="badge-row">
        {ACTIONS.filter((a) => a in granted).map((a) => (
          <span key={a} className={`badge ${granted[a] ? 'badge-on' : 'badge-off'}`}>
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}
