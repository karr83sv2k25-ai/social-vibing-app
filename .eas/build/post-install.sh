#!/bin/bash

# This hook runs after dependencies are installed
# Add use_modular_headers! for Firebase pods

if [ "$EAS_BUILD_PLATFORM" = "ios" ]; then
  echo "EAS Hook: Configuring Podfile for Firebase modular headers"
  
  PODFILE_PATH="ios/Podfile"
  
  if [ -f "$PODFILE_PATH" ]; then
    # Add use_modular_headers! right after the platform declaration
    if ! grep -q "use_modular_headers!" "$PODFILE_PATH"; then
      echo "EAS Hook: Adding use_modular_headers! to Podfile"
      sed -i.bak "/platform :ios/a\\
use_modular_headers!
" "$PODFILE_PATH"
    fi
    
    echo "EAS Hook: Podfile modified successfully"
    echo "=== Modified Podfile (first 50 lines) ==="
    head -50 "$PODFILE_PATH"
  else
    echo "EAS Hook: Warning - Podfile not found at $PODFILE_PATH"
  fi
fi
