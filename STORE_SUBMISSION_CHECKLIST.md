# Chrome Web Store Submission Checklist

## Pre-Submission

### Required Files
- [ ] Extension icons created (16x16, 48x48, 128x128 PNG files)
- [ ] Icons placed in `icons/` directory
- [ ] Build completed successfully (`npm run build:store`)
- [ ] Tested unpacked extension from `dist/` folder
- [ ] All features tested and working

### Manifest Verification
- [ ] Version number updated (currently 0.1.0)
- [ ] Name is "TimePaste"
- [ ] Description is clear and accurate
- [ ] Icons referenced correctly
- [ ] Permissions are minimal and justified
- [ ] Host permissions are correct

### OAuth Setup
- [ ] Google OAuth Client ID configured in Google Cloud Console
- [ ] OAuth Client ID is set up for Chrome Extension type
- [ ] Authorized redirect URI matches extension ID format
- [ ] Test OAuth flow works in production build

### Code Quality
- [ ] No console.log statements with sensitive data
- [ ] Error handling in place
- [ ] User-friendly error messages
- [ ] No hardcoded secrets (except public OAuth Client ID)

## Store Listing

### Store Details (to be filled in Developer Dashboard)
- [ ] **Name**: TimePaste
- [ ] **Summary**: (Short description, max 132 chars)
- [ ] **Description**: (Full description explaining features)
- [ ] **Category**: Productivity
- [ ] **Language**: English
- [ ] **Privacy Policy URL**: (Required - create privacy policy)
- [ ] **Homepage URL**: (Optional)
- [ ] **Support URL**: (Optional but recommended)

### Graphics
- [ ] **Store Icon**: 128x128 PNG (required)
- [ ] **Small Promo Tile**: 440x280 PNG (optional)
- [ ] **Large Promo Tile**: 920x680 PNG (optional)
- [ ] **Marquee Promo Tile**: 1400x560 PNG (optional)
- [ ] **Screenshots**: At least 1 required, up to 5 recommended
  - Recommended sizes: 1280x800 or 640x400
  - Show main features: popup, options page, availability generation

## Privacy Policy Requirements

Your privacy policy must explain:

1. **Data Collection**:
   - What data is collected (calendar events, account info)
   - Why it's collected (to generate availability)
   - How it's used

2. **Data Storage**:
   - Data is stored locally in Chrome storage
   - OAuth tokens are stored securely
   - No data sent to third-party servers (except Google Calendar API)

3. **Data Sharing**:
   - Data is only shared with Google Calendar API
   - No data sold or shared with third parties
   - User has full control over their data

4. **User Rights**:
   - How to disconnect accounts
   - How to clear stored data
   - How to delete the extension

## Beta Testing

### Beta Channel Setup
- [ ] Enable beta channel in Developer Dashboard
- [ ] Upload zip file
- [ ] Add test users/email addresses
- [ ] Test installation and functionality
- [ ] Collect feedback
- [ ] Fix any critical issues

### Beta Testing Period
- Recommended: 1-2 weeks
- Test with 5-20 users
- Monitor for crashes and errors
- Gather user feedback

## Production Release

After beta testing:
- [ ] All critical bugs fixed
- [ ] User feedback addressed
- [ ] Privacy policy reviewed
- [ ] Screenshots finalized
- [ ] Store listing polished
- [ ] Submit for review
- [ ] Wait for approval (typically 1-7 days)

## Current Configuration

- **Extension Name**: TimePaste
- **Version**: 0.1.0
- **OAuth Client ID**: (configured in config.js)
- **Permissions**: storage, identity
- **Host Permissions**: Google APIs, UK Bank Holidays API

## Notes

- The extension uses Google Calendar API v3
- Requires Google account authentication
- Stores preferences and calendar data locally
- Does not track or analytics in current implementation
- All processing happens locally or via Google APIs


