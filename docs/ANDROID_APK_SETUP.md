# Standalone Android APK

Package `com.gillanigames.voicetextbooktutor`, version `0.1.0`, version code `1`. Preview builds bundle JavaScript and do not require Expo Go or Metro. Microphone permission is requested at runtime. INTERNET permits LAN requests. Preview permits private-LAN HTTP; production config disables cleartext.

Build from the repository root after installing Node 22, a compatible JDK and Android SDK:

```powershell
cd mobile
npm ci --legacy-peer-deps
cd ..
python scripts/build_apk.py
```

The script prebuilds the native project and runs signed `assembleRelease`, with arm64-v8a, armeabi-v7a and x86_64 support. Private signing material is generated once under `.private`, ignored by Git. Back up the matching keystore and credential file securely: updates require the same key. Never publish either file. This preview key is separate from any existing Play Store signing key. No APK is committed to source.

EAS alternative: `cd mobile`, `eas login`, then `eas build -p android --profile preview`. EAS is not authenticated in this environment. The profile produces APK, not AAB. EAS manages signing separately. Production profile also builds APK with HTTPS-only networking.

Install only the APK supplied with build verification evidence. Enable installation from your trusted file source when Android asks. Open Settings, enter the URL printed by `start_server.bat`, and tap Test connection and save. Then choose Class 11 -> Chemistry -> Chapter 1 and ask “What is ionization energy?”; extractive evidence includes original PDF page 12. Class 12 English is partially indexed; unindexed books are explicitly disabled.

See WINDOWS_SERVER_SETUP.md and NETWORK_TROUBLESHOOTING.md. APK compilation, inspection and emulator/device evidence are recorded in progress.md; do not interpret a JavaScript bundle as a completed APK.
