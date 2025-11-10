# Quick Start: Preparing for Chrome Web Store Beta

## Step 1: Create Icons (Required)

Chrome Web Store requires extension icons. Create them now:

```bash
# Create icons directory
mkdir -p icons

# Option A: Use ImageMagick to create simple colored icons (for testing)
convert -size 128x128 xc:"#0A91A4" icons/icon128.png
convert -size 48x48 xc:"#0A91A4" icons/icon48.png
convert -size 16x16 xc:"#0A91A4" icons/icon16.png

# Option B: Create proper branded icons (see ICON_CREATION_GUIDE.md)
# Use a design tool to create icons and save them to icons/
```

## Step 2: Build the Extension

Run the build script:

```bash
npm run build:store
```

This creates:
- `dist/` folder with all required files
- `dist.zip` file ready for Chrome Web Store upload

## Step 3: Test the Build

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` folder
5. Test all features to ensure everything works

## Step 4: Upload to Chrome Web Store

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click "New Item"
3. Upload `dist.zip`
4. Fill in store listing information
5. Upload screenshots (recommended: 1280x800 or 640x400)
6. Set up beta testing group
7. Submit for review

## Important Files

- **CHROME_STORE_PREP.md** - Detailed preparation guide
- **STORE_SUBMISSION_CHECKLIST.md** - Complete checklist
- **ICON_CREATION_GUIDE.md** - Icon creation instructions
- **build-store.js** - Build script
- **dist.zip** - Ready-to-upload package (after running build)

## Current Status

✅ Manifest updated with icons and version
✅ Build script created
✅ Documentation prepared
⚠️  **Icons need to be created** (see Step 1)
⚠️  **Privacy policy needs to be created** (required for store submission)

## Next Steps

1. Create icons (see Step 1 above or ICON_CREATION_GUIDE.md)
2. Create privacy policy webpage
3. Run `npm run build:store`
4. Test the build
5. Prepare screenshots
6. Upload to Chrome Web Store

## Version Information

- Current version: **0.1.0**
- Extension name: **TimePaste**
- Manifest version: **3**

## Notes

- The build script includes `config.js` with OAuth credentials
- Ensure your OAuth Client ID is properly configured in Google Cloud Console
- All source files are included in the build
- Development files (README, examples) are excluded


