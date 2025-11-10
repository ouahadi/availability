# Chrome Web Store Preparation Guide

## Steps to Prepare for Beta Testing

### 1. Create Extension Icons

Chrome Web Store requires icons in the following sizes:
- 16x16 (required)
- 48x48 (required)
- 128x128 (required)

Create these icons and place them in an `icons/` directory.

### 2. Update manifest.json

The manifest has been updated with:
- Proper version number
- Store description
- Icon paths
- Homepage URL (if applicable)

### 3. Build the Extension

Run the build script to create the package:

```bash
npm run build:store
```

This will:
- Copy required files to `dist/` directory
- Exclude development files (config.js, .example files, etc.)
- Create a zip file ready for upload

### 4. Files Included in Store Package

- `manifest.json`
- `src/popup.html`
- `src/popup.js`
- `src/options.html`
- `src/options.js`
- `src/background.js`
- `src/availability.js`
- `src/account-manager.js`
- `src/calendar.js`
- `src/content.js`
- `src/providers/` directory
- `icons/` directory (icon files)

### 5. Files Excluded from Store Package

- `src/config.js` (contains credentials - will be in manifest)
- `src/config.example.js`
- `README.md`
- `ROLLBACK_NOTES.md`
- `package.json`
- `.DS_Store` files
- `dist/` directory (if exists)

### 6. Chrome Web Store Submission Checklist

- [ ] Create icon files (16x16, 48x48, 128x128)
- [ ] Update manifest.json with your store details
- [ ] Test the extension thoroughly
- [ ] Build the package using `npm run build:store`
- [ ] Test the built package by loading it as unpacked extension
- [ ] Verify all features work without config.js
- [ ] Prepare screenshots for store listing
- [ ] Write store description and privacy policy
- [ ] Upload zip file to Chrome Web Store Developer Dashboard

### 7. Important Notes

**OAuth Configuration**: The `GOOGLE_CLIENT_ID` is now in manifest.json. Make sure:
- Your OAuth Client ID in Google Cloud Console is configured for Chrome Extension
- The authorized redirect URI matches your extension ID format
- Client ID is properly set in the manifest

**Privacy**: Review permissions and create a privacy policy that explains:
- Why storage permission is needed
- Why identity permission is needed
- How user data is handled
- Google Calendar data access and usage


