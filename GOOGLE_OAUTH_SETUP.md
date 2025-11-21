# Google OAuth2 Production Setup Guide

This guide walks you through setting up a production Google Cloud project for the TimePaste extension.

## Step 1: Create/Select Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top
3. Click **"New Project"** (or select an existing project)
4. Enter project name: `TimePaste Production` (or your preferred name)
5. Click **"Create"**
6. Wait for the project to be created, then select it

## Step 2: Enable Required APIs

1. In the Google Cloud Console, go to **"APIs & Services"** → **"Library"**
2. Search for and enable the following APIs:
   - **Google Calendar API** - Required for reading calendar events
   - **Google+ API** (or **People API**) - Required for user profile information
   - **OAuth2 API** - Usually enabled automatically

### Enable APIs:
- Search for "Google Calendar API" → Click → **"Enable"**
- Search for "Google People API" → Click → **"Enable"**

## Step 3: Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Choose **"External"** (unless you have a Google Workspace account)
3. Click **"Create"**
4. Fill in the required information:
   - **App name**: `TimePaste`
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
   - **App logo**: (Optional) Upload your extension icon
   - **App domain**: (Optional) Your website if you have one
   - **Application home page**: (Optional) Your website URL
   - **Privacy policy link**: (Required for production) Link to your privacy policy
   - **Terms of service link**: (Optional)
   - **Authorized domains**: (Optional) Your domain if you have one

5. Click **"Save and Continue"**

6. **Scopes** (Step 2):
   - Click **"Add or Remove Scopes"**
   - Add the following scopes:
     - `https://www.googleapis.com/auth/calendar.readonly` - View your calendars
     - `https://www.googleapis.com/auth/userinfo.email` - See your email address
     - `https://www.googleapis.com/auth/userinfo.profile` - See your personal info
   - Click **"Update"** → **"Save and Continue"**

7. **Test users** (Step 3):
   - For testing, add your email address as a test user
   - For production, you can skip this after publishing

8. **Summary** (Step 4):
   - Review and click **"Back to Dashboard"**

## Step 4: Create OAuth 2.0 Client ID

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. If prompted, configure the OAuth consent screen (see Step 3 above)
4. Select **"Web application"** as the application type
5. Give it a name: `TimePaste Chrome Extension`
6. **Authorized JavaScript origins**: Leave empty (not needed for Chrome extensions)
7. **Authorized redirect URIs**: 
   - **IMPORTANT**: You need to add the redirect URI for your extension
   - The format is: `https://<EXTENSION_ID>.chromiumapp.org/`
   - To find your extension ID:
     - Go to `chrome://extensions/`
     - Enable "Developer mode"
     - Find your extension and note the ID (or click "Inspect views: service worker" to see it in console)
   - Alternatively, open the extension's Options page - the redirect URI is displayed there
   - Add the redirect URI: `https://<YOUR_EXTENSION_ID>.chromiumapp.org/`
   - **Note**: For production, you may want to add multiple redirect URIs if you have different extension IDs for development and production

8. Click **"Create"**
9. **Copy the Client ID** - You'll need this for `src/config.js`
10. **Copy the Client Secret** (if shown) - You may need this, but it's optional for Chrome extensions using PKCE

## Step 5: Update Extension Configuration

1. Open `src/config.js` in your project
2. Update the `GOOGLE_CLIENT_ID` with your new Client ID:
   ```javascript
   export const GOOGLE_CLIENT_ID = "YOUR_NEW_CLIENT_ID.apps.googleusercontent.com";
   ```
3. Update `GOOGLE_CLIENT_SECRET` if you're using one (optional):
   ```javascript
   export const GOOGLE_CLIENT_SECRET = "YOUR_CLIENT_SECRET";
   ```
   **Note**: Client secrets are optional when using PKCE (which this extension does). You can leave it as an empty string or remove it.

4. Save the file

## Step 6: Rebuild and Test

1. Rebuild the extension:
   ```bash
   npm run build:store
   ```

2. Reload the extension in Chrome:
   - Go to `chrome://extensions/`
   - Click the reload icon on your extension

3. Test the connection:
   - Open the extension popup
   - Click "Connect Google Calendar"
   - You should see the OAuth consent screen
   - After authorizing, the extension should connect successfully

## Step 7: Verify Redirect URI (If Issues Occur)

If you get a "redirect_uri_mismatch" error:

1. Open the extension's Options page
2. Find the "OAuth Redirect URI" displayed in the Google Accounts section
3. Go back to Google Cloud Console → Credentials → Your OAuth Client ID
4. Make sure the redirect URI from step 2 is in the "Authorized redirect URIs" list
5. Click "Save"
6. Wait a few minutes for changes to propagate
7. Try connecting again

## Important Notes

### For Chrome Web Store Submission:
- Your OAuth consent screen must be published (not in "Testing" mode) for public users
- You'll need a privacy policy URL
- The extension ID will be different when published to the Chrome Web Store
- You'll need to add the production extension's redirect URI to your OAuth client

### Security Best Practices:
- Never commit `src/config.js` with real credentials to public repositories
- Use environment variables or secure storage for production secrets
- Client secrets are optional with PKCE, but if used, they're still exposed in the extension code
- Consider using a backend service for token exchange if you need additional security

### Extension ID Changes:
- Unpacked extensions get a new ID each time they're loaded
- Published extensions have a stable ID
- You may need to add multiple redirect URIs during development

## Troubleshooting

### "redirect_uri_mismatch" Error:
- Verify the redirect URI in Options page matches what's in Google Cloud Console
- Make sure there are no trailing slashes or extra characters
- Wait a few minutes after updating redirect URIs in Google Cloud Console

### "Access blocked" Error:
- Check that all required APIs are enabled
- Verify OAuth consent screen is configured
- If in testing mode, ensure your email is in the test users list

### "Invalid client" Error:
- Verify the Client ID in `src/config.js` matches the one in Google Cloud Console
- Check that the OAuth client is not deleted or disabled

## Next Steps

After successful setup:
1. Test all calendar functionality
2. Prepare for Chrome Web Store submission
3. Update redirect URI with production extension ID after publishing
4. Publish OAuth consent screen for public use


