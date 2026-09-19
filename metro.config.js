const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle migrations are imported as raw `.sql` text via babel-plugin-inline-import.
config.resolver.sourceExts.push('sql');

module.exports = config;
