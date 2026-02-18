#!/bin/bash

# Marketplace Cloud Functions - Deployment Script
# Run this after IAM permissions are granted

echo "🚀 Social Vibing Marketplace - Deployment Script"
echo "================================================"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Check current user
echo "📧 Current Firebase user:"
firebase login:list
echo ""

# Confirm deployment
read -p "🔍 Deploy marketplace Cloud Functions? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

# Deploy functions
echo ""
echo "📦 Deploying Cloud Functions..."
cd "$(dirname "$0")"
firebase deploy --only functions

# Check deployment status
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "🎯 Deployed Functions:"
    echo "  - buyProduct"
    echo "  - creditCoinsAfterIAP"
    echo "  - setActiveCustomization"
    echo "  - getUserLibrary"
    echo "  - createProduct"
    echo ""
    echo "📊 View Functions Console:"
    echo "  https://console.firebase.google.com/project/social-vibing-karr/functions"
    echo ""
    echo "🧪 Next Steps:"
    echo "  1. Test purchase flow in the app"
    echo "  2. Verify wallet security"
    echo "  3. Check function logs for errors"
    echo "  4. Move to Phase 3: Product Viewers"
    echo ""
else
    echo ""
    echo "❌ Deployment failed!"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "  1. Check IAM permissions:"
    echo "     https://console.cloud.google.com/iam-admin/iam?project=social-vibing-karr"
    echo ""
    echo "  2. Verify you have these roles:"
    echo "     - Service Account User"
    echo "     - Cloud Functions Developer"
    echo ""
    echo "  3. Grant permissions using gcloud:"
    echo "     gcloud projects add-iam-policy-binding social-vibing-karr \\"
    echo "       --member='user:YOUR_EMAIL@gmail.com' \\"
    echo "       --role='roles/iam.serviceAccountUser'"
    echo ""
    exit 1
fi
