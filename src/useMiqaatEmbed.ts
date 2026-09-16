import { useCallback, useEffect, useRef, useState } from 'react';
import type { MiqaatEmbedConfig, ProvidedTransaction } from './types';

export type MiqaatEmbedStatus = 'starting' | 'ready' | 'error';

export interface UseMiqaatEmbedResult {
  /** Attach to the <iframe> that will host Core's login page. */
  iframeRef: React.RefObject<HTMLIFrameElement>;
  loginUrl: string | null;
  status: MiqaatEmbedStatus;
  error: string | null;
  /** Discard the current transaction and start a new one (e.g. after TRANSACTION_EXPIRED). */
  restart: () => void;
}

function randomState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

type StartTransactionConfig = Pick<MiqaatEmbedConfig, 'coreBaseUrl' | 'clientId' | 'transaction' | 'origin' | 'prompt'>;

async function startTransaction(config: StartTransactionConfig, signal: AbortSignal): Promise<ProvidedTransaction> {
  if (config.transaction) {
    return typeof config.transaction === 'function' ? config.transaction() : config.transaction;
  }
  const origin = config.origin ?? window.location.origin;
  const state = randomState();
  const res = await fetch(`${config.coreBaseUrl}/auth/transaction`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: config.clientId, state, origin, display: 'embed', ...(config.prompt ? { prompt: config.prompt } : {}) }),
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || typeof body.transaction_id !== 'string' || typeof body.login_url !== 'string') {
    throw new Error(body.message || body.error || 'Could not start sign-in');
  }
  return { transactionId: body.transaction_id, state, loginUrl: body.login_url };
}

/**
 * Headless embed logic: creates/refreshes the login transaction and relays Core's postMessage handoff.
 * Use <MiqaatEmbedLogin> for the batteries-included iframe, or call this directly to render your own chrome
 * around the iframe (e.g. inside a modal, a dedicated route, or a micro-frontend host shell).
 *
 * This hook never sees credentials and never decodes or verifies `coreAssertion` — that is your backend's job.
 */
export function useMiqaatEmbed(config: MiqaatEmbedConfig): UseMiqaatEmbedResult {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pending = useRef<{ transactionId: string; state: string } | null>(null);
  // Guards against React 18 StrictMode's dev-only double-invoke of effects (mount -> cleanup -> mount):
  // without this, two /auth/transaction calls fire and both succeed, wasting one and racing over state.
  const attemptRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<MiqaatEmbedStatus>('starting');
  const [error, setError] = useState<string | null>(null);

  const { onSuccess, onError, onTopLevelRequired, coreBaseUrl, clientId, transaction, origin, prompt } = config;
  const identityOrigin = new URL(coreBaseUrl).origin;

  const restart = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const attempt = ++attemptRef.current;

    pending.current = null;
    setLoginUrl(null);
    setStatus('starting');
    setError(null);

    startTransaction({ coreBaseUrl, clientId, transaction, origin, prompt }, controller.signal)
      .then((txn) => {
        if (attemptRef.current !== attempt) return; // superseded by a later restart() - ignore this result
        pending.current = { transactionId: txn.transactionId, state: txn.state };
        setLoginUrl(txn.loginUrl);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (attemptRef.current !== attempt || (err instanceof DOMException && err.name === 'AbortError')) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Could not start sign-in');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coreBaseUrl, clientId, transaction, origin, prompt]);

  useEffect(() => {
    restart();
    return () => controllerRef.current?.abort();
  }, [restart]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== identityOrigin) return; // exact Core origin only, never "*"
      const iframe = iframeRef.current;
      if (!iframe || event.source !== iframe.contentWindow) return; // this iframe only
      const data = event.data;
      const current = pending.current;
      if (!data || !current || data.transaction_id !== current.transactionId) return;

      switch (data.type) {
        case 'MIQAAT_AUTH_RESIZE':
          iframe.style.height = `${Math.min(Math.max(Number(data.height) || 0, 320), 1200)}px`;
          return;
        case 'MIQAAT_AUTH_TOP_LEVEL_REQUIRED':
          onTopLevelRequired?.();
          return;
        case 'MIQAAT_AUTH_ERROR':
          onError?.({ code: data.error, transactionId: data.transaction_id ?? null, state: data.state ?? null });
          return;
        case 'MIQAAT_AUTH_SUCCESS':
          if (data.state !== current.state || typeof data.core_assertion !== 'string') return;
          pending.current = null; // single use: further messages for this transaction are ignored
          onSuccess({ transactionId: data.transaction_id, state: data.state, coreAssertion: data.core_assertion });
          return;
        default:
          return;
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [identityOrigin, onSuccess, onError, onTopLevelRequired]);

  return { iframeRef, loginUrl, status, error, restart };
}
