// utils/platformCheck.js - Detect Expo Go vs Development Build
import Constants from 'expo-constants';

/**
 * Check if the app is running in Expo Go
 * @returns {boolean} true if running in Expo Go, false if development build or standalone
 */
export const isExpoGo = () => {
  return Constants.appOwnership === 'expo';
};

/**
 * Check if the app is a development build (has native modules support)
 * @returns {boolean} true if development build or standalone
 */
export const isDevelopmentBuild = () => {
  return !isExpoGo();
};

/**
 * Check if native modules are supported
 * @returns {boolean} true if native modules can be used
 */
export const supportsNativeModules = () => {
  return isDevelopmentBuild();
};

export default {
  isExpoGo,
  isDevelopmentBuild,
  supportsNativeModules,
};
