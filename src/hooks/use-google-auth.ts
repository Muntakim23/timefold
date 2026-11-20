import { useCallback, useEffect, useRef, useState } from 'react';
import { accessToken, availability, restoreAccount, signInAccount, signOutAccount } from '../core/google-login';
import { SignInRequired } from '../core/google-session';

type Status = 'loading' | 'unconfigured' | 'unsupported' | 'signedOut' | 'signingIn' | 'signedIn';
type State = { status: Status; message: string; accountId: string | null };
const signedOut: State = { status: 'signedOut', message: '', accountId: null };

function failure(error: unknown) {
  if (error instanceof Error && 'code' in error) {
    if (String(error.code) === '10' || error.message.includes('DEVELOPER_ERROR')) {
      return 'Google did not recognize this build. Check the Android client and signing certificate in Google Cloud.';
    }
    return 'Google sign-in was interrupted. Check your connection and try again.';
  }
  return error instanceof Error ? error.message : 'Could not sign in with Google. Try again.';
}

export function useGoogleAuth() {
  const [state, setState] = useState<State>({ status: 'loading', message: '', accountId: null });
  const account = useRef<string | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);

  const setAccount = useCallback((id: string | null, message = '') => {
    account.current = id;
    setState({ accountId: id, status: id ? 'signedIn' : 'signedOut', message });
  }, []);

  useEffect(() => {
    let mounted = true;
    const generationRef = generation;
    const blocked = availability();
    void Promise.resolve().then(async () => {
      if (!mounted) return;
      if (blocked) { setState({ ...blocked, accountId: null }); return; }
      try {
        const id = await restoreAccount();
        if (mounted) setAccount(id);
      } catch (error) {
        if (mounted) setAccount(null, failure(error));
      }
    });
    return () => { mounted = false; generationRef.current++; };
  }, [setAccount]);

  const signIn = useCallback(async () => {
    if (busy.current || availability()) return;
    busy.current = true;
    const request = ++generation.current;
    setState({ ...signedOut, status: 'signingIn', message: 'Waiting for Google…' });
    try {
      const id = await signInAccount();
      if (generation.current === request) setAccount(id);
    } catch (error) {
      if (generation.current === request) setAccount(null, failure(error));
    } finally { busy.current = false; }
  }, [setAccount]);

  const signOut = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const request = ++generation.current;
    try {
      await signOutAccount();
      if (generation.current === request) setAccount(null);
    } catch {
      if (generation.current === request) setAccount(account.current, 'Could not disconnect from Google. Try again.');
      throw new Error('Could not disconnect from Google.');
    } finally { busy.current = false; }
  }, [setAccount]);

  const getAccessToken = useCallback(async (forceRefresh = false) => {
    const id = account.current;
    if (!id) throw new SignInRequired('Sign in with Google to continue.');
    try { return await accessToken(id, forceRefresh); }
    catch (error) {
      if (error instanceof SignInRequired && account.current === id) setAccount(null, error.message);
      throw error;
    }
  }, [setAccount]);

  return { ...state, signIn, signOut, getAccessToken };
}
