#!/bin/bash

# Grant IAM Permissions for Cloud Functions Deployment
# Run this if you have Owner/Editor access to the Firebase project

PROJECT_ID="social-vibing-karr"

echo "🔐 Granting IAM Permissions for Cloud Functions"
echo "Project: $PROJECT_ID"
echo "================================================"
echo ""

# Get current user email
echo "📧 Checking current Firebase user..."
CURRENT_USER=$(firebase login:list | grep -o '[a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]*\.[a-zA-Z]*' | head -1)

if [ -z "$CURRENT_USER" ]; then
    echo "❌ No Firebase user found. Please run 'firebase login' first."
    exit 1
fi

echo "✅ Current user: $CURRENT_USER"
echo ""

# Confirm
read -p "Grant permissions to $CURRENT_USER? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 1
fi

echo ""
echo "🔧 Granting permissions..."
echo ""

# Grant Service Account User role
echo "1️⃣ Granting Service Account User role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:$CURRENT_USER" \
  --role="roles/iam.serviceAccountUser"

if [ $? -eq 0 ]; then
    echo "✅ Service Account User role granted"
else
    echo "❌ Failed to grant Service Account User role"
    echo "   You may not have sufficient permissions."
    echo "   Ask the project owner to grant this manually."
fi

echo ""

# Grant Cloud Functions Developer role
echo "2️⃣ Granting Cloud Functions Developer role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:$CURRENT_USER" \
  --role="roles/cloudfunctions.developer"

if [ $? -eq 0 ]; then
    echo "✅ Cloud Functions Developer role granted"
else
    echo "❌ Failed to grant Cloud Functions Developer role"
    echo "   You may not have sufficient permissions."
    echo "   Ask the project owner to grant this manually."
fi

echo ""
echo "================================================"
echo "✅ IAM Permissions Setup Complete!"
echo ""
echo "⏳ Wait 2-3 minutes for permissions to propagate"
echo ""
echo "🚀 Then run deployment:"
echo "   ./deploy-marketplace.sh"
echo ""
echo "   OR manually:"
echo "   firebase deploy --only functions"
echo ""
