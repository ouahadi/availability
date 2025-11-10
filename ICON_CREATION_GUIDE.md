# Icon Creation Guide

Chrome Web Store requires extension icons in specific sizes. Follow these steps to create the required icons.

## Required Icon Sizes

- **16x16 pixels** - Used in the browser toolbar
- **48x48 pixels** - Used in the extension management page
- **128x128 pixels** - Used in Chrome Web Store and Chrome Web Store search

## Format Requirements

- Format: PNG
- Background: Transparent or solid color
- File names: `icon16.png`, `icon48.png`, `icon128.png`

## Creating Icons

### Option 1: Use a Design Tool (Recommended)

1. Create a 128x128px design with your logo/branding
2. Export at 128x128px → `icon128.png`
3. Scale down to 48x48px → `icon48.png`
4. Scale down to 16x16px → `icon16.png`

### Option 2: Online Icon Generator

1. Visit an icon generator like:
   - https://www.favicon-generator.org/
   - https://realfavicongenerator.net/
   - https://icon.kitchen/
2. Upload your base image (preferably 512x512 or larger)
3. Generate all required sizes
4. Download and rename files

### Option 3: Use ImageMagick (Command Line)

If you have a base image at 128x128 or larger:

```bash
# Create icons directory
mkdir -p icons

# Generate icons from a base image (replace base.png with your image)
convert base.png -resize 128x128 icons/icon128.png
convert base.png -resize 48x48 icons/icon48.png
convert base.png -resize 16x16 icons/icon16.png
```

### Option 4: Quick Placeholder Icons

For testing purposes, you can create simple colored squares:

```bash
mkdir -p icons

# Create simple colored icons (using ImageMagick)
convert -size 128x128 xc:"#0A91A4" icons/icon128.png
convert -size 48x48 xc:"#0A91A4" icons/icon48.png
convert -size 16x16 xc:"#0A91A4" icons/icon16.png
```

Or use one of the accent colors from your palette:
- `#0A91A4` (Teal)
- `#F11B85` (Pink)
- `#81B703` (Green)
- `#9F07D7` (Purple)
- `#BC19F8` (Purple)

## Icon Design Tips

1. **Keep it simple**: Icons are small, so avoid fine details
2. **High contrast**: Ensure visibility on light and dark backgrounds
3. **Brand consistency**: Use your brand colors
4. **Centered design**: Important elements should be centered
5. **Test visibility**: Check how icons look at 16x16 size

## Icon Suggestions for TimePaste

Consider incorporating:
- Clock or time symbol
- Calendar icon
- "TP" or "T" monogram
- Availability/schedule visualization
- Your brand colors (teal, pink, green, purple)

## File Location

Place all icons in the `icons/` directory:

```
icons/
  ├── icon16.png
  ├── icon48.png
  └── icon128.png
```

After creating icons, verify they're included when you run `npm run build:store`.


