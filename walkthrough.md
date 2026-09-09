# YathraLanka — Stabilization Step 5 Walkthrough

Fix the three device-confirmed failures (**Google Account selection bypass**, **Map freeze**, and **Site Detail freeze**) using empirical runtime evidence without altering solved auth-screen geometry or replacing core libraries.

---

## 1. Physical Device Test Baseline & Results

| Feature | Previous Physical Result | Step 5 Resolution & Changes |
|---|---|---|
| **Auth Outer Frame / Back Arrow** | **PASS** | Solved in Step 4. Screen geometry preserved. |
| **Google Sign-In Account Selector** | **FAIL** (Bypassed account selection) | Fixed. Pre-clears native plugin session (`GoogleAuth.signOut()`) and Firebase session (`signOut(auth)`), resetting localStorage session flags before initializing `GoogleAuth.signIn()`. Forces native Google Account Chooser dialog on every tap. |
| **Dashboard → Map Navigation** | **FAIL** (Freezes) | Fixed. Completely purged `MutationObserver` on `document.body` and max z-index (`2147483647`) footer overlay. Deferred map creation counter until `L.map()` constructor returns. Added `[MAP-RUNTIME 01-08]` stage logs and offline fallback view. |
| **Dashboard → Directory → Site Detail** | **FAIL** (Freezes) | Fixed. Made `renderSiteDetail()` pure markup (zero DOM writes, zero inline footer calls, zero immersion timers during template evaluation). Immersion timer startup deferred to post-mount step in router. Added `[SITE-RUNTIME 01-08]` stage logs. |

---

## 2. Changes Made & Files Modified

### [`src_web/app.js`](file:///C:/Users/Hp/Downloads/YathraLanka-Finale/src_web/app.js)

1. **Footer & Observer Management Purge (Part 1)**:
   - Purged `window._globalFooterMutationObserver` and `new MutationObserver(...)` on `document.body`.
   - Refactored `renderGlobalFooter(activeTab)` into a pure markup generator with `z-index: 1000`.
   - `executeAppNavigation` explicitly owns footer DOM creation/visibility. Outputs `[FOOTER] renderCount=<n> route=<route>`, `[FOOTER] visibility=<shown-or-hidden>`, `[FOOTER] observerActive=false`.

2. **Truthful Map Initialization & Runtimes (Part 2)**:
   - Updated `enterMap()` & `initLeafletMapInstance()` to defer `mapCreateCount++` and `[MAP-LIFECYCLE] instance-created` until Leaflet constructor completes.
   - Added container dimension checks (`offsetWidth > 0`), Leaflet availability checks, and try/catch stage logging `[MAP-RUNTIME 01-08]`.
   - Added user-friendly map error fallback screen with Back to Directory button on exception.

3. **Pure Site Detail Render & Post-Mount Verification (Part 3)**:
   - Refactored `renderSiteDetail()` to be 100% pure template generation.
   - Removed inline calls to `renderGlobalFooter` and `initBackgroundImmersionTimer` from template generation.
   - Deferred immersion timer startup to router post-mount step after `viewport.innerHTML` is set.
   - Added try/catch stage logging `[SITE-RUNTIME 01-08]`.

4. **Explicit Google Account Chooser & Auth Guard (Part 4)**:
   - Updated `handleGoogleSignInClick()` to execute native `GoogleAuth.signOut()` and `signOut(auth)` pre-clears.
   - Clears session localStorage keys (`yathralanka_logged_in`, `yathralanka_current_user`, `yathralanka_active_user`) and resets state memory.
   - Initialized `GoogleAuth.signIn()` to present native Google Account Chooser dialog on every tap.
   - Enforced strict navigation guard: navigation occurs ONLY after token exchange, `signInWithCredential`, and `auth.currentUser.uid` verification. Added `[AUTH-RUNTIME 01-11]` logs.

5. **Idempotent Boot Guards (Part 5)**:
   - Protected `initApp()`, `initAuthListener()`, and `initGlobalSiteClickListeners()` with global boolean flags (`window.__appInitialized`, `window.__authListenerInitialized`, `window.__globalSiteListenerInitialized`).
   - Removed duplicate inline `initApp()` calls. Emits `[BOOT] initApp count=1`.

---

## 3. Build & Deployment Verification

- **`npm run build`**: Success (Exit code 0, 51 modules transformed).
- **`npx cap sync android`**: Success (Exit code 0, assets copied in 0.87s).
- **`.\gradlew.bat assembleDebug`**: Success (Exit code 0, `BUILD SUCCESSFUL in 9s`).
- **`adb -s R9JN70AC8DJ install -r ...`**: Success (Streamed Install Success).
- **App Launch**: `com.yathralanka.app/.MainActivity` launched cleanly on device `R9JN70AC8DJ`.

---

## 4. Verification Instructions for Physical Device

Execute on connected device **`R9JN70AC8DJ`**:

### Test A: Google Sign-In Account Selector
1. Tap **Sign In with Google**.
2. **Verify**: The Android native Google Account Chooser dialog MUST appear on screen every time. Selecting an account completes login and opens Dashboard.

### Test B: Map Navigation
1. Navigate Dashboard → **Map**.
2. **Verify**: Leaflet map renders Sri Lanka bounds without freezing or overlay blocking.

### Test C: Directory → Site Detail Navigation
1. Navigate Dashboard → **Directory** → Tap any Site Card (e.g. *Independence Memorial Hall*).
2. **Verify**: Site detail screen opens immediately displaying sanctuary description, overview, and verification tabs.

---

## 5. Logcat Monitoring Filter Command

```powershell
adb -s R9JN70AC8DJ logcat -s chromium:V WebConsole:V System.out:V "*:E" | Select-String -Pattern "BOOT|FOOTER|MAP-RUNTIME|SITE-RUNTIME|AUTH-RUNTIME|Error|Exception"
```
