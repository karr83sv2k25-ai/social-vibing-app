const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    // Fix for react-async-hook broken main field
    if (moduleName === 'react-async-hook') {
      return {
        filePath: path.resolve(__dirname, 'node_modules/react-async-hook/dist/react-async-hook.esm.js'),
        type: 'sourceFile',
      };
    }

    // Use default resolution for everything else
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
