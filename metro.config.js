const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.watchFolders = [];
config.resolver.blockList = [
  /node_modules\/react-native\/ReactAndroid\/.*/,
  /node_modules\/.*\/android\/.*/,
];
module.exports = config;
