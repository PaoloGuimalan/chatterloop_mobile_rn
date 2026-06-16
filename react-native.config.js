/* Asset linking config — picked up by `npx react-native-asset`.
 *
 * Audio files placed in src/assets/sounds/ are copied into:
 *   - android/app/src/main/res/raw/ (already pre-seeded by hand for Android)
 *   - ios/<App>/ + added to the Xcode pbxproj as bundle resources
 *
 * Run `npx react-native-asset` after adding any new mp3/ttf here so iOS
 * pulls them into the bundle. Android works without re-running it since
 * res/raw is already populated. */

module.exports = {
  assets: ['./src/assets/sounds'],
};
