# Timefold

Timefold is a local-first daily notebook and calendar built with Expo and React Native. Capture notes and tasks, schedule them on a timeline, and optionally connect Google Calendar.

## What it does

- Write daily notes and tasks, and drag scheduled items into the calendar.
- Browse day, week, month, and year views, or use the notebook and day timeline side by side.
- Connect Google Calendar to see its events and optionally sync scheduled Timefold items to the primary Google calendar.
- Set local reminders on supported Android and iOS builds, and export or restore a notes backup.

Notes are stored on the device. Google Calendar syncing requires a Google account, permission to read and manage calendar events, and network access. While task syncing is enabled, Timefold updates or removes the Google events it created when the corresponding Timefold items change. Sync ownership records are device-local and are not included in note backups.

## Get started

Install [Bun](https://bun.sh/) and dependencies:

```sh
bun install --frozen-lockfile
bunx expo start
```

Use Expo Go for the notebook and internal calendar, or create a development build for Google sign-in and native features. Google sign-in is unavailable in Expo Go. Google Calendar setup, client IDs, and platform build instructions are in [GOOGLE-CALENDAR.md](GOOGLE-CALENDAR.md).

The included Expo project owner, project ID, Android package, and build profiles belong to this app. If you fork Timefold and create your own builds, configure your own Expo project, application identifiers, signing credentials, and Google OAuth clients.

## Checks

```sh
bun test
bunx tsc --noEmit
bunx expo lint
```

The current main screen has known lint errors. Android Google Calendar sync has been exercised with a development build; iOS and standalone sync need device verification.

## Contributing

Issues and pull requests are welcome. Explain the change, include steps to reproduce a bug, and run the checks relevant to your contribution. Never include calendar data, OAuth tokens, signing keys, personal backups, or `.env.local` in a report or pull request.

## License

Timefold is available under the [MIT License](LICENSE). The license preserves the Expo template copyright notice.
