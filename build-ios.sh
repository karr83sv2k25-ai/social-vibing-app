#!/bin/bash

# iOS App Build Script for Social Vibing App
# This script provides multiple build options

set -e

echo "📱 iOS App Build Script"
echo "======================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}❌ Error: This script must be run on macOS${NC}"
    exit 1
fi

# Function to check if Xcode is installed
check_xcode() {
    if ! command -v xcodebuild &> /dev/null; then
        echo -e "${RED}❌ Xcode is not installed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Xcode found${NC}"
}

# Function to clean build artifacts
clean_build() {
    echo -e "${YELLOW}🧹 Cleaning build artifacts...${NC}"
    cd ios
    xcodebuild clean -workspace SocialVibing.xcworkspace -scheme SocialVibing || true
    rm -rf build
    rm -rf ~/Library/Developer/Xcode/DerivedData/SocialVibing-*
    cd ..
    echo -e "${GREEN}✅ Clean complete${NC}"
}

# Function to build for simulator
build_simulator() {
    echo -e "${YELLOW}📱 Building for iOS Simulator...${NC}"
    cd ios
    
    xcodebuild \
        -workspace SocialVibing.xcworkspace \
        -scheme SocialVibing \
        -configuration Debug \
        -sdk iphonesimulator \
        -derivedDataPath ./build \
        -arch arm64 \
        CODE_SIGNING_ALLOWED=NO \
        CODE_SIGNING_REQUIRED=NO
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Simulator build successful!${NC}"
        echo -e "App location: ios/build/Build/Products/Debug-iphonesimulator/SocialVibing.app"
    else
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    fi
    cd ..
}

# Function to build using Expo
build_expo() {
    echo -e "${YELLOW}🚀 Building with Expo (recommended)...${NC}"
    npx expo run:ios --configuration Release
}

# Function to build with EAS (cloud build)
build_eas() {
    echo -e "${YELLOW}☁️  Building with EAS (cloud)...${NC}"
    npx eas build --platform ios --profile production
}

# Menu
echo "Select build option:"
echo "1) Clean build artifacts"
echo "2) Build for Simulator (fastest, no code signing needed)"
echo "3) Build with Expo CLI (recommended)"
echo "4) Build with EAS (cloud build - requires EAS account)"
echo "5) Exit"
echo ""
read -p "Enter choice [1-5]: " choice

case $choice in
    1)
        clean_build
        ;;
    2)
        check_xcode
        clean_build
        build_simulator
        ;;
    3)
        check_xcode
        build_expo
        ;;
    4)
        build_eas
        ;;
    5)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✨ Done!${NC}"
