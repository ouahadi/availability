# TimePaste

Chrome extension for generating and sharing your calendar availability in any timezone. Connect your Google Calendar and easily share your available times with others, automatically converted to their timezone.

## Setup

1. Copy `src/config.example.js` to `src/config.js` and set `GOOGLE_CLIENT_ID`.
2. In Google Cloud Console, create OAuth Client ID (Web application). Set Authorized redirect URI to:
   - `https://<EXTENSION_ID>.chromiumapp.org/`
   You can get your redirect URL by opening the extension and checking the background console log (we log it on install).
3. In `manifest.json`, ensure permissions include `identity` and host access for Google APIs (already added).
4. Load the extension in Chrome via `chrome://extensions` → Load unpacked → select this folder.

## Using Google Calendar

- In the popup, click "Connect Google Calendar" to authorize.
- Click "Load Events" to list your upcoming events, including location when available.
- Click "Sign out" to clear stored tokens.

## Notes

- Tokens are stored in `chrome.storage.sync` under `googleAuth`.
- Uses OAuth 2.0 with PKCE via `chrome.identity.launchWebAuthFlow`.
- Events are fetched from the primary calendar: `calendar/v3/calendars/primary/events`.
