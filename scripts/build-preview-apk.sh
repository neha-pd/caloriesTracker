#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_dir/mobile"
: "${ANDROID_HOME:?Set ANDROID_HOME to your Android SDK}"
: "${JAVA_HOME:?Set JAVA_HOME to a compatible JDK}"
# Demo works without the API. For real-account LAN testing, set this explicitly.
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://fitlens-api.onrender.com}"
export FITLENS_TEST_BUILD="${FITLENS_TEST_BUILD:-false}"
npx expo prebuild --platform android --no-install
./android/gradlew -p android assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain --max-workers=4 -Dorg.gradle.jvmargs="-Xmx4g -XX:MaxMetaspaceSize=2g"
mkdir -p "$repo_dir/artifacts"
cp android/app/build/outputs/apk/release/app-release.apk "$repo_dir/artifacts/FitLens-2.0.0-preview-arm64.apk"
shasum -a 256 "$repo_dir/artifacts/FitLens-2.0.0-preview-arm64.apk"
