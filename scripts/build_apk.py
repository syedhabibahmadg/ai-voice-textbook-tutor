"""Build a signed standalone LAN preview APK; signing material stays in .private/."""
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
MOBILE = ROOT / 'mobile'

def run(args, **kwargs):
    subprocess.run(args, check=True, **kwargs)

def main():
    private = ROOT / '.private'
    private.mkdir(exist_ok=True)
    credentials = private / 'preview-signing.json'
    keystore = private / 'preview-release.keystore'
    if credentials.exists() != keystore.exists():
        raise RuntimeError('Signing backup is incomplete. Restore the matching key and credentials; do not overwrite.')
    if credentials.exists():
        signing = json.loads(credentials.read_text())
    else:
        signing = {'store_password':secrets.token_urlsafe(32), 'key_password':secrets.token_urlsafe(32), 'alias':'tutor-preview'}
    env = {**os.environ, 'TUTOR_LAN_PREVIEW':'1', 'TUTOR_LOCAL_SIGNING':'1',
           'TUTOR_SIGNING_STORE_FILE':str(keystore), 'TUTOR_SIGNING_STORE_PASSWORD':signing['store_password'],
           'TUTOR_SIGNING_KEY_PASSWORD':signing['key_password'], 'TUTOR_SIGNING_KEY_ALIAS':signing['alias'],
           'NODE_ENV':'production', 'CI':'1'}
    env.pop('EXPO_PUBLIC_API_URL', None)
    env['JAVA_TOOL_OPTIONS'] = '-Djdk.tls.client.protocols=TLSv1.2 -Dhttps.protocols=TLSv1.2 -XX:+UnlockDiagnosticVMOptions -XX:-UseAES -XX:-UseAESIntrinsics -XX:-UseGHASHIntrinsics -XX:UseAVX=0'
    sdk = Path(env.get('ANDROID_HOME', str(Path(os.environ['LOCALAPPDATA']) / 'Android/Sdk')))
    if not (sdk / 'platform-tools/adb.exe').exists():
        raise RuntimeError('Set ANDROID_HOME to an installed Android SDK.')
    env['ANDROID_HOME'] = env['ANDROID_SDK_ROOT'] = str(sdk)
    if not credentials.exists():
        run(['keytool','-genkeypair','-keystore',str(keystore),'-alias',signing['alias'],
             '-storetype','JKS','-keyalg','RSA','-keysize','3072','-validity','10000',
             '-storepass:env','TUTOR_SIGNING_STORE_PASSWORD','-keypass:env','TUTOR_SIGNING_KEY_PASSWORD',
             '-dname','CN=Textbook Tutor Preview, O=Local Development, C=PK'],env=env)
        credentials.write_text(json.dumps(signing), encoding='utf8')
        print('Created private preview signing key. Back up .private securely; never publish it.', flush=True)
    build_mobile = MOBILE
    if os.getenv('TUTOR_ANDROID_BUILD_ROOT'):
        build_mobile = Path(os.environ['TUTOR_ANDROID_BUILD_ROOT']).resolve()
        if build_mobile == MOBILE or MOBILE in build_mobile.parents:
            raise RuntimeError('The short build root must be outside the mobile source directory')
        marker = build_mobile / '.tutor-build-root'
        if build_mobile.exists() and any(build_mobile.iterdir()) and not marker.exists():
            raise RuntimeError('Refusing to overwrite an unmarked build directory')
        build_mobile.mkdir(parents=True,exist_ok=True)
        marker.touch()
        def ignore(directory,names):
            ignored={'.cxx','.gradle','.expo','.env'}
            if Path(directory)==MOBILE:
                ignored.add('android')
            if Path(directory).name=='android':
                ignored.add('build')
            return [name for name in names if name in ignored]
        print(f'Staging native build at {build_mobile}',flush=True)
        excluded=[str(MOBILE / 'android'),'.cxx','.gradle','.expo']
        for directory,dirs,files in os.walk(MOBILE):
            dirs[:]=[d for d in dirs if d not in ['.cxx','.gradle','.expo'] and Path(directory)/d != MOBILE/'android']
            if Path(directory).name.lower() in ['android','reactandroid'] and 'build' in dirs:
                excluded.append(str(Path(directory)/'build'));dirs.remove('build')
        copy=subprocess.run(['robocopy',str(MOBILE),str(build_mobile),'/E','/MT:16','/R:1','/W:1','/NFL','/NDL','/NJH','/NJS','/NP','/XD',*excluded,'/XF','.env','.env.*'])
        if copy.returncode>=8:
            raise RuntimeError('Native build staging failed')
    run(['cmd','/c','npx','expo','prebuild','--platform','android','--no-install'],cwd=build_mobile,env=env)
    wrapper = build_mobile / 'android/gradle/wrapper/gradle-wrapper.properties'
    wrapper.write_text(wrapper.read_text().replace('networkTimeout=10000','networkTimeout=120000'))
    gradle_file = build_mobile / 'android/app/build.gradle'
    gradle = gradle_file.read_text()
    if 'signingConfig signingConfigs.release' not in gradle:
        raise RuntimeError('Release signing plugin was not applied; refusing debug-key release.')
    installed_gradle=ROOT.parent / 'work/tools/gradle-8.14.3/bin/gradle.bat'
    gradle_command=str(installed_gradle) if installed_gradle.exists() else 'gradlew.bat'
    run(['cmd','/c',gradle_command,'assembleRelease','--no-daemon','--console=plain','--max-workers=2',
         '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64'],cwd=build_mobile / 'android',env=env)
    source = build_mobile / 'android/app/build/outputs/apk/release/app-release.apk'
    destination = Path(os.getenv('TUTOR_APK_OUTPUT', str(ROOT.parent / 'outputs'))) / 'AI-Voice-Textbook-Tutor-v0.1.1.apk'
    destination.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(source,destination)
    print(f'APK: {destination} ({destination.stat().st_size} bytes)',flush=True)

if __name__ == '__main__':
    main()
