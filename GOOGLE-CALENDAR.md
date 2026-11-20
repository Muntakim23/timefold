# Connect Timefold to Google Calendar

Use a Google Cloud project you control. In [Google Cloud Console](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com), enable the **Google Calendar API**. In **Google Auth Platform**, configure the app name, contact email and audience. For an external app in testing, add the Google accounts you plan to use as test users. Under **Data Access** add:

- `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
- `https://www.googleapis.com/auth/calendar.events.readonly`
- `https://www.googleapis.com/auth/calendar.events.owned`

In **Clients**, create each client type that you want to run, in that same project:

| Client type | Registration |
| --- | --- |
| Web application | Add the exact **Authorized JavaScript origin**, e.g. `http://localhost:8081` for desktop development or your deployed HTTPS origin. This client ID is also used by the native SDK. |
| Android | Register package `app.timefold.mobile` and the SHA-1 fingerprint of the certificate that actually signs your install. For an Expo development build, consult the project's Android credentials in Expo. Register a separate Android client for each signing certificate, including the Play app signing certificate if applicable. |
| iOS | Register bundle ID `app.timefold.mobile` and copy its iOS client ID. The Expo config derives the callback scheme from this ID. |

Copy `.env.example` to `.env.local` and fill in the **public client IDs**. Set the same variables in the EAS environment used for native builds. No client secret is used by Timefold. Android selects its registered client by package and certificate.

The previously built Android development APK has signing certificate SHA-1 `D3:79:13:0A:D0:7B:5D:15:94:F8:B9:44:09:82:D8:FE:8C:AC:E2:0F`. Use this fingerprint only for builds signed with that same key; verify the certificate again if you change signing credentials.

**Web** — Run `bunx expo start --web --port 8081` and open `http://localhost:8081` on the computer. For a phone browser, use a registered HTTPS web origin. A LAN IP over plain HTTP is unsuitable for Google web sign-in. The access token stays in browser memory. After a reload or token expiry, sign in again.

**Android / iOS** — Build the new native client with `bunx eas-cli build --profile development --platform android` or `bunx eas-cli build --profile development --platform ios` after setting the client IDs. Install it and run `bunx expo start --dev-client --host lan`. The Google SDK restores authorized accounts and manages native tokens. Expo Go and older Timefold builds lack this native SDK.

In Timefold, open **Settings → Google Calendar**, sign in and allow calendar access. Select a calendar containing a known event. To send scheduled Timefold tasks to the primary Google calendar, turn on **Sync tasks to Google**. Timefold creates, updates, and deletes only events it created for those tasks. Disconnecting signs out locally and stops syncing. To withdraw the Google grant, remove Timefold from [Google Account connections](https://myaccount.google.com/connections).

See [Expo's Google sign-in guide](https://docs.expo.dev/guides/google-authentication/) and [Google's browser authorization guide](https://developers.google.com/identity/oauth2/web/guides/use-token-model).
