const { withAndroidManifest, withAppBuildGradle } = require('expo/config-plugins');
module.exports = (config, options = {}) => {
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application[0];
    app.$['android:usesCleartextTraffic'] = options.lanPreview ? 'true' : 'false';
    return mod;
  });
  if (options.localSigning) config = withAppBuildGradle(config, (mod) => {
    const signing = `
        release {
            def signingStore = System.getenv('TUTOR_SIGNING_STORE_FILE')
            if (!signingStore) throw new GradleException('Use scripts/build_apk.py to supply private release signing credentials')
            storeFile file(signingStore)
            storePassword System.getenv('TUTOR_SIGNING_STORE_PASSWORD')
            keyAlias System.getenv('TUTOR_SIGNING_KEY_ALIAS')
            keyPassword System.getenv('TUTOR_SIGNING_KEY_PASSWORD')
        }
`;
    mod.modResults.contents = mod.modResults.contents.replace(/\s*release\s*\{\s*def signingStore[\s\S]*?keyPassword System.getenv\('TUTOR_SIGNING_KEY_PASSWORD'\)\s*\}/g, '')
      .replace('signingConfigs {', 'signingConfigs {' + signing)
      .replace(/(release\s*\{\s*\/\/[\s\S]*?)(signingConfig signingConfigs.debug)/, '$1signingConfig signingConfigs.release');
    return mod;
  });
  return config;
};
