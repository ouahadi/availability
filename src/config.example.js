// Copy this file to src/config.js and set your OAuth Client ID
// Create an OAuth 2.0 Client ID (Web application) in Google Cloud Console
// and add the Authorized redirect URI:
//   https://<EXTENSION_ID>.chromiumapp.org/
// The actual redirect will be chrome.identity.getRedirectURL(), which
// resolves to the chromiumapp.org domain for your extension ID.

export const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com";
// Optional but may be required by Google for Web Application clients.
// WARNING: Storing client secrets in an extension exposes them publicly.
// For production, use a backend to exchange the code securely.
export const GOOGLE_CLIENT_SECRET = "YOUR_CLIENT_SECRET_IF_REQUIRED";


