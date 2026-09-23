const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

// Core uses NodeNext-style ".js" import specifiers that map to ".ts" sources.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    const originDir = path.dirname(context.originModulePath);
    const asTs = path.resolve(originDir, moduleName.replace(/\.js$/, ".ts"));
    if (fs.existsSync(asTs)) {
      return { type: "sourceFile", filePath: asTs };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
