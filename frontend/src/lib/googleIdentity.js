// CLIENT-SIDE-ONLY demo integration. Production must send credentials to a backend for signature verification with Google's public keys before trusting claims or creating an authenticated session; client-side decoding is not secure identity verification.

const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';
let scriptPromise;
let initializedClientId = '';
let activeHandlers = null;
let activeAttempt = 0;

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GOOGLE_IDENTITY_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.id) resolve(window.google.accounts.id);
      else reject(new Error('Google Identity Services did not initialize.'));
    };
    script.onerror = () => reject(new Error('Google Identity Services failed to load.'));
    document.head.appendChild(script);
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
}

export function preloadGoogleIdentityServices() {
  return loadGoogleIdentityServices();
}

export function decodeGoogleCredential(credential) {
  const payload = credential?.split('.')[1];
  if (!payload) throw new Error('Google returned an invalid credential.');

  const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
  const binaryPayload = window.atob(normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '='));
  const bytes = Uint8Array.from(binaryPayload, (character) => character.charCodeAt(0));
  const claims = JSON.parse(new TextDecoder().decode(bytes));
  if (!claims.email) throw new Error('Google did not return an email address.');
  return claims;
}

export async function startGoogleSignIn({ onSuccess, onError }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    onError("Google sign-in isn't configured yet. Add VITE_GOOGLE_CLIENT_ID to the frontend environment.");
    return;
  }

  const attempt = ++activeAttempt;
  activeHandlers = { onSuccess, onError, completed: false };

  try {
    const identity = await loadGoogleIdentityServices();
    if (attempt !== activeAttempt) return;

    if (initializedClientId !== clientId) {
      identity.initialize({
        client_id: clientId,
        auto_select: false,
        cancel_on_tap_outside: true,
        callback: (response) => {
          const handlers = activeHandlers;
          if (!handlers || !response?.credential) {
            handlers?.onError('Google sign-in did not return a credential. Please try again.');
            return;
          }

          try {
            handlers.completed = true;
            handlers.onSuccess(decodeGoogleCredential(response.credential));
          } catch {
            handlers.onError('Google sign-in could not be completed. Please try again.');
          }
        },
      });
      initializedClientId = clientId;
    }

    identity.prompt((notification) => {
      if (attempt !== activeAttempt || activeHandlers?.completed) return;
      const wasNotDisplayed = notification.isNotDisplayed?.();
      const wasSkipped = notification.isSkippedMoment?.();
      const wasDismissed = notification.isDismissedMoment?.();

      if (wasNotDisplayed) {
        activeHandlers?.onError('Google sign-in could not be opened. Check your browser settings and try again.');
      } else if (wasSkipped || wasDismissed) {
        activeHandlers?.onError('Google sign-in was cancelled.');
      }
    });
  } catch {
    if (attempt === activeAttempt) {
      activeHandlers?.onError('Google sign-in could not be loaded. Check your connection and try again.');
    }
  }
}

export function getPostLoginRedirect() {
  const urlRedirect = new URLSearchParams(window.location.search).get('redirect');
  let storedRedirect = null;
  try {
    storedRedirect = sessionStorage.getItem('novashop_redirect_after_login');
    sessionStorage.removeItem('novashop_redirect_after_login');
  } catch {
    // Storage can be unavailable; use the URL or default destination.
  }
  return urlRedirect || storedRedirect || '/account';
}