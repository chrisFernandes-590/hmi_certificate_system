// Path alias "@/*" is resolved by Expo from tsconfig.json "paths" (no extra babel plugin needed).
module.exports = function (api) {
  api.cache(true)
  return { presets: ['babel-preset-expo'] }
}
