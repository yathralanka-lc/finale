# Walkthrough — YathraLanka Stabilization Step 4: Fixed Verified Remaining Defects

## Repository & Commit Metadata
- **Repository**: https://github.com/yathralanka-lc/finale
- **Branch**: `main`
- **Final Commit SHA**: `68814d3`
- **Device Status**: **UNTESTED** (Awaiting physical device manual verification on device `R9JN70AC8DJ` by Rajitha)
- **APK Path**: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## Exact Files Changed
- [`src_web/app.js`](file:///C:/Users/Hp/Downloads/YathraLanka-Finale/src_web/app.js)

---

## Exact Functions Changed & Fix Details

### 1. Auth UI Frame & Duplicate Back Arrow Removal
- **Functions Changed**: `renderLogin()`, `renderSignUp()`, `executeAppNavigation()`.
- **Fix**: Removed extra outer `.screen.auth-screen-container` wrappers and `#login-back` / `#signup-back` buttons from `renderLogin()` and `renderSignUp()`. They now return `renderAuthCard('signin')` and `renderAuthCard('signup')` directly.
- **Verification Log**: Added `[AUTH-UI] outerWrappers=1 backButtons=0` check inside `executeAppNavigation`.

### 2. Map Render / Initialization Order Correction
- **Functions Changed**: `renderMapScreen()`, `executeAppNavigation()`, `leaveMap()`, `enterMap()`.
- **Fix**:
  - Removed `setTimeout(() => initLeafletMapInstance(), 50)` from `renderMapScreen()` so it returns HTML markup ONLY.
  - Reordered `executeAppNavigation()`: calls `leaveMap()` before replacing DOM, assigns `viewport.innerHTML = htmlContent`, verifies `#map` is connected in DOM, and schedules single `enterMap()` call via `requestAnimationFrame`.
- **Verification Logs**:
  - `[MAP-LIFECYCLE] before-render`
  - `[MAP-LIFECYCLE] dom-mounted connected=true`
  - `[MAP-LIFECYCLE] instance-created`
  - `[MAP-LIFECYCLE] instance-destroyed`
  - `[MAP-LIFECYCLE] invariant activeInstances=<0-or-1>`

### 3. Directory → Site Parameter Resolution
- **Functions Changed**: `resolveSiteFromId()`, `executeAppNavigation()`.
- **Fix**:
  - Added canonical site resolver `window.resolveSiteFromId(requestedId)` matching against `id`, `slug`, `name` across directory & site datasets.
  - In `executeAppNavigation()`, resolved `params.id` before calling `renderSiteDetail(resolvedSite)`, assigning `window.state.activeSite` & `window.state.selectedSite`.
  - Removed lingering preview drawers before rendering detail.
  - Displays controlled fallback error view if site resolution fails.
- **Verification Logs**:
  - `[SITE-NAV] requestedId=<id>`
  - `[SITE-NAV] resolvedId=<id-or-null>`
  - `[SITE-NAV] detail-render-start`
  - `[SITE-NAV] detail-render-complete`

### 4. Firebase Google Auth Guard Verification
- **Functions Changed**: `handleGoogleSignInClick()`.
- **Fix**: Kept real native/web Firebase authentication. Retained strict guard preventing navigation to `home` if `fbUser.uid` is absent.

### 5. Single Router Invariant Verification
- **Functions Changed**: `navigate()`, `renderActiveScreen()`, `navigateToDashboard()`.
- **Fix**: Verified all navigation wrappers delegate ONLY to `window.executeAppNavigation`.

---

## Build & Deployment Results
- `npm run build`: **SUCCESS** (Exit code 0, 51 modules transformed)
- `npx cap sync android`: **SUCCESS** (Exit code 0, web assets copied to Android container)
- `.\gradlew.bat assembleDebug`: **SUCCESS** (Exit code 0, BUILD SUCCESSFUL in 14s)
- `adb install -r`: **SUCCESS** (Streamed Install Success on device `R9JN70AC8DJ`)

---

## Device Logcat Filter Command
```powershell
adb -s R9JN70AC8DJ logcat -s chromium:V WebConsole:V System.out:V "*:E" | Select-String -Pattern "AUTH-GOOGLE|AUTH-UI|MAP-LIFECYCLE|SITE-NAV|NAV-COUNT|NAV|Error|Exception"
```

## Device Manual Verification Test Sequence (for Rajitha)
1. **TEST A — AUTH UI**:
   - Open app -> Tap Sign In.
   - Verify: Cream outer margin frame is gone, no standalone `←` back button above logo, `[AUTH-UI] outerWrappers=1 backButtons=0` logged.
2. **TEST B — MAP INITIALIZATION ORDER**:
   - Tap Open Heritage Map.
   - Verify: Map mounts smoothly, `[MAP-LIFECYCLE] dom-mounted connected=true` logs before `instance-created`, pan/zoom works cleanly.
3. **TEST C — DIRECTORY → SITE PARAMETER RESOLUTION**:
   - Go to Directory -> Tap "Independence Memorial Hall" site card or preview CTA.
   - Verify: `[SITE-NAV] requestedId=independence_memorial_hall` resolves to `independence_memorial_hall`, landmark details load completely without freeze.
4. **TEST D — GOOGLE AUTH GUARD**:
   - Tap Google Sign-In button and cancel account picker.
   - Verify: Loading overlay disappears, error notification shown, app STAYS on sign-in screen without entering dashboard.
