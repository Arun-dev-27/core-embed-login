// Static menu metadata (code -> label), matching the miqaat_core.modules seed data (Core Admin Control
// Panel DBML). The backend decides WHICH of these a session may see (session.modules/permissions,
// computed from real role_permissions grants); this list only supplies presentation for whatever comes back.
export const MODULE_META = [
  { code: 'role', label: 'Role Management' },
  { code: 'usr', label: 'User Management' },
  { code: 'bum', label: 'Business Unit Management' },
  { code: 'utm', label: 'Utility Management' },
  { code: 'cfg', label: 'Configuration' },
  { code: 'mum', label: 'Mumin Information' },
  { code: 'dce', label: 'Data Contract & Exchange Management' },
  { code: 'mon', label: 'Monitoring' },
  { code: 'aud', label: 'Audit Log' },
  { code: 'tkt', label: 'Ticket Management' },
];

export function moduleLabel(code) {
  return MODULE_META.find((m) => m.code === code)?.label ?? code;
}
