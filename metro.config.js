const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const assetExts = config.resolver.assetExts ?? [];
const sourceExts = config.resolver.sourceExts ?? [];

config.resolver = {
  ...config.resolver,
  assetExts: assetExts.includes('wasm') ? assetExts : [...assetExts, 'wasm'],
  sourceExts: sourceExts.filter((extension) => extension !== 'wasm'),
};

module.exports = config;
