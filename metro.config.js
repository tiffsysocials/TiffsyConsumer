// const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// /**
//  * Metro configuration
//  * https://reactnative.dev/docs/metro
//  *
//  * @type {import('@react-native/metro-config').MetroConfig}
//  */
// const config = {};

// module.exports = mergeConfig(getDefaultConfig(__dirname), config);
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withNativeWind } = require('nativewind/metro');

const baseConfig = getDefaultConfig(__dirname);

const config = mergeConfig(baseConfig, {
  resolver: {
    // Ensure ts/tsx extensions are resolved properly for node_modules like react-native-calendars
    sourceExts: [...baseConfig.resolver.sourceExts, 'ts', 'tsx'],
  },
});

module.exports = withNativeWind(config, { input: './global.css' });

