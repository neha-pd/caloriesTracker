const { withAppBuildGradle } = require('expo/config-plugins');
module.exports = config => withAppBuildGradle(config, result => {
  let source = result.modResults.contents;
  source = source.replace('signingConfigs {', `signingConfigs {
        if (System.getenv("FITLENS_KEYSTORE_PATH")) {
            teamPreview {
                storeFile file(System.getenv("FITLENS_KEYSTORE_PATH"))
                storePassword System.getenv("FITLENS_KEYSTORE_PASSWORD")
                keyAlias "fitlens-team"
                keyPassword System.getenv("FITLENS_KEYSTORE_PASSWORD")
            }
        }`);
  source = source.replace(/(release\s*\{[\s\S]*?)signingConfig signingConfigs.debug/, '$1signingConfig System.getenv("FITLENS_KEYSTORE_PATH") ? signingConfigs.teamPreview : signingConfigs.debug');
  result.modResults.contents = source;
  return result;
});
