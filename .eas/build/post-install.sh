#!/bin/bash

# This hook runs after dependencies are installed
# Configure Podfile for React Native Firebase compatibility

if [ "$EAS_BUILD_PLATFORM" = "ios" ]; then
  echo "EAS Hook: Configuring Podfile for React Native Firebase"
  
  PODFILE_PATH="ios/Podfile"
  
  if [ -f "$PODFILE_PATH" ]; then
    # Add use_modular_headers! after platform declaration if not already present
    if ! grep -q "use_modular_headers!" "$PODFILE_PATH"; then
      echo "EAS Hook: Adding use_modular_headers! to Podfile"
      sed -i.bak "/platform :ios/a\\
use_modular_headers!
" "$PODFILE_PATH"
    fi
    
    # Add post_install hook
    if grep -q "post_install do |installer|" "$PODFILE_PATH"; then
      echo "EAS Hook: post_install already exists, appending configuration"
      # Insert before the final 'end' of post_install
      sed -i.bak2 '/post_install do |installer|/,/^end$/ {
        /^end$/ i\
\  # Allow non-modular includes for React Native\
\  installer.pods_project.targets.each do |target|\
\    target.build_configurations.each do |config|\
\      config.build_settings["CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES"] = "YES"\
\    end\
\  end
      }' "$PODFILE_PATH"
    else
      echo "EAS Hook: Creating new post_install hook"
      cat >> "$PODFILE_PATH" << 'EOF'

# Allow non-modular includes for React Native
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
  end
end
EOF
    fi
    
    echo "EAS Hook: Podfile configured successfully"
    echo "=== First 60 lines of Podfile ==="
    head -60 "$PODFILE_PATH"
  else
    echo "EAS Hook: Warning - Podfile not found at $PODFILE_PATH"
  fi
fi
