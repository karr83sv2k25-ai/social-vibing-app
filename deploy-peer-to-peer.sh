#!/bin/bash
# Deploy Peer-to-Peer Marketplace Cloud Functions

echo "🚀 Deploying Peer-to-Peer Marketplace..."
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

echo "📦 Installing function dependencies..."
cd functions
npm install
cd ..

echo ""
echo "🔥 Deploying Cloud Functions..."
firebase deploy --only functions:createProduct,functions:buyProduct

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🎯 Next Steps:"
echo "1. Open the app and go to Marketplace"
echo "2. Tap 'Start Selling' to become a seller"
echo "3. Create your first product"
echo "4. Start earning!"
echo ""
echo "📖 Read PEER_TO_PEER_MARKETPLACE.md for full documentation"
