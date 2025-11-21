# Google OAuth2 Setup Checklist

Use this checklist to ensure your production OAuth setup is complete.

## Google Cloud Console Setup

- [ ] **Project Created**
  - [ ] New project created or existing project selected
  - [ ] Project name set (e.g., "TimePaste Production")

- [ ] **APIs Enabled**
  - [ ] Google Calendar API enabled
  - [ ] Google People API enabled (or Google+ API)
  - [ ] OAuth2 API enabled (usually automatic)

- [ ] **OAuth Consent Screen Configured**
  - [ ] App name: "TimePaste"
  - [ ] User support email set
  - [ ] Developer contact email set
  - [ ] Privacy policy URL added (required for production)
  - [ ] Scopes added:
    - [ ] `https://www.googleapis.com/auth/calendar.readonly`
    - [ ] `https://www.googleapis.com/auth/userinfo.email`
    - [ ] `https://www.googleapis.com/auth/userinfo.profile`
  - [ ] Test users added (for testing phase)
  - [ ] OAuth consent screen published (for production)

- [ ] **OAuth 2.0 Client ID Created**
  - [ ] Application type: "Web application"
  - [ ] Name: "TimePaste Chrome Extension"
  - [ ] Redirect URI added: `https://<EXTENSION_ID>.chromiumapp.org/`
  - [ ] Client ID copied
  - [ ] Client Secret copied (optional, for PKCE not required)

## Extension Configuration

- [ ] **Config File Updated**
  - [ ] `src/config.js` updated with new Client ID
  - [ ] `GOOGLE_CLIENT_ID` set to production Client ID
  - [ ] `GOOGLE_CLIENT_SECRET` updated (if using)

- [ ] **Extension Rebuilt**
  - [ ] Ran `npm run build:store`
  - [ ] Extension reloaded in Chrome

## Testing

- [ ] **Connection Tested**
  - [ ] Extension Options page shows correct redirect URI
  - [ ] "Connect Google Calendar" works
  - [ ] OAuth consent screen appears
  - [ ] Authorization successful
  - [ ] Calendar events load correctly
  - [ ] Multiple accounts work (if applicable)

## Production Readiness

- [ ] **For Chrome Web Store**
  - [ ] OAuth consent screen published (not in testing mode)
  - [ ] Privacy policy URL is publicly accessible
  - [ ] Production extension ID obtained
  - [ ] Production redirect URI added to OAuth client
  - [ ] All test redirect URIs removed (optional, can keep for development)

## Quick Reference

### Find Your Redirect URI:
1. Open extension Options page
2. Look in "Google Accounts" section
3. Copy the OAuth Redirect URI shown

### Update Redirect URI in Google Cloud:
1. Go to APIs & Services → Credentials
2. Click your OAuth Client ID
3. Add redirect URI: `https://<EXTENSION_ID>.chromiumapp.org/`
4. Save

### Current Extension ID:
- Go to `chrome://extensions/`
- Enable Developer mode
- Find extension ID (or check Options page)


