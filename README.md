# Availability Chrome Extension (MV3)

Minimal boilerplate with Google Calendar integration.

## Setup

1. Copy `src/config.example.js` to `src/config.js` and set `GOOGLE_CLIENT_ID`.
2. In `manifest.json`, ensure permissions include `identity` and host access for Google APIs (already added).
3. Load the extension in Chrome via `chrome://extensions` → Load unpacked → select this folder.

## Using Google Calendar

- In the popup, click "Connect Google Calendar" to authorize.
- Click "Load Events" to list your upcoming events, including location when available.
- Click "Sign out" to clear stored tokens.

## Notes

- Tokens are stored in `chrome.storage.sync` under `googleAuth`.
- Uses OAuth 2.0 with PKCE via `chrome.identity.launchWebAuthFlow`.
- Events are fetched from the primary calendar: `calendar/v3/calendars/primary/events`.
