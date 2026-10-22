// Expo SDK 52+ configures Metro for pnpm/npm/yarn monorepos automatically
// (watchFolders, node_modules lookup). Do not override resolver paths here.
// See https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config')

module.exports = getDefaultConfig(__dirname)
