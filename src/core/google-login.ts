import { isRunningInExpoGo } from 'expo';
import { Platform, TurboModuleRegistry } from 'react-native';
import { calendarScopes, SignInRequired, validClient, type Availability } from './google-session';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
type Sdk = typeof import('@react-native-google-signin/google-signin').GoogleSignin;
let sdk: Sdk | undefined;
let lastToken: string | null = null;

export function availability(): Availability {
  if (isRunningInExpoGo()) {
    return { status: 'unsupported', message: 'Open Timefold in a development build with Google sign-in, or use Timefold on the web.' };
  }
  if (!TurboModuleRegistry.get('RNGoogleSignin')) {
    return { status: 'unsupported', message: 'This version needs an update for Google sign-in. Install a new Timefold build, or use Timefold on the web.' };
  }
  if (!validClient(webClientId) || (Platform.OS === 'ios' && !validClient(iosClientId))) {
    return { status: 'unconfigured', message: 'Google sign-in has not been configured for this build yet.' };
  }
  return null;
}

async function getSdk() {
  if (!sdk) {
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
    GoogleSignin.configure({ webClientId, iosClientId, scopes: calendarScopes });
    sdk = GoogleSignin;
  }
  return sdk;
}

function granted(scopes: string[]) {
  return calendarScopes.every(scope => scopes.includes(scope));
}

export async function restoreAccount() {
  const client = await getSdk();
  const account = await client.signInSilently();
  return account.type === 'success' && granted(account.data.scopes) ? account.data.user.id : null;
}

export async function signInAccount() {
  const client = await getSdk();
  await client.hasPlayServices({ showPlayServicesUpdateDialog: true });
  let account = await client.signIn();
  if (account.type !== 'success') throw new Error('Google sign-in was cancelled.');
  if (!granted(account.data.scopes)) {
    const approval = await client.addScopes({ scopes: calendarScopes });
    if (!approval || approval.type !== 'success' || !granted(approval.data.scopes)) {
      throw new Error('Allow access to your calendar list and events to see them here.');
    }
    account = approval;
  }
  return account.data.user.id;
}

export async function signOutAccount() {
  const client = await getSdk();
  await client.signOut();
  lastToken = null;
}

export async function accessToken(accountId: string, forceRefresh: boolean) {
  const client = await getSdk();
  if (client.getCurrentUser()?.user.id !== accountId) throw new SignInRequired('Sign in to Google again.');
  if (forceRefresh && lastToken) await client.clearCachedAccessToken(lastToken);
  const { accessToken: token } = await client.getTokens();
  if (!token || client.getCurrentUser()?.user.id !== accountId || (forceRefresh && token === lastToken)) {
    throw new SignInRequired('Your Google session expired. Sign in again.');
  }
  lastToken = token;
  return token;
}
