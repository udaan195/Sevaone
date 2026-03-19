const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ✅ Fix: ENOSPC — file watchers limit reached on Android/Termux
// Only watch src folder — node_modules exclude karo
config.watchFolders = [
  path.resolve(__dirname, 'src'),
  path.resolve(__dirname, 'assets'),
];

// Block unnecessary folders from being watched
config.resolver.blockList = [
  /node_modules\/react-native\/ReactAndroid\/.*/,
  /node_modules\/.*\/android\/.*/,
  /node_modules\/.*\/\.git\/.*/,
  /node_modules\/.*\/test\/.*/,
  /node_modules\/.*\/tests\/.*/,
  /node_modules\/.*\/__tests__\/.*/,
  /node_modules\/.*\/docs\/.*/,
  /node_modules\/.*\/example\/.*/,
  /node_modules\/.*\/examples\/.*/,
  /\.git\/.*/,
];

// ✅ Use polling instead of native watchers (avoids inotify limit)
config.watcher = {
  watchman: {
    deferStates: [],
  },
  additionalExts: ['mjs', 'cjs'],
};

module.exports = config;
