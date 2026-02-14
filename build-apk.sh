#!/bin/bash

echo "========================================"
echo "Building Android APK"
echo "========================================"

cd "$(dirname "$0")"

echo ""
echo "Step 1: Checking EAS CLI..."
if ! npx eas-cli --version > /dev/null 2>&1; then
    echo "Installing EAS CLI..."
    npm install -g eas-cli
fi

echo ""
echo "Step 2: Building APK (this may take 10-20 minutes)..."
npx eas build --platform android --profile preview --local

echo ""
echo "========================================"
echo "Build Complete!"
echo "========================================"
echo "APK location: Check the build output above"
echo ""
echo "To share the APK:"
echo "1. Upload to Google Drive or any file sharing service"
echo "2. Right-click and select 'Get link'"
echo "3. Share the link"
echo ""
