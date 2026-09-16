/** The complete, still-opaque handoff from Core. Never decoded in the browser — forward it to your backend as-is. */
export interface MiqaatAssertionPayload {
  transactionId: string;
  state: string;
  /** Compact JWS: header.payload.signature. Verify this server-side against Core's JWKS. */
  coreAssertion: string;
}

export interface MiqaatAuthError {
  /** e.g. TRANSACTION_EXPIRED, LOGIN_FAILED */
  code: string;
  transactionId: string | null;
  state: string | null;
}

export interface ProvidedTransaction {
  transactionId: string;
  state: string;
  /** The complete `{coreBaseUrl}/embed/login?...` URL returned by POST /auth/transaction. */
  loginUrl: string;
}

export interface MiqaatEmbedConfig {
  /** Core Identity issuer, e.g. "https://auth.miqaat.com" (no trailing slash). */
  coreBaseUrl: string;
  /** Federation client id registered in core-authorization for this app + environment, e.g. "rms-web-prod". */
  clientId: string;
  /**
   * How the login transaction is created. Two supported modes:
   *
   * - Omit this entirely (default / "self" mode): the SDK calls `POST {coreBaseUrl}/auth/transaction`
   *   itself from the browser, using `origin` (auto-detected from `window.location.origin`) and an
   *   auto-generated `state`. `client_id` is not a secret, and Core validates the calling origin against
   *   the origins registered for this client, so no backend involvement is required to start sign-in.
   *
   * - Pass an object or an async function ("provided" mode): your own backend already called
   *   `POST /auth/transaction` (see core-authentication/docs/bu-integration-guide.md §2) and you are
   *   handing the SDK the result. Use this if you want the transaction correlated with your own
   *   backend session/CSRF cookie before the iframe ever loads.
   */
  transaction?: ProvidedTransaction | (() => Promise<ProvidedTransaction>);
  /** Overrides window.location.origin when creating a transaction in "self" mode. Rarely needed. */
  origin?: string;
  /** 'login' always shows the credentials form; 'auto' silently continues an existing Core session when possible. */
  prompt?: 'login' | 'auto';
  /** Called once, exactly one time per successful sign-in, with the raw assertion to forward to your backend. */
  onSuccess: (payload: MiqaatAssertionPayload) => void;
  /** Called when Core reports the transaction expired or sign-in failed inside the iframe. */
  onError?: (error: MiqaatAuthError) => void;
  /**
   * Called when the iframe can't use storage (Safari ITP and similar) and Core is asking to continue in
   * a top-level page instead of the iframe. If omitted, the SDK does nothing further — the user still
   * sees Core's own "Continue in a full window" prompt inside the iframe, but no navigation happens
   * unless you handle this. See docs/HANDOFF.md for the top-level (display=page) fallback flow.
   */
  onTopLevelRequired?: () => void;
}
