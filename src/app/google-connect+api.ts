import { calendarScopes, validClient } from '../core/google-session';

// Google needs its opener on this page. The notebook keeps its stronger isolation for SQLite.
const headers = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Cross-Origin-Embedder-Policy': 'unsafe-none',
  'Cache-Control': 'no-store',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin',
};

export function GET() {
  const id = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  if (!validClient(id)) return new Response('Google sign-in has not been configured.', { status: 503, headers });
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect Google Calendar · Timefold</title>
<style>:root{color-scheme:light dark}body{font:16px system-ui;margin:0;display:grid;min-height:100dvh;place-items:center}main{max-width:23rem;padding:2rem}h1{font-size:1.5rem}button{font:inherit;padding:.7rem 1.2rem;border-radius:.65rem;cursor:pointer}p{line-height:1.5}</style>
<main><h1>Connect Google Calendar</h1><p id="status" role="status">Timefold will ask to read your calendars and manage events in calendars you own, so it can sync your tasks.</p><button id="choose" disabled>Choose a Google account</button></main>
<script>
window.opener = null;
const nonce = location.hash.slice(1);
const button = document.getElementById('choose');
const statusText = document.getElementById('status');
if (/^[0-9a-f-]{36}$/i.test(nonce)) {
  const channel = new BroadcastChannel('timefold-google-' + nonce);
  let completed = false;
  const finish = result => {
    if (completed) return;
    completed = true;
    channel.postMessage(result);
    channel.close();
    button.disabled = true;
    statusText.textContent = result.error || 'Return to Timefold to see your calendars.';
    window.close();
  };
  window.addEventListener('pagehide', () => { if (!completed) channel.postMessage({ error: 'Google sign-in was cancelled.' }); });
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.onload = () => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: ${JSON.stringify(id)}, scope: ${JSON.stringify(['openid', ...calendarScopes].join(' '))},
      include_granted_scopes: false,
      callback: grant => grant.error ? finish({error: 'Calendar access was declined.'}) : finish({grant}),
      error_callback: error => finish({error: error.type === 'popup_closed' ? 'Google sign-in was cancelled.' : 'Allow pop-ups for Timefold and try again.'})
    });
    button.disabled = false;
    button.onclick = () => { button.disabled = true; client.requestAccessToken({ prompt: 'select_account' }); };
  };
  script.onerror = () => finish({error: 'Could not reach Google sign-in. Check your connection and try again.'});
  document.head.appendChild(script);
} else { statusText.textContent = 'Start Google sign-in from Settings in Timefold.'; }
</script></html>`, { headers });
}
