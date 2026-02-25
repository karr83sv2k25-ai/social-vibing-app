#!/bin/bash

# 🚀 Marketplace Production Setup Script
# This script initializes your marketplace with production-ready data

echo "🛍️  Social Vibing Marketplace - Production Setup"
echo "================================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js detected: $(node --version)"
echo ""

# Check if Firebase Admin SDK is installed
if [ ! -d "node_modules/firebase-admin" ]; then
    echo "📦 Installing Firebase Admin SDK..."
    npm install firebase-admin
    echo ""
fi

# Check if serviceAccountKey.json exists
if [ ! -f "serviceAccountKey.json" ]; then
    echo "❌ Error: serviceAccountKey.json not found"
    echo ""
    echo "Please download your Firebase service account key:"
    echo "1. Go to Firebase Console → Project Settings"
    echo "2. Click 'Service Accounts' tab"
    echo "3. Click 'Generate new private key'"
    echo "4. Save the file as 'serviceAccountKey.json' in the project root"
    echo ""
    exit 1
fi

echo "✅ Service account key found"
echo ""

# Check if marketplace-products.json exists
if [ ! -f "marketplace-products.json" ]; then
    echo "❌ Error: marketplace-products.json not found"
    exit 1
fi

echo "✅ Product data file found"
echo ""

# Run the initialization script
echo "🚀 Initializing marketplace products..."
echo "----------------------------------------"
node scripts/initializeMarketplaceProducts.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Marketplace initialization complete!"
    echo ""
    echo "🎉 Your marketplace is now production-ready!"
    echo ""
    echo "Next steps:"
    echo "1. Open your mobile app"
    echo "2. Navigate to the Marketplace tab"
    echo "3. Browse and test product purchases"
    echo "4. Verify products show in user library"
    echo ""
else
    echo ""
    echo "❌ Initialization failed"
    echo "Please check the error messages above"
    exit 1
fi
