#!/bin/bash

# This hook runs after dependencies are installed
# Configure Podfile for React Native Firebase compatibility

if [ "$EAS_BUILD_PLATFORM" = "ios" ]; then
  echo "EAS Hook: Configuring Podfile for React Native Firebase"
  
  PODFILE_PATH="ios/Podfile"
  
  if [ -f "$PODFILE_PATH" ]; then
    echo "EAS Hook: Original Podfile found, creating modified version"
    
    # Create a temporary file for the new Podfile
    TEMP_PODFILE="${PODFILE_PATH}.tmp"
    
    # Process the Podfile line by line
    ADDED_MODULAR_HEADERS=false
    ADDED_POST_INSTALL=false
    IN_POST_INSTALL=false
    
    while IFS= read -r line; do
      echo "$line" >> "$TEMP_PODFILE"
      
      # Add use_modular_headers! after platform :ios line
      if [[ "$line" =~ ^[[:space:]]*platform[[:space:]]+:ios ]] && [ "$ADDED_MODULAR_HEADERS" = false ]; then
        echo "use_modular_headers!" >> "$TEMP_PODFILE"
        ADDED_MODULAR_HEADERS=true
        echo "EAS Hook: Added use_modular_headers!"
      fi
      
      # Detect if we're entering post_install block
      if [[ "$line" =~ ^[[:space:]]*post_install[[:space:]]+do ]]; then
        IN_POST_INSTALL=true
      fi
      
    done < "$PODFILE_PATH"
    
    # If no post_install block exists, add one
    if [ "$IN_POST_INSTALL" = false ]; then
      echo "" >> "$TEMP_PODFILE"
      echo "# Allow non-modular includes for React Native" >> "$TEMP_PODFILE"
      echo "post_install do |installer|" >> "$TEMP_PODFILE"
      echo "  installer.pods_project.targets.each do |target|" >> "$TEMP_PODFILE"
      echo "    target.build_configurations.each do |config|" >> "$TEMP_PODFILE"
      echo "      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'" >> "$TEMP_PODFILE"
      echo "    end" >> "$TEMP_PODFILE"
      echo "  end" >> "$TEMP_PODFILE"
      echo "end" >> "$TEMP_PODFILE"
      echo "EAS Hook: Added new post_install hook"
    else
      echo "EAS Hook: Found existing post_install block - you may need to manually add CLANG_ALLOW_NON_MODULAR_INCLUDES"
    fi
    
    # Replace original with modified version
    mv "$TEMP_PODFILE" "$PODFILE_PATH"
    
    echo "EAS Hook: Podfile configured successfully"
    echo "=== Modified Podfile (first 80 lines) ==="
    head -80 "$PODFILE_PATH"
    echo "=== End of Podfile preview ==="
  else
    echo "EAS Hook: Warning - Podfile not found at $PODFILE_PATH"
  fi
fi
