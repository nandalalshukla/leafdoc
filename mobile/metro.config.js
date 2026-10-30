// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle ONNX models as binary assets so inference works fully offline.
config.resolver.assetExts.push('onnx');

module.exports = config;
