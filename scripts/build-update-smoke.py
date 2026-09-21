"""Build an isolated APK to exercise the real update gate online and from its offline cache."""
from pathlib import Path
import subprocess,os,json,shutil
r=Path.cwd();layout=r/'mobile/app/_layout.tsx';gradle=r/'mobile/android/app/build.gradle';original_layout=layout.read_text();original_gradle=gradle.read_text()
c=json.loads((r/'.data/deployment-credentials.json').read_text());env=os.environ.copy();env.update(JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home',ANDROID_HOME='/Users/juni/Library/Android/sdk',FITLENS_KEYSTORE_PATH=str(r/'.data/fitlens-team.p12'),FITLENS_KEYSTORE_PASSWORD=c['team_keystore_password'],EXPO_PUBLIC_API_URL='https://fitlens-api.onrender.com')
try:
 layout.write_text('export {default} from "../../checks/native-update-smoke";\n')
 gradle.write_text(original_gradle.replace("applicationId 'com.fitlens.app'",'applicationId "com.fitlens.smoke"'))
 shutil.rmtree(r/'mobile/android/app/build',ignore_errors=True)
 with open('/tmp/fitlens25-update-smoke-build.log','w') as log:
  subprocess.run(['./android/gradlew','-p','android',':app:assembleRelease','--max-workers=4','-PreactNativeArchitectures=arm64-v8a','--console=plain','-Dorg.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=2g'],cwd=r/'mobile',env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
 shutil.copyfile(r/'mobile/android/app/build/outputs/apk/release/app-release.apk',r/'.data/fitlens-update-smoke.apk');print('Native update test APK built')
finally:layout.write_text(original_layout);gradle.write_text(original_gradle)
