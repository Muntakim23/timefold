import { calendarScopes, SignInRequired, validClient, type Availability } from './google-session';

type Grant = { access_token?: string; scope?: string; expires_in?: number | string };
const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
let session: { accountId: string; token: string; expires: number } | undefined;

export function availability(): Availability {
  if (!validClient(clientId)) return { status: 'unconfigured', message: 'Google sign-in has not been configured for Timefold on the web yet.' };
  if (typeof window !== 'undefined' && (!window.isSecureContext || !window.BroadcastChannel)) {
    return { status: 'unsupported', message: 'Open Timefold in a recent browser over HTTPS, or on localhost on your computer, to sign in with Google.' };
  }
  return null;
}

export async function restoreAccount() {
  return session && session.expires > Date.now() ? session.accountId : null;
}

// SQLite requires cross-origin isolation on the notebook page. The Google chooser runs
// on a separate same-origin page and hands its result back to this particular attempt.
function requestGrant(): Promise<Grant> {
  const nonce = crypto.randomUUID();
  const channel = new BroadcastChannel('timefold-google-' + nonce);
  return new Promise((resolve, reject) => {
    const finish = () => { clearTimeout(timeout); channel.close(); };
    const timeout = setTimeout(() => {
      finish();
      reject(new Error('Google sign-in timed out. Try again.'));
    }, 180000);
    channel.onmessage = event => {
      finish();
      if (event.data?.grant) resolve(event.data.grant);
      else reject(new Error(event.data?.error || 'Google sign-in was cancelled.'));
    };
    const popup = window.open('/google-connect#' + nonce, '_blank', 'popup,width=480,height=640');
    if (!popup) {
      finish();
      reject(new Error('Allow pop-ups for Timefold and try again.'));
    }
  });
}

export async function signInAccount() {
  const grant = await requestGrant();
  const expiresIn = Number(grant.expires_in);
  if (!grant.access_token || !Number.isFinite(expiresIn) || expiresIn <= 0 || !calendarScopes.every(scope => grant.scope?.split(' ').includes(scope))) {
    throw new Error('Allow access to your calendar list and events to see them here.');
  }
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: 'Bearer ' + grant.access_token },
  });
  if (!response.ok) throw new Error('Google could not confirm your account. Sign in again.');
  const { sub } = await response.json();
  if (typeof sub !== 'string' || !sub) throw new Error('Google could not confirm your account.');
  session = { accountId: sub, token: grant.access_token, expires: Date.now() + expiresIn * 1000 };
  return sub;
}

export async function signOutAccount() {
  session = undefined;
}

export async function accessToken(accountId: string, forceRefresh: boolean) {
  if (!session || session.accountId !== accountId) throw new SignInRequired('Sign in with Google to continue.');
  if (forceRefresh || session.expires <= Date.now() + 30000) {
    session = undefined;
    throw new SignInRequired('Your Google session expired. Sign in again.');
  }
  return session.token;
}
