// Project on OneDrive: chokidar's native watcher misses file events on
// virtualized files. Force polling so Fast Refresh actually fires on save.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.watcher = {
  ...(config.watcher || {}),
  watchman: false,
  healthCheck: { enabled: false },
  additionalExts: ["cjs", "mjs"],
};

// Polling-based file watching (slightly higher CPU, but reliable on OneDrive).
process.env.CHOKIDAR_USEPOLLING = "1";
process.env.CHOKIDAR_INTERVAL = "300";

module.exports = config;
