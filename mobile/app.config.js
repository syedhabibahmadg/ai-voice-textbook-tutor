const base = require('./app.json').expo;
module.exports = {
  ...base,
  android: { ...base.android, versionCode: 1, permissions: ['INTERNET', 'RECORD_AUDIO'] },
  plugins: [...base.plugins, ['./plugins/withAndroidPrototype', {
    lanPreview: process.env.TUTOR_LAN_PREVIEW === '1',
    localSigning: process.env.TUTOR_LOCAL_SIGNING === '1',
  }]],
};
