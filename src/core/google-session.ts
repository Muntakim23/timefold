export const calendarScopes = [
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.events.owned',
];

export type Availability = { status: 'unsupported' | 'unconfigured'; message: string } | null;

/** The account no longer has a usable credential. Interactive consent is required. */
export class SignInRequired extends Error {}

export function validClient(id: string | undefined) {
  return !!id && /^[\w-]+\.apps\.googleusercontent\.com$/.test(id);
}
