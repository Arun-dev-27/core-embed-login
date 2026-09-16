import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { MODULE_META } from './modules.js';

/**
 * Sidebar entries are filtered to session.modules - a module the role has no role_permissions grant for
 * (real DB data, see local-session.service.ts's getModulePermissions) simply doesn't appear, per "based on
 * permission it should show or don't show." Dashboard itself is never gated (see that service's note).
 */
export function DashboardLayout({ session, onSignOut }) {
  const visibleModules = MODULE_META.filter((m) => session.modules.includes(m.code));

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/mumin-login-logo.svg" alt="" />
          <span>Core Admin</span>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" end className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            Dashboard
          </NavLink>
          {visibleModules.map((m) => (
            <NavLink key={m.code} to={`/dashboard/${m.code}`} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              {m.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <p className="sidebar-user-name">{session.name}</p>
            <p className="sidebar-user-role">{session.role.name}</p>
          </div>
          <button className="btn btn-ghost" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="dashboard-content">
        <Outlet />
      </main>
    </div>
  );
}
