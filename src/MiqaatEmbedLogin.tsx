import React from 'react';
import { useMiqaatEmbed } from './useMiqaatEmbed';
import type { MiqaatEmbedConfig } from './types';

export interface MiqaatEmbedLoginProps {
  config: MiqaatEmbedConfig;
  className?: string;
  style?: React.CSSProperties;
  /** Rendered while the transaction is being created, before the iframe has a URL. */
  loading?: React.ReactNode;
  /** Rendered when the transaction could not be created at all (network/config error — not a failed login). */
  renderError?: (message: string, retry: () => void) => React.ReactNode;
}

/**
 * Drop-in embedded sign-in. Renders Core's login page in a sandboxed iframe and calls `config.onSuccess`
 * with the raw assertion once the user signs in. Everything that happens inside the iframe — the
 * credentials form, password handling, "Forgot password", branding — is rendered and controlled entirely
 * by Core; this component only manages the transaction and relays the postMessage handoff. See
 * docs/HANDOFF.md for how the two pieces fit together.
 */
export function MiqaatEmbedLogin({ config, className, style, loading = null, renderError }: MiqaatEmbedLoginProps) {
  const { iframeRef, loginUrl, status, error, restart } = useMiqaatEmbed(config);

  if (status === 'error') {
    return renderError ? <>{renderError(error ?? 'Sign-in is unavailable', restart)}</> : null;
  }
  if (!loginUrl) return <>{loading}</>;

  return (
    <iframe
      ref={iframeRef}
      title="Miqaat sign in"
      src={loginUrl}
      referrerPolicy="origin"
      allow="storage-access"
      sandbox="allow-scripts allow-forms allow-same-origin allow-storage-access-by-user-activation"
      className={className}
      style={{ width: '100%', height: 560, border: 0, ...style }}
    />
  );
}
