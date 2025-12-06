#!/bin/bash

# This hook runs after dependencies are installed
# Modify the Podfile to disable the -Werror flag for non-modular headers

if [ "$EAS_BUILD_PLATFORM" = "ios" ]; then
  echo "EAS Hook: Modifying Podfile to disable non-modular header warnings"
  
  PODFILE_PATH="ios/Podfile"
  
  if [ -f "$PODFILE_PATH" ]; then
    # Check if post_install already exists
    if grep -q "post_install do |installer|" "$PODFILE_PATH"; then
      echo "EAS Hook: post_install hook already exists, modifying it"
      
      # Add our configuration before the final 'end' of post_install
      sed -i.bak '/post_install do |installer|/,/^end$/{
        /^end$/i\
\  # Disable warnings-as-errors for non-modular headers (React Native Firebase fix)\
\  installer.pods_project.targets.each do |target|\
\    target.build_configurations.each do |config|\
\      config.build_settings["WARNING_CFLAGS"] ||= ["$(inherited)"]\
\      config.build_settings["WARNING_CFLAGS"] << "-Wno-error=non-modular-include-in-framework-module"\
\      config.build_settings["GCC_TREAT_WARNINGS_AS_ERRORS"] = "NO"\
\    end\
\  end
      }' "$PODFILE_PATH"
    else
      # Add new post_install hook
      cat >> "$PODFILE_PATH" << 'EOF'

# Disable warnings-as-errors for non-modular headers (React Native Firebase fix)
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['WARNING_CFLAGS'] ||= ['$(inherited)']
      config.build_settings['WARNING_CFLAGS'] << '-Wno-error=non-modular-include-in-framework-module'
      config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
    end
  end
end
EOF
    fi
    
    echo "EAS Hook: Podfile modified successfully"
    cat "$PODFILE_PATH"
  else
    echo "EAS Hook: Warning - Podfile not found at $PODFILE_PATH"
  fi
fi
