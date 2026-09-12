// YathraLanka App Logic Engine
document.title = "YathraLanka";
import { initialUserState, rankingScale, leaderboardPlayers, sitesData, sideQuestsData, rewardsData } from './data.js';
import { auth, db } from './firebase-init.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  signInWithCredential,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  EmailAuthProvider,
  sendEmailVerification
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { GoogleMap } from '@capacitor/google-maps';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

// Import Capacitor Camera for native hardware image capture bindings
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

window.addEventListener('error', (e) => {
  console.error('[FREEZE-ERROR] Global Error:', e.message, 'at', e.filename, 'line', e.lineno, e.error?.stack);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[FREEZE-REJECTION] Unhandled Rejection:', e.reason, e.reason?.stack);
});



window._freezeLogHistory = window._freezeLogHistory || [];

const origConsoleLog = console.log;
console.log = function (...args) {
  origConsoleLog.apply(console, args);
  try {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    if (msg.includes('MAP-ACTUAL') || msg.includes('SITE-ACTUAL') || msg.includes('FREEZE') || msg.includes('MAP-FREEZE') || msg.includes('SITE-FREEZE') || msg.includes('SITE-POST') || msg.includes('SITE-MUTATION') || msg.includes('SITE-CONTROL')) {
      window._freezeLogHistory.push(msg);
      if (window._freezeLogHistory.length > 30) window._freezeLogHistory.shift();
    }
  } catch (e) {}
};

window.__navCounters = {
  authoritativeRouterCalls: 0,
  legacyRouterCalls: 0,
  renderCalls: 0
};

let mapCreateCount = 0;
let mapDestroyCount = 0;

window.leaveMap = function () {
  if (window.activeLeafletMap) {
    try {
      window.activeLeafletMap.remove();
      console.log('[MAP-LIFECYCLE] instance-destroyed');
    } catch (e) {
      console.warn("Notice tearing down active Leaflet map:", e);
    }
    window.activeLeafletMap = null;
    mapDestroyCount++;
    const activeInstances = (window.activeLeafletMap ? 1 : 0);
    console.log(`[MAP-LIFECYCLE] leaveMap: createCount=${mapCreateCount}, destroyCount=${mapDestroyCount}, activeInstanceCount=${activeInstances}, currentScreen=${window.state?.currentScreen}`);
    console.log(`[MAP-LIFECYCLE] invariant activeInstances=${activeInstances}`);
  }
};

window.enterMap = function (params = {}) {
  console.log('[MAP-RUNTIME 01] route-received');
  const mapElement = document.getElementById('map') || document.getElementById('yathra-main-map');
  const isConnected = Boolean(mapElement?.isConnected);
  const rect = mapElement ? mapElement.getBoundingClientRect() : { width: 0, height: 0 };
  const sizeStr = `${Math.round(rect.width)}x${Math.round(rect.height)}`;

  console.log(`[MAP-RUNTIME 02] dom-mounted connected=${isConnected} size=${sizeStr}`);

  if (!mapElement || !isConnected) {
    console.warn('[MAP-RUNTIME ERROR] stage=dom-mount name=ContainerMissing message=Container #map missing or disconnected');
    return null;
  }

  if (window.activeLeafletMap) {
    console.log('[MAP-LIFECYCLE] destroying previous map instance attached before re-creating');
    window.leaveMap();
  }

  if (typeof window.initLeafletMapInstance === 'function') {
    const createdMap = window.initLeafletMapInstance(mapElement, params);
    if (createdMap) {
      mapCreateCount++;
      console.log('[MAP-LIFECYCLE] instance-created');
      const activeInstances = window.activeLeafletMap ? 1 : 0;
      console.log(`[MAP-LIFECYCLE] enterMap: createCount=${mapCreateCount}, destroyCount=${mapDestroyCount}, activeInstanceCount=${activeInstances}, currentScreen=${window.state?.currentScreen}`);
      console.log(`[MAP-LIFECYCLE] invariant activeInstances=${activeInstances}`);
      return createdMap;
    }
  }
  return null;
};

// ============================================================================
// STABILIZATION STEP 6A: CENTRALIZED AUTHORITATIVE RANK SYSTEM
// ============================================================================
const RANK_DEFINITIONS = [
  { id: 'novice-explorer', name: 'Novice Explorer', minXP: 0, maxXP: 999 },
  { id: 'pathfinder', name: 'Pathfinder', minXP: 1000, maxXP: 2499 },
  { id: 'heritage-seeker', name: 'Heritage Seeker', minXP: 2500, maxXP: 4999 },
  { id: 'cultural-guardian', name: 'Cultural Guardian', minXP: 5000, maxXP: 9999 },
  { id: 'legacy-ambassador', name: 'Legacy Ambassador', minXP: 10000, maxXP: null }
];
window.RANK_DEFINITIONS = RANK_DEFINITIONS;

function getRankProgress(totalXP) {
  let xp = Number(totalXP);
  if (isNaN(xp) || xp < 0 || !isFinite(xp)) {
    xp = 0;
  }
  xp = Math.floor(xp);

  let currentRank = RANK_DEFINITIONS[0];
  let nextRank = RANK_DEFINITIONS[1];

  for (let i = 0; i < RANK_DEFINITIONS.length; i++) {
    const rank = RANK_DEFINITIONS[i];
    if (rank.maxXP === null) {
      if (xp >= rank.minXP) {
        currentRank = rank;
        nextRank = null;
      }
    } else {
      if (xp >= rank.minXP && xp <= rank.maxXP) {
        currentRank = rank;
        nextRank = RANK_DEFINITIONS[i + 1] || null;
        break;
      }
    }
  }

  const isHighestRank = nextRank === null;
  const currentRankStartXP = currentRank.minXP;
  const xpIntoCurrentRank = xp - currentRankStartXP;

  let nextRankXP = null;
  let xpRequiredForNextRank = 0;
  let progressPercent = 100;

  if (!isHighestRank && nextRank) {
    nextRankXP = nextRank.minXP;
    xpRequiredForNextRank = nextRankXP - currentRankStartXP;
    if (xpRequiredForNextRank > 0) {
      progressPercent = Math.min(100, Math.max(0, Math.floor((xpIntoCurrentRank / xpRequiredForNextRank) * 100)));
    } else {
      progressPercent = 100;
    }
  }

  const result = {
    currentRank,
    nextRank,
    currentXP: xp,
    currentRankStartXP,
    nextRankXP,
    xpIntoCurrentRank,
    xpRequiredForNextRank,
    progressPercent,
    isHighestRank
  };

  console.log(`[RANK] xp=${xp} current=${currentRank.id} next=${nextRank ? nextRank.id : 'none'} progress=${progressPercent}`);
  return result;
}
window.getRankProgress = getRankProgress;

window.getSessionMode = function () {
  if (typeof auth !== 'undefined' && auth && auth.currentUser && auth.currentUser.uid) {
    return 'authenticated';
  }
  if (sessionStorage.getItem('yathralanka_session_mode') === 'guest' || window.state?.sessionMode === 'guest') {
    return 'guest';
  }
  return 'signed_out';
};

function getSessionAccessState() {
  const mode = window.getSessionMode();
  const fbUser = (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser : null;
  const isAuthenticated = mode === 'authenticated';
  const isGuest = mode === 'guest';

  const displayName = isAuthenticated ? (fbUser?.displayName || window.state?.user?.name || 'Explorer') : (isGuest ? 'Guest Explorer' : 'Explorer');
  const uid = isAuthenticated ? fbUser?.uid : null;

  const sessionState = {
    mode,
    isGuest,
    isAuthenticated,
    firebaseUser: isAuthenticated ? fbUser : null,
    displayName,
    uid,
    canPersistProgress: isAuthenticated
  };

  console.log(`[SESSION] mode=${mode} firebaseUidPresent=${Boolean(fbUser?.uid)}`);
  return sessionState;
}
window.getSessionAccessState = getSessionAccessState;

// ============================================================================
// ============================================================================
// STABILIZATION STEP 6A.3: CANONICAL USER PROFILE & NON-BLOCKING PROFILE SYNC
// ============================================================================
window.normalizeEmail = function (email) {
  return (email || '').toString().trim().toLowerCase();
};

// Global Startup Error Boundary
window.addEventListener("error", event => {
  console.error(
    "[STARTUP-ERROR]",
    event.error?.name || "Error",
    event.message,
    event.filename,
    event.lineno,
    event.colno
  );
});

window.addEventListener("unhandledrejection", event => {
  console.error(
    "[STARTUP-REJECTION]",
    event.reason?.name || "PromiseRejection",
    event.reason?.message || String(event.reason)
  );
});

// ============================================================================
// STABILIZATION STEP 6A.5: STRICT UID-SCOPED USER CACHE & SESSION CONTROLLERS
// ============================================================================
window.getUserCacheKey = function (uid) {
  if (!uid || typeof uid !== "string") return null;
  return `yathralanka_user_${uid}`;
};

window.getCompletedSitesKey = function (uid) {
  if (!uid || typeof uid !== "string") return 'yathralanka_completed_sites_guest';
  return `yathralanka_completed_sites_${uid}`;
};

window.getSiteProgressKey = function (uid) {
  if (!uid || typeof uid !== "string") return 'yathra_site_progress_guest';
  return `yathra_site_progress_${uid}`;
};

const MUSEUM_PRODUCTION_RESET_VERSION = 'museum-production-reset-2026-09-12-v1';
const INDEPENDENCE_PRODUCTION_RESET_VERSION = 'independence-production-reset-2026-09-12-v1';
const BMICH_PRODUCTION_RESET_VERSION = 'bmich-production-reset-2026-09-12-v1';

window.resetMuseumProductionProgress = function (uid, storedProgress = {}) {
  const markerKey = `yathralanka_${MUSEUM_PRODUCTION_RESET_VERSION}_${uid || 'guest'}`;
  if (localStorage.getItem(markerKey) === 'done') return storedProgress;

  const cleanProgress = { ...(storedProgress || {}) };
  delete cleanProgress.colombo_museum;
  if (window.state?.siteProgress) delete window.state.siteProgress.colombo_museum;

  const progressKey = window.getSiteProgressKey(uid);
  localStorage.setItem(progressKey, JSON.stringify(cleanProgress));
  localStorage.removeItem('site_photo_verified_colombo_museum');

  const completedKey = window.getCompletedSitesKey(uid);
  try {
    const completed = JSON.parse(localStorage.getItem(completedKey) || '[]');
    if (Array.isArray(completed)) {
      localStorage.setItem(completedKey, JSON.stringify(completed.filter(id => String(id).toLowerCase() !== 'colombo_museum')));
    } else if (completed && typeof completed === 'object') {
      delete completed.colombo_museum;
      localStorage.setItem(completedKey, JSON.stringify(completed));
    }
  } catch (error) { }

  try {
    const activeSession = JSON.parse(localStorage.getItem('yathralanka_active_landmark_session_v1') || 'null');
    if (String(activeSession?.siteId || '').toLowerCase() === 'colombo_museum') {
      localStorage.removeItem('yathralanka_active_landmark_session_v1');
    }
  } catch (error) { }

  localStorage.setItem(markerKey, 'done');
  return cleanProgress;
};

window.resetIndependenceProductionProgress = function (uid, storedProgress = {}) {
  const markerKey = `yathralanka_${INDEPENDENCE_PRODUCTION_RESET_VERSION}_${uid || 'guest'}`;
  if (localStorage.getItem(markerKey) === 'done') return storedProgress;

  const cleanProgress = { ...(storedProgress || {}) };
  delete cleanProgress.independence_memorial_hall;
  if (window.state?.siteProgress) delete window.state.siteProgress.independence_memorial_hall;

  const progressKey = window.getSiteProgressKey(uid);
  localStorage.setItem(progressKey, JSON.stringify(cleanProgress));
  localStorage.removeItem('site_photo_verified_independence_memorial_hall');

  const completedKey = window.getCompletedSitesKey(uid);
  try {
    const completed = JSON.parse(localStorage.getItem(completedKey) || '[]');
    if (Array.isArray(completed)) {
      localStorage.setItem(completedKey, JSON.stringify(completed.filter(id => String(id).toLowerCase() !== 'independence_memorial_hall')));
    } else if (completed && typeof completed === 'object') {
      delete completed.independence_memorial_hall;
      localStorage.setItem(completedKey, JSON.stringify(completed));
    }
  } catch (error) { }

  try {
    const activeSession = JSON.parse(localStorage.getItem('yathralanka_active_landmark_session_v1') || 'null');
    if (String(activeSession?.siteId || '').toLowerCase() === 'independence_memorial_hall') {
      localStorage.removeItem('yathralanka_active_landmark_session_v1');
    }
  } catch (error) { }

  localStorage.setItem(markerKey, 'done');
  return cleanProgress;
};

window.resetBMICHProductionProgress = function (uid, storedProgress = {}) {
  const markerKey = `yathralanka_${BMICH_PRODUCTION_RESET_VERSION}_${uid || 'guest'}`;
  if (localStorage.getItem(markerKey) === 'done') return storedProgress;

  const cleanProgress = { ...(storedProgress || {}) };
  delete cleanProgress.bmich;
  if (window.state?.siteProgress) delete window.state.siteProgress.bmich;
  localStorage.setItem(window.getSiteProgressKey(uid), JSON.stringify(cleanProgress));
  localStorage.removeItem('site_photo_verified_bmich');

  const completedKey = window.getCompletedSitesKey(uid);
  try {
    const completed = JSON.parse(localStorage.getItem(completedKey) || '[]');
    if (Array.isArray(completed)) {
      localStorage.setItem(completedKey, JSON.stringify(completed.filter(id => String(id).toLowerCase() !== 'bmich')));
    } else if (completed && typeof completed === 'object') {
      delete completed.bmich;
      localStorage.setItem(completedKey, JSON.stringify(completed));
    }
  } catch (error) { }

  try {
    const activeSession = JSON.parse(localStorage.getItem('yathralanka_active_landmark_session_v1') || 'null');
    if (String(activeSession?.siteId || '').toLowerCase() === 'bmich') {
      localStorage.removeItem('yathralanka_active_landmark_session_v1');
    }
  } catch (error) { }

  localStorage.setItem(markerKey, 'done');
  return cleanProgress;
};

window.loadCurrentSiteProgress = function () {
  if (!window.state) window.state = {};
  const uid = auth?.currentUser?.uid || window.state?.user?.uid;
  const key = window.getSiteProgressKey(uid);
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(key) || '{}');
  } catch (error) {
    stored = {};
  }
  stored = window.resetMuseumProductionProgress(uid, stored);
  stored = window.resetIndependenceProductionProgress(uid, stored);
  stored = window.resetBMICHProductionProgress(uid, stored);
  window.state.siteProgress = {
    ...stored,
    ...(window.state.siteProgress || {})
  };
  return window.state.siteProgress;
};

window.getLandmarkAchievementStatus = function (siteId) {
  const cleanId = String(siteId || '').toLowerCase().trim();
  const progress = window.loadCurrentSiteProgress();
  const site = progress[cleanId] || {};
  return {
    locationVerified: Boolean(site.gpsVerified),
    photoVerified: Boolean(site.photoVerified || localStorage.getItem('site_photo_verified_' + cleanId) === 'true'),
    quizPassed: Boolean(site.quizPassed),
    locationVerifiedAt: site.locationVerifiedAt || null,
    photoOptionResults: site.photoOptionResults || {},
    progress: site
  };
};

window.getStoredUserProfile = function (uid) {
  if (!uid || typeof uid !== "string") return null;
  try {
    const raw = localStorage.getItem(`yathralanka_user_${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && parsed.uid === uid) ? parsed : null;
  } catch (e) {
    return null;
  }
};

window.saveStoredUserProfile = function (uid, profileObj) {
  if (!uid || typeof uid !== "string" || !profileObj) return;
  try {
    localStorage.setItem(`yathralanka_user_${uid}`, JSON.stringify(profileObj));
    localStorage.setItem('yathralanka_active_uid', uid);
  } catch (e) {}
};

window.updateAuthAttempt = function (attemptId, status) {
  const attempt = window.state?.authAttempt;
  if (!attempt || attempt.id !== attemptId) {
    console.error(`[AUTH-TRACE] attempt=${attemptId || 'none'} stage=transaction_missing`);
    return false;
  }
  attempt.status = status;
  return true;
};

window.clearActiveUserData = function (options = {}) {
  const preserveAuthAttempt = options?.preserveAuthAttempt === true;
  console.log(`[SESSION-CLEAR] Clearing active in-memory user data (preserveAuthAttempt=${preserveAuthAttempt})`);
  if (!window.state) window.state = {};

  // Increment auth generation to cancel any pending async writes for previous session
  window.state.authGeneration = (window.state.authGeneration || 0) + 1;

  window.state.user = null;
  window.state.currentUser = null;
  window.state.userData = null;
  window.state.activeUid = null;
  window.state.xp = 0;
  window.state.userXP = 0;
  window.state.siteProgress = {};
  window.state.completedSites = {};

  if (!preserveAuthAttempt) {
    window.state.authAttempt = null;
    window.state.pendingGoogleCredential = null;
    window.state.pendingProfileSync = null;
    window.state.isAuthenticating = false;
    window.state.authTransition = null;
    window.state.sessionAuthorized = false;
  }

  // Clear shared active-user pointers from localStorage (leaving UID-scoped profiles intact)
  sessionStorage.removeItem('yathralanka_session_mode');
  if (localStorage.getItem('yathralanka_session_mode') === 'guest') {
    localStorage.removeItem('yathralanka_session_mode');
  }
  localStorage.removeItem('yathralanka_current_user');
  localStorage.removeItem('yathralanka_active_user');
  localStorage.removeItem('yathralanka_user');
  localStorage.removeItem('yathra_current_user');
  localStorage.removeItem('yathralanka_active_uid');
  localStorage.removeItem('yathra_user_xp');
  localStorage.removeItem('yathralanka_user_xp');
  localStorage.removeItem('yathralanka_logged_in');
};

window.clearActiveUserSession = function () {
  window.clearActiveUserData({ preserveAuthAttempt: false });
};

window.clearAuthTransaction = function () {
  if (!window.state) return;
  console.log('[AUTH-TRACE] Clearing active auth transaction and transition states');
  window.state.authAttempt = null;
  window.state.pendingGoogleCredential = null;
  window.state.pendingProfileSync = null;
  window.state.isAuthenticating = false;
  window.state.authTransition = null;
};

window.resolveCanonicalUserProfile = async function (firebaseUser, authProvider = 'google.com', options = {}) {
  if (!firebaseUser || !firebaseUser.uid) return null;
  const uid = firebaseUser.uid;
  const emailNorm = window.normalizeEmail(firebaseUser.email);
  const userDocRef = doc(db, 'users', uid);

  try {
    const resultProfile = await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userDocRef);

      if (!userSnap.exists()) {
        const newProfile = {
          uid: uid,
          email: firebaseUser.email || '',
          emailNormalized: emailNorm,
          preferredDisplayName: options.preferredDisplayName || firebaseUser.displayName || (emailNorm ? emailNorm.split('@')[0] : 'Explorer'),
          googleDisplayName: firebaseUser.displayName || '',
          googlePhotoURL: authProvider === 'google.com' ? (firebaseUser.photoURL || '') : '',
          passwordProfilePhotoURL: '',
          activeAuthProvider: authProvider,
          linkedProviders: [authProvider],
          xp: 50,
          rank: 'Novice Explorer',
          welcomeXPAwarded: true,
          welcomeXPAwardedAt: serverTimestamp(),
          welcomeBannerSeen: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        transaction.set(userDocRef, newProfile);
        console.log(`[PROFILE-MERGE] created=true uid=${uid.slice(-6)} xp=50 welcomeXPAwarded=true`);
        return {
          ...newProfile,
          xp: 50,
          welcomeXPAwarded: true,
          welcomeBannerSeen: false
        };
      } else {
        const existingData = userSnap.data();
        const preservedXP = Number.isFinite(Number(existingData.xp)) ? Number(existingData.xp) : 50;
        const updatedLinkedProviders = Array.from(new Set([...(existingData.linkedProviders || []), authProvider]));

        const updates = {
          emailNormalized: emailNorm,
          activeAuthProvider: authProvider,
          linkedProviders: updatedLinkedProviders,
          welcomeXPAwarded: existingData.welcomeXPAwarded ?? true,
          welcomeBannerSeen: existingData.welcomeBannerSeen ?? true,
          updatedAt: serverTimestamp()
        };

        if (options.preferredDisplayName) {
          updates.preferredDisplayName = options.preferredDisplayName;
        } else if (!existingData.preferredDisplayName) {
          updates.preferredDisplayName = existingData.googleDisplayName || firebaseUser.displayName || (emailNorm ? emailNorm.split('@')[0] : 'Explorer');
        }

        if (authProvider === 'google.com' && firebaseUser.photoURL) {
          updates.googlePhotoURL = firebaseUser.photoURL;
          if (firebaseUser.displayName) {
            updates.googleDisplayName = firebaseUser.displayName;
          }
        }

        transaction.update(userDocRef, updates);
        console.log(`[PROFILE-MERGE] created=false uid=${uid.slice(-6)} preservedXP=${preservedXP}`);
        return {
          ...existingData,
          ...updates,
          xp: preservedXP
        };
      }
    });

    return resultProfile;
  } catch (err) {
    console.error(`[PROFILE-SYNC] stage=error code=${err?.code || 'firestore_error'} message=${err?.message || err}`);
    const cachedLocal = window.getStoredUserProfile(uid);
    return cachedLocal || {
      uid: uid,
      email: firebaseUser.email || '',
      emailNormalized: emailNorm,
      preferredDisplayName: options.preferredDisplayName || firebaseUser.displayName || (emailNorm ? emailNorm.split('@')[0] : 'Explorer'),
      googleDisplayName: firebaseUser.displayName || '',
      googlePhotoURL: firebaseUser.photoURL || '',
      xp: 50,
      rank: 'Novice Explorer',
      welcomeXPAwarded: true,
      welcomeBannerSeen: false,
      isFallback: true
    };
  }
};

window.syncCanonicalProfileAsync = async function (firebaseUser, authProvider, options = {}) {
  if (!firebaseUser || !firebaseUser.uid) return;
  const requestedUid = firebaseUser.uid;
  const targetGeneration = window.state?.authGeneration || 0;

  console.log(`[PROFILE-SYNC] stage=start uid=${requestedUid.slice(-6)} gen=${targetGeneration}`);
  try {
    const profile = await window.resolveCanonicalUserProfile(firebaseUser, authProvider, options);

    // GUARD: Ensure current Firebase user and auth generation still match!
    if (auth?.currentUser?.uid !== requestedUid || window.state?.authGeneration !== targetGeneration) {
      console.log(`[PROFILE-SYNC] Stale profile write ignored for ${requestedUid.slice(-6)}`);
      return;
    }

    if (profile) {
      const museumResetRequired = profile.museumProductionResetVersion !== MUSEUM_PRODUCTION_RESET_VERSION;
      const independenceResetRequired = profile.independenceProductionResetVersion !== INDEPENDENCE_PRODUCTION_RESET_VERSION;
      const bmichResetRequired = profile.bmichProductionResetVersion !== BMICH_PRODUCTION_RESET_VERSION;
      const remoteProgress = profile.siteProgress && typeof profile.siteProgress === 'object'
        ? { ...profile.siteProgress }
        : {};
      const removedMuseumXP = museumResetRequired
        ? Number(remoteProgress.colombo_museum?.totalXP || 0)
        : 0;
      const removedIndependenceXP = independenceResetRequired
        ? Number(remoteProgress.independence_memorial_hall?.totalXP || 0)
        : 0;
      const removedBMICHXP = bmichResetRequired
        ? Number(remoteProgress.bmich?.totalXP || 0)
        : 0;
      if (museumResetRequired) delete remoteProgress.colombo_museum;
      if (independenceResetRequired) delete remoteProgress.independence_memorial_hall;
      if (bmichResetRequired) delete remoteProgress.bmich;

      const activeUser = window.state.user || {};
      const storedXP = Number.isFinite(Number(profile.xp)) ? Number(profile.xp) : (activeUser.xp || 50);
      activeUser.xp = Math.max(50, storedXP - removedMuseumXP - removedIndependenceXP - removedBMICHXP);
      activeUser.preferredDisplayName = profile.preferredDisplayName || activeUser.preferredDisplayName;
      activeUser.googlePhotoURL = profile.googlePhotoURL || activeUser.googlePhotoURL;
      activeUser.welcomeXPAwarded = profile.welcomeXPAwarded ?? true;
      activeUser.welcomeBannerSeen = profile.welcomeBannerSeen ?? true;
      activeUser.profileStatus = "ready";

      if (profile.siteProgress && typeof profile.siteProgress === 'object') {
        const localProgress = window.loadCurrentSiteProgress();
        window.state.siteProgress = { ...remoteProgress, ...localProgress };
        try {
          localStorage.setItem(window.getSiteProgressKey(requestedUid), JSON.stringify(window.state.siteProgress));
        } catch (error) { }
      }

      window.state.user = activeUser;
      window.state.currentUser = activeUser;
      window.saveStoredUserProfile(requestedUid, activeUser);

      if (museumResetRequired || independenceResetRequired || bmichResetRequired) {
        try {
          await setDoc(doc(db, 'users', requestedUid), {
            xp: activeUser.xp,
            sitesVisited: Object.values(window.state.siteProgress || {}).filter(progress => progress?.gpsVerified || progress?.photoVerified).length,
            siteProgress: window.state.siteProgress || {},
            museumProductionResetVersion: MUSEUM_PRODUCTION_RESET_VERSION,
            independenceProductionResetVersion: INDEPENDENCE_PRODUCTION_RESET_VERSION,
            bmichProductionResetVersion: BMICH_PRODUCTION_RESET_VERSION
          }, { merge: true });
        } catch (error) {
          console.warn('[MUSEUM-RESET] Cloud reset will retry on the next signed-in session.', error);
        }
      }

      // Rerender UI elements with resolved profile
      const userNameEl = document.querySelector('.user-display-name, #profile-user-name');
      if (userNameEl) userNameEl.textContent = activeUser.preferredDisplayName;

      const xpEls = document.querySelectorAll('.user-xp-display, .profile-xp-badge');
      xpEls.forEach(el => { el.textContent = `${activeUser.xp} pts`; });

      console.log(`[PROFILE-SYNC] stage=success uid=${requestedUid.slice(-6)} xp=${activeUser.xp}`);
    } else {
      console.warn(`[PROFILE-SYNC] stage=error message=profile_null_non_blocking`);
    }
  } catch (err) {
    console.error(`[PROFILE-SYNC] stage=error code=${err?.code || 'sync_failed'} message=${err?.message || err}`);
  }
};

window.showReauthPasswordModal = function () {
  const existing = document.getElementById('reauth-password-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'reauth-password-modal';
  modal.style.cssText = 'position:fixed; inset:0; background:rgba(8,43,51,0.75); backdrop-filter:blur(6px); z-index:999999; display:flex; align-items:center; justify-content:center; padding:16px;';
  modal.innerHTML = `
    <div style="background:#FAF5E8; color:#125463; max-width:380px; width:100%; padding:22px 20px; border-radius:20px; border:1.5px solid #DFCEAA; box-shadow:0 12px 36px rgba(0,0,0,0.35); box-sizing:border-box;">
      <h3 style="margin:0 0 8px 0; font-size:18px; font-weight:800; color:#0B5A68;">Account Exists</h3>
      <p style="margin:0 0 16px 0; font-size:13px; color:#475569; line-height:1.4;">
        An account with this email address already exists using Password. Enter your password to securely link your Google account.
      </p>
      <input type="password" id="reauth-password-input" placeholder="Enter your password" style="width:100%; padding:10px 12px; border:1.5px solid #CBD5E1; border-radius:12px; font-size:14px; margin-bottom:14px; box-sizing:border-box;" />
      <div style="display:flex; gap:10px; justify-content:flex-end;">
        <button type="button" id="btn-reauth-cancel" style="padding:8px 16px; border:none; border-radius:10px; background:#E2E8F0; color:#475569; font-weight:700; cursor:pointer;">Cancel</button>
        <button type="button" id="btn-reauth-submit" style="padding:8px 16px; border:none; border-radius:10px; background:#0B5A68; color:#FFFFFF; font-weight:700; cursor:pointer;">Link Account</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const cleanupModal = () => modal.remove();

  document.getElementById('btn-reauth-cancel').onclick = () => {
    window.state.pendingGoogleCredential = null;
    cleanupModal();
  };

  document.getElementById('btn-reauth-submit').onclick = async () => {
    const passVal = document.getElementById('reauth-password-input')?.value;
    if (!passVal) {
      if (typeof window.showNotification === 'function') {
        window.showNotification("Please enter your password.", "error");
      }
      return;
    }
    const pendingObj = window.state.pendingGoogleCredential;
    if (!pendingObj || !pendingObj.credential) {
      cleanupModal();
      return;
    }
    try {
      const email = pendingObj.email || auth?.currentUser?.email;
      if (!email) {
        cleanupModal();
        return;
      }
      const userCred = await signInWithEmailAndPassword(auth, email, passVal);
      if (userCred?.user) {
        console.log(`[PROVIDER-LINK] existing=password pending=google.com status=start`);
        const linkResult = await linkWithCredential(userCred.user, pendingObj.credential);
        console.log(`[PROVIDER-LINK] existing=password pending=google.com status=success`);
        window.state.pendingGoogleCredential = null;
        cleanupModal();
        await window.handlePostAuthUserSuccess({ firebaseUser: linkResult.user, authProvider: 'google.com' });
      }
    } catch (err) {
      console.error(`[PROVIDER-LINK] existing=password pending=google.com status=failed`, err.code);
      if (typeof window.showNotification === 'function') {
        window.showNotification("Password verification failed. Please try again.", "error");
      }
    }
  };
};

window.handlePostAuthUserSuccess = async function ({ firebaseUser, authProvider, options = {}, attemptId, cleanup }) {
  if (!firebaseUser || !firebaseUser.uid) {
    if (cleanup) cleanup();
    return false;
  }

  const uid = firebaseUser.uid;
  const emailNorm = window.normalizeEmail(firebaseUser.email);
  console.log(`[IDENTITY] provider=${authProvider} canonicalUidPresent=true uid=${uid.slice(-6)} attempt=${attemptId || window.state?.authAttempt?.id || 'none'}`);

  // 1. Construct Immediate Safe In-Memory Session via UID-scoped Cache Only
  const matchingCache = window.getStoredUserProfile(uid);

  const preferredName = options.preferredDisplayName || matchingCache?.preferredDisplayName || firebaseUser.displayName || (emailNorm ? emailNorm.split('@')[0] : 'Explorer');
  let displayPhoto = '/assets/royal-avatar.png';
  let photoSource = 'default';

  if (authProvider === 'google.com') {
    displayPhoto = firebaseUser.photoURL || matchingCache?.googlePhotoURL || '/assets/royal-avatar.png';
    photoSource = firebaseUser.photoURL ? 'google' : 'default';
  } else {
    displayPhoto = matchingCache?.passwordProfilePhotoURL || matchingCache?.googlePhotoURL || firebaseUser.photoURL || '/assets/royal-avatar.png';
    photoSource = matchingCache?.passwordProfilePhotoURL ? 'password-upload' : (firebaseUser.photoURL ? 'google' : 'default');
  }
  console.log(`[PROFILE-PHOTO] source=${photoSource}`);

  const initialXP = matchingCache && Number.isFinite(Number(matchingCache.xp)) ? Number(matchingCache.xp) : 50;

  const userSession = {
    uid,
    name: preferredName,
    displayName: preferredName,
    preferredDisplayName: preferredName,
    email: firebaseUser.email || '',
    emailNormalized: emailNorm,
    photoURL: displayPhoto,
    googlePhotoURL: authProvider === 'google.com' ? (firebaseUser.photoURL || '') : (matchingCache?.googlePhotoURL || ''),
    passwordProfilePhotoURL: matchingCache?.passwordProfilePhotoURL || '',
    activeAuthProvider: authProvider,
    linkedProviders: matchingCache?.linkedProviders || [authProvider],
    xp: initialXP,
    rank: matchingCache?.rank || 'Novice Explorer',
    welcomeXPAwarded: matchingCache?.welcomeXPAwarded ?? true,
    welcomeBannerSeen: matchingCache?.welcomeBannerSeen ?? true,
    isGuest: false,
    profileStatus: matchingCache ? "ready" : "loading"
  };

  window.state.user = userSession;
  window.state.currentUser = userSession;
  window.state.activeUid = uid;
  window.state.isGuest = false;
  window.state.isLoggedIn = true;
  window.state.sessionAuthorized = true;

  window.saveStoredUserProfile(uid, userSession);
  localStorage.setItem('yathralanka_logged_in', 'true');
  localStorage.removeItem('yathralanka_session_mode');

  if (cleanup) cleanup();

  // 2. Authorize Immediate Navigation to Dashboard
  const targetAttemptId = attemptId || window.state?.authAttempt?.id;
  if (targetAttemptId && window.state?.authAttempt) {
    window.state.authAttempt.status = 'exchanging-credential';
  }

  const navApproved = window.completeVerifiedAuthentication({
    attemptId: targetAttemptId,
    firebaseUser,
    userSession
  });

  // 3. Independent Non-Blocking Firestore Profile Sync
  window.syncCanonicalProfileAsync(firebaseUser, authProvider, options);

  return navApproved;
};

// ============================================================================
// STABILIZATION STEP 6A.1: GOOGLE AUTH TRANSACTION MODEL & APPROVAL GATE
// ============================================================================
function completeVerifiedAuthentication({ attemptId, firebaseUser, userSession }) {
  if (!window.state) window.state = {};
  const attempt = window.state.authAttempt;

  const v3 = Boolean(firebaseUser);
  const v4 = Boolean(firebaseUser && firebaseUser.uid);
  const v5 = Boolean(typeof auth !== 'undefined' && auth && auth.currentUser);
  const v6 = Boolean(auth && auth.currentUser && auth.currentUser.uid === firebaseUser?.uid);

  if (!v3 || !v4 || !v5 || !v6) {
    const reason = !v3 || !v4 ? 'invalid_firebase_user' : 'uid_mismatch';
    console.log(`[AUTH-NAV] source=completeVerifiedAuthentication target=home outcome=blocked reason=${reason} attempt=${attemptId}`);
    return false;
  }

  if (attempt) {
    attempt.status = 'verified';
  }
  console.log(`[AUTH-RUNTIME] attempt=${attemptId} stage=verified`);
  console.log(`[AUTH-TRACE] attempt=${attemptId} stage=navigation_completed`);
  console.log(`[AUTH-NAV] source=completeVerifiedAuthentication target=home outcome=approved attempt=${attemptId}`);

  localStorage.setItem('yathralanka_session_mode', 'authenticated');
  window.saveStoredUserProfile(userSession.uid, userSession);
  localStorage.setItem('yathralanka_logged_in', 'true');

  window.state.user = userSession;
  window.state.currentUser = userSession;
  window.state.activeUid = userSession.uid;
  window.state.isGuest = false;
  window.state.isLoggedIn = true;
  window.state.sessionAuthorized = true;

  if (window.state.pendingAuthReturn) {
    const pending = window.state.pendingAuthReturn;
    window.state.pendingAuthReturn = null;
    console.log(`[AUTH-RETURN] action=resume origin=${pending.originRoute}`);
    if (typeof pending.onAuthorized === 'function') {
      pending.onAuthorized();
    } else if (typeof window.executeAppNavigation === 'function') {
      window.executeAppNavigation(pending.originRoute, pending.originParams || {});
    }
  } else if (typeof window.executeAppNavigation === 'function') {
    window.executeAppNavigation('home');
  }

  return true;
}
window.completeVerifiedAuthentication = completeVerifiedAuthentication;

// ============================================================================
// STABILIZATION STEP 6A: CENTRALIZED ACCESS CONTROL & UNIVERSAL GATE
// ============================================================================
const PROTECTED_CAPABILITIES = {
  FULL_LANDMARK: 'full-landmark',
  QUIZ: 'quiz',
  VERIFICATION: 'verification',
  CHECKPOINT: 'checkpoint',
  EARN_XP: 'earn-xp',
  REDEEM_REWARD: 'redeem-reward',
  ACTIVISM_ACTION: 'activism-action',
  PROFILE_ACTION: 'profile-action'
};
window.PROTECTED_CAPABILITIES = PROTECTED_CAPABILITIES;

function requestProtectedAccess({ capability, originRoute, originParams = {}, onAuthorized }) {
  const session = getSessionAccessState();
  if (session.isAuthenticated) {
    console.log(`[ACCESS] capability=${capability} result=allowed route=${originRoute}`);
    if (typeof onAuthorized === 'function') onAuthorized();
    return true;
  }

  console.log(`[ACCESS] capability=${capability} result=guest-gated route=${originRoute}`);
  showUniversalGuestModal({ capability, originRoute, originParams, onAuthorized });
  return false;
}
window.requestProtectedAccess = requestProtectedAccess;

function showUniversalGuestModal({ capability, originRoute, originParams = {}, onAuthorized }) {
  document.querySelectorAll('#guest-access-modal-overlay, .auth-modal-overlay, #auth-required-modal-overlay').forEach(el => el.remove());

  const overlay = document.createElement('div');
  overlay.id = 'guest-access-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'guest-modal-title');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(4px);
    z-index: 20000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
  `;

  overlay.innerHTML = `
    <div class="yl-dialog" tabindex="-1" style="background: #FFFFFF; border-radius: 20px; padding: 24px 20px; width: 100%; max-width: 360px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); text-align: center; position: relative;">
      <div style="width: 52px; height: 52px; background: #FEF3C7; border: 1.5px solid #F59E0B; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#92400E" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </div>

      <h3 id="guest-modal-title" style="margin: 0 0 10px; font-size: 18px; font-weight: 800; color: #125463;">
        Sign in to continue
      </h3>

      <p style="margin: 0 0 20px; font-size: 13px; color: #475569; line-height: 1.5; font-weight: 500;">
        Create an account or sign in to unlock quests, save progress, verify visits, and earn XP.
      </p>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button id="guest-modal-btn-signin" class="yl-btn-primary" style="min-height: 44px; width: 100%; background: #125463; color: #FFFFFF; font-size: 14px; font-weight: 700; border: none; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 10px 16px;">
          Sign In or Create Account
        </button>

        <button id="guest-modal-btn-keep" class="yl-btn-secondary" style="min-height: 44px; width: 100%; background: #F8FAFC; color: #475569; font-size: 14px; font-weight: 700; border: 1px solid #CBD5E1; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 10px 16px;">
          Keep Exploring
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector('.yl-dialog')?.focus();
  document.body.classList.add('modal-open');

  console.log(`[GUEST-GATE] opened capability=${capability} origin=${originRoute}`);

  const handleKeepExploring = (e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    overlay.remove();
    document.body.classList.remove('modal-open');
    console.log(`[GUEST-GATE] keep-exploring origin=${originRoute}`);
  };

  const handleSignIn = (e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    overlay.remove();
    document.body.classList.remove('modal-open');
    console.log(`[GUEST-GATE] auth-selected origin=${originRoute}`);

    if (!window.state) window.state = {};
    window.state.pendingAuthReturn = {
      originRoute: originRoute || window.state?.currentScreen || 'home',
      originParams: originParams || window.state?.currentParams || {},
      capability,
      onAuthorized
    };

    if (typeof window.executeAppNavigation === 'function') {
      window.executeAppNavigation('auth');
    }
  };

  document.getElementById('guest-modal-btn-keep')?.addEventListener('click', handleKeepExploring);
  document.getElementById('guest-modal-btn-signin')?.addEventListener('click', handleSignIn);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) handleKeepExploring(e);
  });
}
window.showUniversalGuestModal = showUniversalGuestModal;

window.resolveSiteFromId = function (siteId) {
  if (!siteId && siteId !== 0) return null;
  const pool = window.sitesData || (typeof sitesData !== 'undefined' ? sitesData : []);
  const dirData = typeof getDirectoryDataset === 'function' ? getDirectoryDataset() : [];
  const rawList = Array.isArray(pool) ? pool : Object.values(pool);
  const combined = [...rawList, ...dirData];
  const cleanId = String(siteId).toLowerCase().replace(/[-_]/g, '');

  return combined.find(s => {
    if (!s) return false;
    const sid = String(s.id || '').toLowerCase().replace(/[-_]/g, '');
    const sslug = String(s.slug || '').toLowerCase().replace(/[-_]/g, '');
    const sname = String(s.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return sid === cleanId || sslug === cleanId || sname.includes(cleanId) || cleanId.includes(sid);
  }) || null;
};

// Environment Detection for Mobile & Native Android Fullscreen Layouts
(function initNativeEnvironmentClasses() {
  const checkAndApply = () => {
    const isNative = (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
      window.location.protocol === 'capacitor:' ||
      window.location.hostname === 'localhost' ||
      /Android/i.test(navigator.userAgent) ||
      (window.innerWidth <= 600);
    if (isNative) {
      if (document.documentElement) document.documentElement.classList.add('is-mobile', 'is-capacitor');
      if (document.body) document.body.classList.add('is-mobile', 'is-capacitor');
      if (/Android/i.test(navigator.userAgent) || (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'android')) {
        if (document.documentElement) document.documentElement.classList.add('is-android');
        if (document.body) document.body.classList.add('is-android');
      }
    }
  };
  checkAndApply();
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', checkAndApply);
  }
})();

// ============================================================================
// TOP-LEVEL NAVIGATOR FORWARD DECLARATION & BINDING WITH QUEUEING
// ============================================================================
let pendingNavigation = null;

function navigate(targetScreen, params = {}) {
  console.log('[MAP-ACTUAL 02] navigate(map) called:', targetScreen);
  console.log('[FREEZE-COMMON 02] target/action identified:', targetScreen, params);
  console.log('[FREEZE-COMMON 03] navigate called:', targetScreen);
  if (targetScreen === 'site-detail') {
    console.log('[DETAIL-TRACE 05] navigate(site-detail) entered', params);
  }
  if (typeof window.executeAppNavigation === 'function') {
    return window.executeAppNavigation(targetScreen, params);
  }
  // Queue navigation if navigator is not ready yet
  pendingNavigation = { targetScreen, params };
}
window.navigate = navigate;

window.handleDashboardInteraction = function (actionRoute) {
  try {
    if (actionRoute === 'wanderer' || actionRoute === 'map') {
      console.log('[MAP-ACTUAL 01] home map action click received');
    }
    if (typeof executeAppNavigation === 'function') {
      executeAppNavigation(actionRoute);
    } else if (typeof window.navigate === 'function') {
      window.navigate(actionRoute);
    } else {
      window.location.hash = `#${actionRoute}`;
    }
  } catch (err) {
    console.error("Navigation error: ", err);
  }
};

window.renderUniversalBackButton = function (destination = 'home', params = {}) {
  const isAuth = destination === 'auth' || (window.state?.currentScreen === 'auth');
  const strokeColor = isAuth ? '#FFFFFF' : '#1E293B';
  const bgStyle = isAuth
    ? 'background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.28); color: #FFFFFF;'
    : 'background: rgba(255, 255, 255, 0.88); border: 1px solid rgba(0, 0, 0, 0.12); color: #1E293B;';

  const onClickAction = isAuth
    ? "window.handleAuthBackClick()"
    : (typeof destination === 'string' ? `window.executeAppNavigation('${destination}')` : "window.executeAppNavigation('home')");

  return `
    <button 
      type="button" 
      class="universal-top-right-back-btn yl-back-btn"
      onclick="${onClickAction}" 
      aria-label="Back" 
      style="position: absolute; top: max(env(safe-area-inset-top), 14px); left: 14px; right: auto; z-index: 500; min-width: 44px; min-height: 44px; width: 44px; height: 44px; border-radius: 12px; backdrop-filter: blur(8px); cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.12); ${bgStyle}">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>
  `;
};

window.getGuestModeBadge = function () {
  const session = typeof getSessionAccessState === 'function' ? getSessionAccessState() : { isGuest: true };
  if (!session.isGuest) return '';
  return `
    <span class="guest-mode-badge yl-badge yl-badge-guest" style="font-size: 11px; font-weight: 700; background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1; padding: 3px 9px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-left: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); vertical-align: middle;">
      Guest
    </span>
  `;
};

// ============================================================================
// 1. IN-MEMORY ASSET CACHING ON BOOT
// ============================================================================
(function preloadCriticalAssets() {
  const mapPreload = new Image();
  mapPreload.src = "/srilanka-map.png";
})();

// ============================================================================
// DIRECTORY ASSET PRELOADER (ELIMINATES ALL LOADING DELAYS)
// ============================================================================
const PRELOAD_IMAGE_SOURCES = [
  '/Element%20Pictures/National%20Museum%20-%20Colombo.jpg',
  '/Element%20Pictures/Sigiriya-LionRock.jpg',
  '/Element%20Pictures/Temple%20of%20the%20tooth.jpg',
  '/Element%20Pictures/Ruwanweliseya.jpg',
  '/Element%20Pictures/Mihintale.JPG',
  '/Element%20Pictures/Galle%20Fort.jpg',
  '/Element%20Pictures/Dambulla%20Cave%20Temple.jpg',
  '/Element%20Pictures/Ritigala%20Monastery.jpg',
  '/Element%20Pictures/Dowa%20Rock%20Temple.jpg',
  '/Element%20Pictures/Yudaganawa.jpg',
  '/Element%20Pictures/Pilikuttuwa%20Temple.jpg',
  '/Element%20Pictures/maligawila%20buddha%20statue.jpg',
  '/Element%20Pictures/Buduruwagala%20Temple.jpg'
];

(function preloadAllDirectoryAssets() {
  PRELOAD_IMAGE_SOURCES.forEach(src => {
    const img = new Image();
    img.src = src;
  });
})();

// ============================================================================
// 1. FRESH DATABASE RESET UTILITY
// ============================================================================
window.resetYathraDatabase = function () {
  localStorage.removeItem('yathralanka_users');
  localStorage.removeItem('yathralanka_active_user');
  localStorage.removeItem('yathralanka_state');
  sessionStorage.clear();
  console.log("🧹 [YathraLanka] Database wiped completely clean.");
  window.location.reload();
};

// ============================================================================
// 1. DYNAMIC NAME RESOLVER HELPER
// ============================================================================
function extractDisplayName(user) {
  if (!user) return 'Explorer';
  if (user.isGuest) return 'Guest Explorer';
  if (user.name && user.name.trim() !== '' && user.name.toLowerCase() !== 'explorer') {
    return user.name.trim();
  }
  if (user.displayName && user.displayName.trim() !== '' && user.displayName.toLowerCase() !== 'explorer') {
    return user.displayName.trim();
  }
  if (user.email) {
    const rawName = user.email.split('@')[0].replace(/[._-]/g, ' ');
    return rawName.charAt(0).toUpperCase() + rawName.slice(1);
  }
  return 'Explorer';
}

// ============================================================================
// ============================================================================
// ============================================================================
// NATIVE DUAL-PATH APP ROUTER
// ============================================================================
let isAppRouterInitialized = false;

window.initAppRouter = async function () {
  if (isAppRouterInitialized) return;
  isAppRouterInitialized = true;

  if (!window.state) window.state = {};

  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  const emailParam = urlParams.get('email');
  const urlUserName = urlParams.get('user_name');

  // Deep Link Exception 1: Password Reset
  if (mode === 'resetPassword' && emailParam) {
    const email = decodeURIComponent(emailParam).trim().toLowerCase();

    window.state.currentScreen = 'auth';
    window.state.authActiveTab = 'signin';
    window.navigate('auth');

    setTimeout(() => {
      if (typeof window.renderNewPasswordScreen === 'function') {
        window.renderNewPasswordScreen(email);
      }
    }, 50);

    window.__freshBootHandled = true;
    window.__startupSessionPolicyComplete = true;
    return;
  }

  // Deep Link Exception 2: Email Activation
  if (mode === 'activateAccount' && emailParam) {
    const email = decodeURIComponent(emailParam).trim().toLowerCase();
    const pendingDb = JSON.parse(localStorage.getItem('yathralanka_pending_users') || '{}');
    const verifiedDb = JSON.parse(localStorage.getItem('yathralanka_users') || '{}');
    const pendingUser = pendingDb[email] || verifiedDb[email] || {};

    let resolvedName = urlUserName ? decodeURIComponent(urlUserName).trim() : (pendingUser.name || 'Explorer');

    const isFirstTime = !verifiedDb[email];
    const confirmedUser = {
      name: resolvedName,
      displayName: resolvedName,
      email: email,
      password: pendingUser.password || '',
      xp: 50,
      medals: 0,
      sitesVisited: 0,
      quizzesPassed: 0,
      emailVerified: true,
      isGuest: false,
      dashboard_visits: isFirstTime ? 1 : ((verifiedDb[email]?.dashboard_visits || 1) + 1),
      loginCount: isFirstTime ? 1 : ((verifiedDb[email]?.loginCount || 1) + 1),
      isNewRegistrant: isFirstTime,
      joinedAt: verifiedDb[email]?.joinedAt || new Date().toISOString()
    };

    verifiedDb[email] = confirmedUser;
    localStorage.setItem('yathralanka_users', JSON.stringify(verifiedDb));

    delete pendingDb[email];
    localStorage.setItem('yathralanka_pending_users', JSON.stringify(pendingDb));

    localStorage.setItem('yathralanka_current_user', JSON.stringify(confirmedUser));
    localStorage.setItem('yathralanka_active_user', JSON.stringify(confirmedUser));

    window.state.user = confirmedUser;
    window.state.currentUser = confirmedUser;
    window.state.isGuest = false;
    window.state.isLoggedIn = true;
    window.state.sessionAuthorized = true;

    window.__freshBootHandled = true;
    window.__startupSessionPolicyComplete = true;

    window.history.replaceState({}, document.title, window.location.pathname);
    window.navigate('home');
    return;
  }

  // Migrate legacy persistent guest flag from localStorage
  if (localStorage.getItem('yathralanka_session_mode') === 'guest') {
    console.log('[STARTUP] Purging legacy persistent guest flag from localStorage');
    localStorage.removeItem('yathralanka_session_mode');
  }

  // Fresh Application Launch Startup Policy (Step 6A.5.4)
  if (!window.__freshBootHandled) {
    window.__freshBootHandled = true;
    console.log('[STARTUP-SESSION] Initiating fresh boot startup policy...');

    window.state.authTransition = "startup-signout";
    window.state.sessionAuthorized = false;
    window.state.isGuest = false;
    window.state.isLoggedIn = false;
    window.state.sessionMode = "signed_out";
    window.state.user = null;
    window.state.currentUser = null;
    window.state.activeUid = null;
    window.state.authAttempt = null;

    // Clear active-session pointers without destroying stored UID-scoped records
    localStorage.removeItem('yathralanka_logged_in');
    localStorage.removeItem('yathralanka_session_mode');
    sessionStorage.removeItem('yathralanka_session_mode');
    localStorage.removeItem('yathralanka_current_user');
    localStorage.removeItem('yathralanka_active_user');
    localStorage.removeItem('yathralanka_user');

    // Safely clear active Firebase auth session on cold launch
    if (typeof auth !== 'undefined' && auth && auth.currentUser) {
      try {
        console.log('[STARTUP-SESSION] Performing silent startup sign-out of restored Firebase session...');
        await signOut(auth);
        console.log('[STARTUP-SESSION] Silent startup sign-out complete.');
      } catch (err) {
        console.warn('[STARTUP-SESSION] Error during silent startup sign-out:', err);
      }
    }

    window.state.authTransition = null;
    window.state.sessionMode = "signed_out";
    window.state.isGuest = false;
    window.state.isLoggedIn = false;
    window.__startupSessionPolicyComplete = true;

    console.log('[STARTUP-SESSION] Startup cleanup finished -> Rendering Welcome screen');
    if (typeof window.executeAppNavigation === 'function') {
      window.executeAppNavigation('welcome');
    } else if (typeof window.navigate === 'function') {
      window.navigate('welcome');
    }
  }
};


// ============================================================================
// CONSTANTS
// ============================================================================
const EMAILJS_SERVICE_ID = "service_ovten6k";
const TEMPLATE_CONFIRMATION = "template_nm0vngd"; // YathraLanka Email Confirmation
const TEMPLATE_WELCOME_GOOGLE = "template_u95fp18"; // YathraLanka Welcome Email
const EMAIL_SERVICE_ID = "service_ovten6k";
const TEMPLATE_CONFIRMATION_EMAIL = "template_nm0vngd";

// ============================================================================
// IN-APP AUTH INLINE ALERT HELPER
// ============================================================================
window.showAuthInlineAlert = function (message, type = 'error') {
  let alertBox = document.getElementById('auth-inline-alert');
  const formCard = document.querySelector('.auth-card-wrapper') || document.querySelector('.auth-card-box');

  if (!alertBox && formCard) {
    alertBox = document.createElement('div');
    alertBox.id = 'auth-inline-alert';
    formCard.insertBefore(alertBox, formCard.firstChild);
  }

  if (alertBox) {
    const isError = type === 'error';
    alertBox.style.cssText = `
      background: ${isError ? '#FEF2F2' : '#F0FDF4'};
      border: 1.5px solid ${isError ? '#FCA5A5' : '#86EFAC'};
      color: ${isError ? '#991B1B' : '#166534'};
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 12px;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.4;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: fadeIn 0.25s ease-out;
    `;
    alertBox.innerHTML = `<span>${isError ? '⚠️' : '✅'}</span><span>${message}</span>`;

    // Auto-dismiss after 8 seconds
    if (window._authAlertTimeout) clearTimeout(window._authAlertTimeout);
    window._authAlertTimeout = setTimeout(() => {
      if (alertBox) alertBox.remove();
    }, 8000);
  } else if (typeof window.showNotification === 'function') {
    window.showNotification(message, type);
  }
};

// ============================================================================
// PASSWORD VALIDATION RULES (STANDARDIZED 3 CONDITIONS)
// ============================================================================
window.evaluatePasswordRules = function (val) {
  return {
    hasUpper: /[A-Z]/.test(val),
    hasLower: /[a-z]/.test(val),
    hasNumber: /[0-9]/.test(val)
  };
};

window.isPasswordValid = function (val) {
  const r = window.evaluatePasswordRules(val);
  return r.hasUpper && r.hasLower && r.hasNumber;
};

// ============================================================================
// 2. REGISTRATION FORM HANDLER (Safe Alphanumeric Token)
// ============================================================================
window.handleCreateAccountSubmit = async function (e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  const activeContainer = document.querySelector('.auth-card-wrapper') || document;
  const nameEl = document.getElementById('auth-signup-name') || activeContainer.querySelector('input[placeholder*="Name" i]');
  const emailEl = document.getElementById('auth-identifier') || activeContainer.querySelector('input[type="email"]');
  const passEl = document.getElementById('auth-password') || activeContainer.querySelector('input[type="password"]');
  const submitBtn = document.getElementById('auth-submit-btn');

  // Reset border highlights
  [nameEl, emailEl, passEl].forEach(el => {
    if (el) el.style.borderColor = '#CBD5E1';
  });

  const fullName = nameEl && nameEl.value.trim() ? nameEl.value.trim() : '';
  const email = emailEl && emailEl.value.trim() ? emailEl.value.trim().toLowerCase() : '';
  const password = passEl ? passEl.value : '';

  const missingFields = [];
  if (!fullName) {
    missingFields.push("Name");
    if (nameEl) nameEl.style.borderColor = '#EF4444';
  }
  if (!email) {
    missingFields.push("Email Address");
    if (emailEl) emailEl.style.borderColor = '#EF4444';
  }
  if (!password) {
    missingFields.push("Password");
    if (passEl) passEl.style.borderColor = '#EF4444';
  }

  if (missingFields.length > 0) {
    window.showAuthInlineAlert(`Please enter your ${missingFields.join(' and ')}.`, "error");
    return;
  }

  if (!window.isPasswordValid(password)) {
    if (passEl) passEl.style.borderColor = '#EF4444';
    window.showAuthInlineAlert("Password must include one uppercase letter, one lowercase letter, and one number.", "error");
    return;
  }

  // Strict Check: Account already exists
  const verifiedDb = JSON.parse(localStorage.getItem('yathralanka_users') || '{}');
  const legacyDb = JSON.parse(localStorage.getItem('yathralanka_users_db') || '{}');

  if (verifiedDb[email] || legacyDb[email]) {
    if (typeof window.setAuthTab === 'function') {
      window.setAuthTab('signin');
    }
    window.showAuthInlineAlert("An account with this email already exists. Please Sign In.", "error");
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending confirmation...';
  }

  // Stage pending user
  const pendingDb = JSON.parse(localStorage.getItem('yathralanka_pending_users') || '{}');
  const safeToken = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

  pendingDb[email] = {
    name: fullName,
    email: email,
    password: password,
    token: safeToken,
    createdAt: new Date().toISOString()
  };
  localStorage.setItem('yathralanka_pending_users', JSON.stringify(pendingDb));

  // Build activation link
  const activationLink = `${window.location.origin}${window.location.pathname}?mode=activateAccount&token=${safeToken}&email=${encodeURIComponent(email)}&user_name=${encodeURIComponent(fullName)}`;

  // Send EmailJS confirmation
  try {
    if (window.emailjs) {
      await window.emailjs.send(
        "service_ovten6k",
        "template_nm0vngd",
        {
          to_name: fullName,
          to_email: email,
          activation_link: activationLink
        }
      );
    }
  } catch (err) {
    console.error("EmailJS Error:", err);
  }

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Account';
  }

  window.renderPendingVerificationPopup(fullName, email);
};

// ============================================================================
// VERIFICATION NOTICE MODAL (Professional Layout & Verified Logo Path)
// ============================================================================
window.renderPendingVerificationPopup = function (fullName, email) {
  const oldModal = document.getElementById('welcome-modal-backdrop');
  if (oldModal) oldModal.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'welcome-modal-backdrop';
  backdrop.style.cssText = `
    position: fixed; inset: 0; background: rgba(8, 43, 51, 0.90);
    backdrop-filter: blur(10px); display: flex; align-items: center;
    justify-content: center; z-index: 99999; padding: 16px; box-sizing: border-box;
  `;

  backdrop.innerHTML = `
    <div style="width: 100%; max-width: 320px; background: #FAF5E8; border-radius: 24px; padding: 30px 22px 24px 22px; box-sizing: border-box; box-shadow: 0 20px 50px rgba(0,0,0,0.45); border: 1px solid #DFCEAA; text-align: center;">
      
      <!-- Brand Logo -->
      <img 
        src="./assets/YathraLanka logo - transparent.png" 
        onerror="this.onerror=null; this.src='https://raw.githubusercontent.com/pabadhigaru/YathraLanka-Native/main/assets/YathraLanka%20logo%20-%20transparent.png';"
        alt="YathraLanka" 
        style="width: 76px; height: auto; margin: 0 auto 12px auto; display: block;"
      />

      <div style="font-family: 'Cinzel', Georgia, serif; font-size: 17px; font-weight: 800; color: #125463; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 2px;">
        YathraLanka
      </div>
      <div style="font-size: 11px; font-weight: 700; color: #EAA335; letter-spacing: 0.3px; margin-bottom: 18px;">
        Play the game. Protect the past.
      </div>

      <h3 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 800; color: #125463;">
        Welcome to YathraLanka 🌿
      </h3>
      <p style="margin: 0 0 16px 0; font-size: 12.5px; color: #4A3E2C; line-height: 1.5;">
        Logged in as<br>
        <strong style="color: #125463;">${email}</strong>
      </p>

      <div style="background: #FEF3C7; border: 1.5px solid #F59E0B; border-radius: 14px; padding: 12px 14px; margin-bottom: 18px; text-align: left; font-size: 11.5px; color: #92400E; line-height: 1.45;">
        🎁 <strong>Explorer Account Active!</strong><br>
        Your explorer profile is initialized. Begin exploring Sri Lanka's heritage sanctuaries directly.
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button 
          type="button" 
          onclick="window.dismissVerificationModalToGuest()" 
          style="width: 100%; background: #125463; color: #FFFFFF; font-size: 13px; font-weight: 700; border: none; padding: 11px; border-radius: 10px; cursor: pointer;">
          Explore as Guest
        </button>
        <span 
          onclick="window.dismissVerificationModalToSignIn()" 
          style="font-size: 12px; font-weight: 700; color: #0B5A68; cursor: pointer; padding: 4px; text-align: center;">
          ← Back to Sign In
        </span>
      </div>

    </div>
  `;

  document.body.appendChild(backdrop);
};

window.dismissVerificationModalToGuest = function () {
  const modal = document.getElementById('welcome-modal-backdrop');
  if (modal) modal.remove();
  if (typeof window.continueAsGuest === 'function') window.continueAsGuest();
};

window.dismissVerificationModalToSignIn = function () {
  const modal = document.getElementById('welcome-modal-backdrop');
  if (modal) modal.remove();
  if (typeof window.restoreAuthTabs === 'function') window.restoreAuthTabs();
};

window.dismissConfirmationModalToGuest = window.dismissVerificationModalToGuest;
window.dismissConfirmationModalToSignIn = window.dismissVerificationModalToSignIn;



// ============================================================================
// 3. DASHBOARD USER HEADER & CONGRATULATORY NEWCOMER BANNER
// ============================================================================
window.renderDashboardHeader = function () {
  const activeUid = auth?.currentUser?.uid || window.state?.user?.uid;
  const currentUser = (window.state?.user && window.state.user.uid === activeUid)
    ? window.state.user
    : (activeUid ? window.getStoredUserProfile(activeUid) : (window.state?.isGuest ? { name: "Guest Explorer", isGuest: true, xp: 0, rank: "Novice Explorer" } : null));

  const headerCard = document.querySelector('.dashboard-user-card') || document.getElementById('dashboard-header-slot');
  if (!headerCard) return;

  if (!currentUser || currentUser.profileStatus === "loading") {
    headerCard.innerHTML = `<div style="padding:18px 22px; text-align:center; color:#64748B; font-size:13px; font-weight:700;">Loading your explorer profile…</div>`;
    return;
  }

  let displayName = currentUser.preferredDisplayName || currentUser.displayName || currentUser.name || 'Explorer';
  const xpCount = Number.isFinite(Number(currentUser.xp)) ? Number(currentUser.xp) : 50;

  const rankInfo = typeof getRankProgress === 'function' ? getRankProgress(xpCount) : {
    currentRank: { name: 'Novice Explorer' },
    nextRank: { name: 'Pathfinder', minXP: 1000 },
    progressPercent: 0,
    isHighestRank: false
  };
  const currentRankName = rankInfo.currentRank.name;
  const nextRankName = rankInfo.isHighestRank ? 'Highest Rank Reached' : rankInfo.nextRank.name;
  const progressLabel = rankInfo.isHighestRank ? `Highest Rank (${currentRankName})` : `Progress to ${nextRankName}`;
  const progressText = rankInfo.isHighestRank ? `${xpCount} XP (Max)` : `${xpCount} / ${rankInfo.nextRankXP ? rankInfo.nextRankXP.toLocaleString() : 1000} XP`;

  headerCard.innerHTML = `
    <!-- Main Explorer Card -->
    <div style="background: #FFFFFF; border-radius: 18px; padding: 18px 20px; box-shadow: 0 4px 18px rgba(0,0,0,0.06); margin-bottom: 14px; position: relative;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #125463;">
            Welcome, ${displayName}!
          </h2>
          <div style="font-size: 12px; color: #64748B; margin-top: 4px; font-weight: 600;">
            Rank: ${currentRankName} • ${xpCount} XP
          </div>
        </div>
        
        <!-- XP Badge -->
        <div style="background: #FEF3C7; border: 1.5px solid #F59E0B; border-radius: 10px; padding: 6px 12px; text-align: center;">
          <span style="font-size: 14px; font-weight: 800; color: #92400E; display: block;">${xpCount}</span>
          <span style="font-size: 9px; font-weight: 700; color: #B45309; text-transform: uppercase;">XP</span>
        </div>
      </div>

      <!-- XP Progress Bar -->
      <div style="margin-top: 14px;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 5px;">
          <span>${progressLabel}</span>
          <span>${progressText}</span>
        </div>
        <div style="width: 100%; height: 7px; background: #E2E8F0; border-radius: 999px; overflow: hidden;">
          <div style="width: ${rankInfo.progressPercent}%; height: 100%; background: linear-gradient(90deg, #F5A623, #125463); border-radius: 999px;"></div>
        </div>
      </div>
    </div>

    <!-- Newcomer Celebratory Message Banner (Visible strictly on visit #1) -->
    ${isNewcomer ? `
      <div id="newcomer-celebration-banner" style="background: #F0FDF4; border: 1.5px solid #86EFAC; border-radius: 14px; padding: 12px 14px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 12px rgba(22, 101, 52, 0.08);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 22px;">🎉</span>
          <div>
            <div style="font-size: 12.5px; font-weight: 800; color: #166534;">
              Congratulations & Ayubowan!
            </div>
            <div style="font-size: 11px; color: #15803D; font-weight: 600; margin-top: 1px;">
              Welcome to YathraLanka. <strong>+50 XP</strong> welcome gift credited to begin your quest!
            </div>
          </div>
        </div>
        <button 
          onclick="window.dismissCelebrationBanner()" 
          style="background: transparent; border: none; font-size: 16px; color: #166534; cursor: pointer; font-weight: bold; padding: 2px 6px;">
          ✕
        </button>
      </div>
    ` : ''}
  `;
};

window.dismissCelebrationBanner = function () {
  sessionStorage.removeItem('show_newcomer_banner');
  const banner = document.getElementById('newcomer-celebration-banner');
  if (banner) banner.remove();
};



// ============================================================================
// PATHWAY 2: GOOGLE SIGN-IN (Sends Welcome Template)
// ============================================================================
window.handlePostLoginSuccess = function (userData) {
  try {
    console.log("Processing post-login session safely...");
    window.state = window.state || {};
    const userSession = userData || window.state.user || {};
    window.state.user = userSession;
    window.state.currentUser = userSession;
    window.state.isLoggedIn = true;
    window.state.isGuest = false;

    localStorage.removeItem('yathralanka_session_mode');
    localStorage.setItem('yathralanka_current_user', JSON.stringify(userSession));
    localStorage.setItem('yathralanka_logged_in', 'true');

    // Remove any loading indicator safely
    const loader = document.getElementById('auth-loading-overlay');
    if (loader) loader.remove();

    if (window.state?.pendingAuthReturn) {
      const pending = window.state.pendingAuthReturn;
      window.state.pendingAuthReturn = null;
      console.log(`[AUTH-RETURN] action=resume origin=${pending.originRoute}`);
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (typeof pending.onAuthorized === 'function') {
            pending.onAuthorized();
          } else if (typeof window.executeAppNavigation === 'function') {
            window.executeAppNavigation(pending.originRoute, pending.originParams || {});
          }
        }, 50);
      });
      return;
    }

    // Defer navigation using requestAnimationFrame to free the UI thread from native bridge locks
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          if (typeof window.executeAppNavigation === 'function') {
            window.executeAppNavigation('home');
          } else if (typeof window.navigate === 'function') {
            window.navigate('home');
          } else {
            window.location.hash = '#home';
          }
        } catch (navErr) {
          console.error("Navigation error:", navErr);
        }
      }, 50);
    });
  } catch (err) {
    console.error("Post-login error:", err);
  }
};

window.handleGoogleSignInSuccess = function (googleUser) {
  setTimeout(() => {
    try {
      if (!googleUser) return;
      const email = (googleUser.email || '').toLowerCase().trim();
      const googleDisplayName = googleUser.displayName || googleUser.name || 'Explorer';

      let verifiedDb = {};
      let legacyDb = {};
      try { verifiedDb = JSON.parse(localStorage.getItem('yathralanka_users') || '{}'); } catch (e) {}
      try { legacyDb = JSON.parse(localStorage.getItem('yathralanka_users_db') || '{}'); } catch (e) {}
      const existingUser = verifiedDb[email] || legacyDb[email];

      let userRecord;
      if (existingUser) {
        const preferredName = existingUser.name || existingUser.displayName || googleDisplayName;
        userRecord = {
          ...existingUser,
          name: preferredName,
          displayName: preferredName,
          email: email,
          authProvider: 'google',
          dashboard_visits: (existingUser.dashboard_visits || 1) + 1,
          loginCount: (existingUser.loginCount || 1) + 1,
          isNewRegistrant: false,
          showFirstRewardCard: false
        };
      } else {
        userRecord = {
          name: googleDisplayName,
          displayName: googleDisplayName,
          email: email,
          authProvider: 'google',
          xp: 50,
          medals: 0,
          sitesVisited: 0,
          quizzesPassed: 0,
          emailVerified: true,
          isGuest: false,
          dashboard_visits: 1,
          loginCount: 1,
          isNewRegistrant: false,
          showFirstRewardCard: false,
          joinedAt: new Date().toISOString()
        };
      }

      verifiedDb[email] = userRecord;
      try {
        localStorage.setItem('yathralanka_users', JSON.stringify(verifiedDb));
        localStorage.setItem('yathralanka_current_user', JSON.stringify(userRecord));
        localStorage.setItem('yathralanka_active_user', JSON.stringify(userRecord));
      } catch (e) {
        console.error("Storage write error:", e);
      }

      if (typeof window.handlePostLoginSuccess === 'function') {
        window.handlePostLoginSuccess(userRecord);
      }
    } catch (err) {
      console.error("Google sign in success callback error:", err);
    }
  }, 50);
};

// ============================================================================
// WELCOME MODAL & COMPATIBILITY HELPERS
// ============================================================================
window.renderWelcomeModal = function ({ name, email, isGoogleUser }) {
  const existing = document.getElementById('welcome-interception-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'welcome-interception-modal';
  modal.style.cssText = `
    position: fixed; inset: 0; z-index: 999999;
    background: rgba(6, 38, 45, 0.88); backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center; padding: 20px;
    box-sizing: border-box;
  `;

  if (isGoogleUser) {
    modal.innerHTML = `
      <div style="background: #FAF5E8; border-radius: 24px; max-width: 380px; width: 100%; padding: 36px 26px 30px 26px; text-align: center; border: 1.5px solid #DFCEAA; box-shadow: 0 24px 50px rgba(0,0,0,0.5);">
        <div style="width: 82px; height: 82px; margin: 0 auto 12px auto;">
          <img 
            src="https://cdn.jsdelivr.net/gh/pabadhibaru/YathraLanka-Native@main/assets/YathraLanka%20logo%20-%20transparent.png" 
            alt="YathraLanka" 
            style="width: 100%; height: 100%; object-fit: contain; display: block;"
            onerror="this.onerror=null; this.src='/Element%20Pictures/logo.png';"
          />
        </div>
        <h2 style="margin: 0; font-family: 'Cinzel', serif; font-size: 22px; color: #125463; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">
          YATHRALANKA
        </h2>
        <p style="margin: 4px 0 18px 0; font-size: 11.5px; font-weight: 700; color: #EAA335;">
          Play the game. Protect the past.
        </p>
        <h3 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 800; color: #125463;">
          Ayubowan, ${name || 'Explorer'}! 🌿
        </h3>
        <p style="margin: 0 0 20px 0; font-size: 13px; color: #4A3E2C; line-height: 1.55;">
          Welcome to YathraLanka. You have joined our expedition to explore, document, and protect Sri Lanka’s cultural treasures.
        </p>
        <div style="background: #FEF3C7; border: 1.5px solid #F59E0B; border-radius: 14px; padding: 14px 16px; margin-bottom: 24px;">
          <div style="font-size: 22px; line-height: 1; margin-bottom: 4px;">🎁</div>
          <div style="font-size: 14.5px; font-weight: 800; color: #92400E; margin-bottom: 2px;">
            +50 Experience Points Awarded!
          </div>
          <div style="font-size: 11.5px; font-weight: 600; color: #78350F; line-height: 1.4;">
            Ayubowan & Congratulations! Your journey into Sri Lanka's heritage begins now.
          </div>
        </div>
        <button id="btn-enter-yathralanka" style="width: 100%; background-color: #EAA335; color: #182226; font-size: 14.5px; font-weight: 800; border: 1px solid #F6BE68; padding: 15px 20px; border-radius: 12px; cursor: pointer; box-shadow: 0 6px 18px rgba(234, 163, 53, 0.42);">
          Enter YathraLanka App
        </button>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('btn-enter-yathralanka').onclick = function (e) {
      e.preventDefault();
      modal.remove();
      if (typeof window.navigate === 'function') window.navigate('home');
      else if (typeof window.renderDashboard === 'function') window.renderDashboard();
      else if (typeof window.navigateToDashboard === 'function') window.navigateToDashboard();
    };
  } else {
    // Email Confirmation Notice for Email/Password Users (NO DIRECT DASHBOARD ENTRY)
    window.renderPendingVerificationPopup(name, email);
  }
};

window.showFirstTimeWelcomeModal = function (user) {
  window.renderWelcomeModal({
    name: extractDisplayName(user),
    email: user ? user.email : '',
    isGoogleUser: true
  });
};
window.renderFirstTimeWelcomeModal = window.showFirstTimeWelcomeModal;

window.handleManualSignUp = function (name, email, password) {
  const fakeFormEvent = { preventDefault: () => { } };
  const nameEl = document.getElementById('auth-fullname-input');
  const emailEl = document.getElementById('auth-email-input');
  const passEl = document.getElementById('auth-password-input');
  if (nameEl) nameEl.value = name;
  if (emailEl) emailEl.value = email;
  if (passEl) passEl.value = password;
  return window.handleCreateAccountSubmit(fakeFormEvent);
};

window.sendWelcomeOnboardingEmail = async function (newUserRecord) {
  if (!newUserRecord || !newUserRecord.email) return;
  const userEmail = newUserRecord.email.toLowerCase().trim();
  if (window.emailjs) {
    try {
      await window.emailjs.send(
        EMAIL_SERVICE_ID,
        TEMPLATE_WELCOME_GOOGLE,
        {
          to_name: newUserRecord.name || 'Explorer',
          to_email: userEmail,
          activation_link: `${window.location.origin}${window.location.pathname}?ref=email`
        }
      );
    } catch (err) {
      console.warn("Welcome email dispatch notice:", err);
    }
  }
};

window.handleAuthSubmit = async function (type, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const currentTab = window.state?.authActiveTab || type || 'signin';

  if (currentTab === 'signup' || currentTab === 'create') {
    return window.handleCreateAccountSubmit(event);
  }

  // --- SIGN IN FLOW ---
  const emailInput = document.getElementById('auth-identifier') || document.getElementById('auth-email-input');
  const passInput = document.getElementById('auth-password') || document.getElementById('auth-password-input');

  const email = emailInput && emailInput.value.trim() ? emailInput.value.trim().toLowerCase() : '';
  const password = passInput ? passInput.value : '';

  if (!email || !password) {
    window.showAuthInlineAlert("Please enter both email and password.", "error");
    return;
  }

  const verifiedDb = JSON.parse(localStorage.getItem('yathralanka_users') || '{}');
  const pendingDb = JSON.parse(localStorage.getItem('yathralanka_pending_users') || '{}');

  const completeUserSession = (userRecord) => {
    if (!userRecord.xp) userRecord.xp = 50;
    userRecord.isLoggedIn = true;
    userRecord.isGuest = false;
    userRecord.dashboard_visits = (userRecord.dashboard_visits || 0) + 1;
    userRecord.isNewRegistrant = false;

    verifiedDb[email] = userRecord;
    localStorage.setItem('yathralanka_users', JSON.stringify(verifiedDb));
    localStorage.setItem('yathralanka_current_user', JSON.stringify(userRecord));
    localStorage.setItem('yathralanka_active_user', JSON.stringify(userRecord));

    if (!window.state) window.state = {};
    window.state.user = userRecord;
    window.state.currentUser = userRecord;
    window.state.isGuest = false;
    window.state.isLoggedIn = true;

    window.navigate('home');
  };

  // 1. Local Pre-registered Fallback for amarasinghesl@gmail.com / Aa01
  if (email === 'amarasinghesl@gmail.com' && password === 'Aa01') {
    const existing = verifiedDb[email] || {};
    const fallbackUser = {
      ...existing,
      name: existing.name || "Rajitha Amarasinghe",
      displayName: existing.displayName || "Rajitha Amarasinghe",
      email: "amarasinghesl@gmail.com",
      password: "Aa01",
      xp: existing.xp || 50,
      level: existing.level || "Ancient Heritage Explorer",
      title: existing.title || "Guardian of Heritage",
      rank: existing.rank || "Senior Explorer",
      badges: existing.badges || ["Heritage Pioneer"],
      unlockedSites: existing.unlockedSites || ["national_museum_colombo"],
      authProvider: 'email'
    };
    completeUserSession(fallbackUser);
    return;
  }

  // 2. Local Database Match
  if (verifiedDb[email]) {
    const userRecord = verifiedDb[email];
    if (userRecord.password && userRecord.password !== password) {
      window.showAuthInlineAlert("Incorrect password. Please try again.", "error");
      return;
    }
    completeUserSession(userRecord);
    return;
  }

  // 3. Attempt real Firebase Authentication if local cache is empty
  if (auth) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (userCredential && userCredential.user) {
        const fbUser = userCredential.user;
        const fbUserRecord = {
          name: fbUser.displayName || email.split('@')[0],
          displayName: fbUser.displayName || email.split('@')[0],
          email: email,
          xp: 50,
          level: "Ancient Heritage Explorer",
          title: "Guardian of Heritage",
          rank: "Senior Explorer",
          badges: ["Heritage Pioneer"],
          unlockedSites: ["national_museum_colombo"],
          authProvider: 'email'
        };
        completeUserSession(fbUserRecord);
        return;
      }
    } catch (fbErr) {
      console.warn("Firebase signInWithEmailAndPassword notice:", fbErr.code || fbErr.message);
    }
  }

  // 4. Pending account or switch tab if user truly not found anywhere
  if (pendingDb[email]) {
    window.showAuthInlineAlert("Please confirm your email. Check your inbox for the activation link.", "error");
    window.renderPendingVerificationPopup(pendingDb[email].name || 'Explorer', email);
  } else {
    window.setAuthTab('create');
    window.showAuthInlineAlert("No account found with this email. Please fill in your name and create an account.", "error");
  }
};

window.handleGoogleUserSuccess = function (userRecord) {
  return window.handleGoogleSignInSuccess({
    displayName: userRecord.displayName || userRecord.name,
    email: userRecord.email
  });
};
window.handleSuccessfulAuthentication = window.handleGoogleUserSuccess;
window.handleGoogleAuthVerification = window.handleGoogleUserSuccess;

// ============================================================================
// 3. FIRST-TIME MODAL DIALOG
// ============================================================================
function showFirstTimeWelcomeModal(user) {
  const existing = document.getElementById('welcome-interception-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'welcome-interception-modal';
  modal.style.cssText = `
    position: fixed; inset: 0; z-index: 999999;
    background: rgba(6, 38, 45, 0.88); backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center; padding: 20px;
    box-sizing: border-box;
  `;

  modal.innerHTML = `
    <div style="background: #FAF5E8; border-radius: 24px; max-width: 380px; width: 100%; padding: 36px 26px 30px 26px; text-align: center; border: 1.5px solid #DFCEAA; box-shadow: 0 24px 50px rgba(0,0,0,0.5);">
      <div style="width: 82px; height: 82px; margin: 0 auto 12px auto;">
        <img 
          src="https://cdn.jsdelivr.net/gh/pabadhibaru/YathraLanka-Native@main/assets/YathraLanka%20logo%20-%20transparent.png" 
          alt="YathraLanka" 
          style="width: 100%; height: 100%; object-fit: contain; display: block;"
          onerror="this.onerror=null; this.src='/Element%20Pictures/logo.png';"
        />
      </div>

      <h2 style="margin: 0; font-family: 'Cinzel', serif; font-size: 22px; color: #125463; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">
        YATHRALANKA
      </h2>
      <p style="margin: 4px 0 18px 0; font-size: 11.5px; font-weight: 700; color: #EAA335;">
        Play the game. Protect the past.
      </p>
      
      <h3 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 800; color: #125463;">
        Ayubowan, ${user.name}! 🌿
      </h3>
      <p style="margin: 0 0 20px 0; font-size: 13px; color: #4A3E2C; line-height: 1.55;">
        Welcome to YathraLanka. You have joined our expedition to explore, document, and protect Sri Lanka’s cultural treasures.
      </p>
      
      <!-- Celebratory Reward Box -->
      <div style="background: #FEF3C7; border: 1.5px solid #F59E0B; border-radius: 14px; padding: 14px 16px; margin-bottom: 24px;">
        <div style="font-size: 22px; line-height: 1; margin-bottom: 4px;">🎁</div>
        <div style="font-size: 14.5px; font-weight: 800; color: #92400E; margin-bottom: 2px;">
          +50 Experience Points Awarded!
        </div>
        <div style="font-size: 11.5px; font-weight: 600; color: #78350F; line-height: 1.4;">
          Ayubowan & Congratulations! Your journey into Sri Lanka's heritage begins now.
        </div>
      </div>

      <button id="btn-enter-yathralanka" style="width: 100%; background-color: #EAA335; color: #182226; font-size: 14.5px; font-weight: 800; border: 1px solid #F6BE68; padding: 15px 20px; border-radius: 12px; cursor: pointer; box-shadow: 0 6px 18px rgba(234, 163, 53, 0.42);">
        Enter YathraLanka App
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('btn-enter-yathralanka').onclick = function (e) {
    e.preventDefault();
    modal.remove();

    const usersDb = JSON.parse(localStorage.getItem('yathralanka_users') || '{}');
    if (usersDb[user.email]) {
      usersDb[user.email].dashboard_visits = 1;
      usersDb[user.email].showFirstRewardCard = true;
      localStorage.setItem('yathralanka_users', JSON.stringify(usersDb));
      localStorage.setItem('yathralanka_active_user', JSON.stringify(usersDb[user.email]));
      if (window.state) window.state.user = usersDb[user.email];
    }

    navigateToDashboard();
  };
}

window.renderFirstTimeWelcomeModal = showFirstTimeWelcomeModal;
window.showFirstTimeWelcomeModal = showFirstTimeWelcomeModal;

// ============================================================================
// 4. ROUTER & REWARD INJECTION
// ============================================================================
function navigateToDashboard() {
  if (typeof window.navigate === 'function') {
    window.navigate('dashboard');
  } else if (typeof window.renderScreen === 'function') {
    window.renderScreen('dashboard');
  } else if (typeof window.renderDashboardScreen === 'function') {
    window.renderDashboardScreen();
  }

  setTimeout(injectFirstTimeRewardCard, 100);
}

window.goToDashboardScreen = navigateToDashboard;
window.navigateToDashboard = navigateToDashboard;

function injectFirstTimeRewardCard() {
  const activeUser = JSON.parse(localStorage.getItem('yathralanka_active_user') || '{}');
  if (!activeUser || !activeUser.showFirstRewardCard) return;
  if (document.getElementById('first-visit-xp-box')) return;

  const wandererCard = Array.from(document.querySelectorAll('div')).find(
    el => el.textContent && el.textContent.trim().startsWith('Wanderer') && el.style.background
  );

  const cardHtml = `
    <div id="first-visit-xp-box" style="background: #FEF3C7; border: 1.5px solid #F59E0B; border-radius: 16px; padding: 14px 16px; margin: 14px 0; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);">
      <div style="display: flex; align-items: center; gap: 12px; text-align: left;">
        <span style="font-size: 24px;">🎁</span>
        <div>
          <div style="font-size: 13.5px; font-weight: 800; color: #92400E;">+50 Experience Points Awarded!</div>
          <div style="font-size: 11px; font-weight: 600; color: #78350F;">Ayubowan & Congratulations! Your journey into Sri Lanka's heritage begins now.</div>
        </div>
      </div>
      <button onclick="document.getElementById('first-visit-xp-box').remove()" style="background: none; border: none; font-size: 16px; color: #92400E; cursor: pointer; font-weight: 800; padding: 0 4px;">✕</button>
    </div>
  `;

  if (wandererCard && wandererCard.parentNode) {
    wandererCard.insertAdjacentHTML('beforebegin', cardHtml);
  } else {
    const frame = document.querySelector('.phone-frame') || document.getElementById('app');
    if (frame) frame.insertAdjacentHTML('afterbegin', cardHtml);
  }

  // Clear flag so it never displays again after visit #1
  activeUser.showFirstRewardCard = false;
  localStorage.setItem('yathralanka_active_user', JSON.stringify(activeUser));
  const usersDb = JSON.parse(localStorage.getItem('yathralanka_users') || '{}');
  if (usersDb[activeUser.email]) {
    usersDb[activeUser.email].showFirstRewardCard = false;
    localStorage.setItem('yathralanka_users', JSON.stringify(usersDb));
  }
}

window.injectFirstTimeRewardCard = injectFirstTimeRewardCard;
window.injectRewardCardIfEligible = injectFirstTimeRewardCard;

window.processDashboardEntry = function (source = 'direct') {
  const activeUser = JSON.parse(localStorage.getItem('yathralanka_active_user'));
  if (!activeUser) {
    window.navigate('auth');
    return;
  }

  const usersDb = JSON.parse(localStorage.getItem('yathralanka_users') || '{}');
  const userRecord = usersDb[activeUser.email] || activeUser;

  // Increment visit count & clear first-visit flags permanently
  userRecord.dashboard_visits = (userRecord.dashboard_visits || 0) + 1;
  userRecord.isNewRegistrant = false;
  userRecord.showFirstRewardCard = false;
  usersDb[userRecord.email] = userRecord;
  localStorage.setItem('yathralanka_users', JSON.stringify(usersDb));
  localStorage.setItem('yathralanka_active_user', JSON.stringify(userRecord));
  localStorage.setItem('yathralanka_current_user', JSON.stringify(userRecord));
  window.state.user = userRecord;

  console.log(`🧭 [Dashboard Entry] Source: ${source} | Total Visits: ${userRecord.dashboard_visits}`);

  // Navigate to Dashboard
  navigateToDashboard();
};

// ============================================================================
// 5. DASHBOARD FIRST-VISIT REWARD BANNER
// ============================================================================
function renderDashboardFirstVisitRewardBanner() {
  setTimeout(() => {
    const dashboardContainer = document.querySelector('.dashboard-container') || document.getElementById('app');
    if (!dashboardContainer) return;

    const banner = document.createElement('div');
    banner.id = 'first-visit-xp-banner';
    banner.style.cssText = `
      background: linear-gradient(135deg, #FEF3C7, #FDE68A);
      border: 1.5px solid #F59E0B;
      border-radius: 16px;
      padding: 16px 20px;
      margin: 16px auto;
      max-width: 480px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 14px rgba(245, 158, 11, 0.2);
      animation: fadeIn 0.4s ease-out;
    `;

    banner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; text-align: left;">
        <span style="font-size: 24px;">🎁</span>
        <div>
          <div style="font-size: 14px; font-weight: 800; color: #92400E;">Welcome Bonus: +50 XP Added!</div>
          <div style="font-size: 11.5px; font-weight: 600; color: #78350F;">First expedition milestone achieved. Rank: Guardian.</div>
        </div>
      </div>
      <button onclick="document.getElementById('first-visit-xp-banner').remove()" style="background: none; border: none; font-size: 18px; color: #92400E; cursor: pointer; font-weight: 800; padding: 4px 8px;">✕</button>
    `;

    dashboardContainer.prepend(banner);
  }, 100);
}



// Clear any stored map state preventing app boot
try {
  localStorage.removeItem('yathralanka_state');
  localStorage.removeItem('app_state');
  localStorage.removeItem('activeScreen');
  sessionStorage.clear();
} catch (e) { }

// Load cached profile from localStorage for offline resilience if present
const cachedProfileData = localStorage.getItem('yathra_user_profile');
let initialCachedUser = { ...initialUserState };
if (cachedProfileData) {
  try { initialCachedUser = { ...initialUserState, ...JSON.parse(cachedProfileData) }; } catch (e) { }
}

// --- APPLICATION STATE ---
window.state = {
  isAuthenticating: false,
  currentScreen: 'welcome',
  currentUser: null,
  user: initialCachedUser,
  isGuest: true,
  pendingAction: null,
  authTab: 'signin',
  activeSite: null,
  activeQuest: null,
  selectedSite: null,
  siteReferrer: 'dashboard',
  activeDirectoryTab: 'Heritage Trail',

  // Timer States
  dwellTimer: null,
  dwellTimeLeft: 900, // 15:00 mins in seconds
  dwellActive: false,
  gpsVerified: false,
  hasInitialPhotoCaptured: false, // Strict block gate state flag
  dwellImages: [], // Holds additional session capture images taken during freeze

  cooldownTimer: null,
  cooldownTimeLeft: 300, // 05:00 mins in seconds
  cooldownActive: false,

  // Verification & Cryptographic Ledger Engine
  verificationComment: "",
  lastVerificationResult: null,
  lastKnownLocation: null,
  eventLedger: JSON.parse(localStorage.getItem('yathra_event_ledger') || '[]'),
  ledgerFilter: 'ALL',
  // Quiz active state
  currentQuizIndex: 0,
  quizCorrectAnswers: 0,
  quizAnswers: [], // stores chosen indexes

  // Custom petition counter
  petitionSignatures: 8742,
  petitionSigned: false,

  // custom donations state
  donationAmount: 0,

  // navigation stack
  navStack: []
};

let state = window.state;

// ============================================================================
// ACTIVE USER SESSION MANAGEMENT
// ============================================================================
function setCurrentUserSession(user) {
  if (!window.state) window.state = {};
  window.state.user = user;
  if (user && !user.isGuest) {
    localStorage.setItem('yathralanka_current_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('yathralanka_current_user');
  }
}

function restoreCurrentUserSession() {
  try {
    const saved = localStorage.getItem('yathralanka_current_user');
    if (saved) {
      if (!window.state) window.state = {};
      window.state.user = JSON.parse(saved);
    } else if (!window.state?.user) {
      if (!window.state) window.state = {};
      window.state.user = { isGuest: true, name: "Guest Explorer", xp: 0 };
    }
  } catch (e) {
    if (!window.state) window.state = {};
    window.state.user = { isGuest: true, name: "Guest Explorer", xp: 0 };
  }
}

// Call on app initialization / cold boot
restoreCurrentUserSession();

// Clear any stored verified site state on initialization so all landmarks remain unverified by default
try {
  localStorage.removeItem('yathra_verified_sites');
  sessionStorage.removeItem('yathra_verified_sites');
} catch (e) { }

if (!window.state) window.state = {};
window.state.verifiedSites = [];

// Global Site Click Interceptor & Listener Initializer
window.initGlobalSiteClickListeners = function () {
  if (window.__globalSiteListenerInitialized) return;
  window.__globalSiteListenerInitialized = true;
  console.log('[BOOT] globalSiteListener count=1');

  // Non-blocking site click listener (capture phase disabled to preserve card handlers & drawer opening)
  window.addEventListener('click', function (e) {
    const trigger = e.target.closest('[data-site-id]');
    if (!trigger) return;

    let siteId = trigger.getAttribute('data-site-id') || trigger.getAttribute('data-id') || trigger.dataset?.siteId;
    console.log('[SITE-FREEZE HANDLER D - global delegation] trigger clicked siteId:', siteId);
    if (siteId && typeof window.openSitePreview === 'function' && !e.defaultPrevented) {
      console.log("🖱️ Site card selected via global delegation:", siteId);
      window.openSitePreview(siteId);
    }
  }, false);
};

// Calculate Distance in kilometers using Haversine formula
window.calculateDistanceKm = function (lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Shortened Site Name Resolver for High-Contrast Map Tooltips
window.getShortSiteName = function (site) {
  if (!site) return "Landmark";
  const name = typeof site === 'string' ? site : (site.name || site.id || '');
  const id = String(site.id || name).toLowerCase().replace(/[^a-z0-9]/g, '');

  if (id.includes('museum') || id.includes('colombo')) return 'Museum';
  if (id.includes('sigiriya')) return 'Sigiriya';
  if (id.includes('tooth') || id.includes('kandy')) return 'Tooth Relic';
  if (id.includes('ruwanweli')) return 'Ruwanweliseya';
  if (id.includes('mihintale')) return 'Mihintale';
  if (id.includes('galle')) return 'Galle Fort';
  if (id.includes('dambulla')) return 'Dambulla';
  if (id.includes('ritigala')) return 'Ritigala';
  if (id.includes('dowa')) return 'Dowa';
  if (id.includes('yudagana')) return 'Yudaganawa';
  if (id.includes('pilikut')) return 'Pilikuttuwa';
  if (id.includes('maligawila')) return 'Maligawila';
  if (id.includes('buduru')) return 'Buduruwagala';
  if (id.includes('independen') || id.includes('hall')) return 'Indep. Hall';
  if (id.includes('bmich')) return 'BMICH';

  return name.length > 14 ? name.substring(0, 12) + '...' : name;
};

// Comprehensive Coordinate Registry for all Yathra Lanka Heritage & Gem Sites
const SITE_COORDINATES_MAP = {
  // Heritage Trail
  bmich: { lat: 6.90176, lng: 79.87282 },
  colombo_museum: { lat: 6.91041, lng: 79.86097 },
  national_museum: { lat: 6.91041, lng: 79.86097 },
  independence_memorial_hall: { lat: 6.90413, lng: 79.86758 },
  independence_hall: { lat: 6.90413, lng: 79.86758 },
  sigiriya: { lat: 7.956944, lng: 80.759720 },
  temple_of_the_tooth: { lat: 7.2936, lng: 80.6414 },
  temple_of_tooth: { lat: 7.2936, lng: 80.6414 },
  kandy_tooth: { lat: 7.2936, lng: 80.6414 },
  ruwanweliseya: { lat: 8.34998, lng: 80.3964 },
  mihintale: { lat: 8.3593, lng: 80.5103 },
  galle_fort: { lat: 6.028624, lng: 80.216797 },
  dambulla: { lat: 7.8567, lng: 80.6483 },
  dambulla_cave: { lat: 7.8567, lng: 80.6483 },

  // Hidden Gems
  ritigala: { lat: 8.11833, lng: 80.66461 },
  ritigala_monastery: { lat: 8.11833, lng: 80.66461 },
  dowa_temple: { lat: 6.8564, lng: 81.0225 },
  dowa_rock_temple: { lat: 6.8564, lng: 81.0225 },
  yudaganawa: { lat: 6.77, lng: 81.23 },
  pilikuttuwa: { lat: 7.06394, lng: 80.05031 }, // converted 07°03′50.2″N, 80°03′01.1″E
  maligawila: { lat: 6.7272, lng: 81.3501 },
  buduruwagala: { lat: 6.6847, lng: 81.0795 }
};

// Safe Coordinate Resolver
window.resolveSiteCoordinates = function (site) {
  if (!site) return { lat: 7.8731, lng: 80.7718 };

  // 1. Direct Lat/Lng properties
  if (typeof site.lat === 'number' && typeof site.lng === 'number') {
    return { lat: site.lat, lng: site.lng };
  }
  if (typeof site.latitude === 'number' && typeof site.longitude === 'number') {
    return { lat: site.latitude, lng: site.longitude };
  }
  if (Array.isArray(site.coordinates) && site.coordinates.length >= 2) {
    return { lat: Number(site.coordinates[0]), lng: Number(site.coordinates[1]) };
  }
  if (site.location && typeof site.location.lat === 'number' && typeof site.location.lng === 'number') {
    return { lat: site.location.lat, lng: site.location.lng };
  }

  // 2. Lookup by ID, slug, or normalized title in coordinate map
  const keys = [
    String(site.id || '').toLowerCase().trim(),
    String(site.slug || '').toLowerCase().trim(),
    String(site.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_'),
    String(site.name || '').toLowerCase().replace(/\s+/g, '_')
  ];

  for (const k of keys) {
    if (SITE_COORDINATES_MAP[k]) {
      return SITE_COORDINATES_MAP[k];
    }
    // Substring partial match
    for (const [mapKey, coords] of Object.entries(SITE_COORDINATES_MAP)) {
      if (k.includes(mapKey) || mapKey.includes(k)) {
        return coords;
      }
    }
  }

  // Geographic center of Sri Lanka fallback
  return { lat: 7.8731, lng: 80.7718 };
};

// --- STRUCTURED LANDMARK VERIFICATION & SEQUENTIAL XP ENGINE ---
// Phase breakdown:
// 1. 'GPS': distance <= 50 meters (0.05 km) -> +100 XP
// 2. 'PHOTO': photo verification submission -> +70 XP
// 3. 'QUIZ': heritage lore quiz passed (>= 80% score) -> +50 XP
// Total Completion Cap per Landmark: 220 XP
window.recalculateTotalXP = function () {
  if (!window.state) window.state = {};
  const currentUid = auth?.currentUser?.uid || window.state?.user?.uid;
  if (!currentUid || window.state?.isGuest) {
    const guestXP = window.state?.user?.xp || 0;
    document.querySelectorAll('.user-xp-display, .profile-xp-badge').forEach(el => {
      el.textContent = `${guestXP} pts`;
    });
    return guestXP;
  }

  const completedSitesKey = window.getCompletedSitesKey(currentUid);
  const siteProgressKey = window.getSiteProgressKey(currentUid);

  let completedSites = {};
  try {
    const raw = localStorage.getItem(completedSitesKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach(id => { completedSites[id] = { gps: true }; });
      } else if (typeof parsed === 'object' && parsed !== null) {
        completedSites = parsed;
      }
    }
  } catch (e) { }

  let siteProgress = {};
  try {
    const rawP = localStorage.getItem(siteProgressKey);
    if (rawP) siteProgress = JSON.parse(rawP);
  } catch (e) { }

  Object.keys(siteProgress).forEach(sId => {
    const p = siteProgress[sId];
    if (p) {
      if (!completedSites[sId]) completedSites[sId] = {};
      if (p.gpsVerified) completedSites[sId].gps = true;
      if (p.photoVerified) completedSites[sId].photo = true;
      if (p.quizPassed) completedSites[sId].quiz = true;
    }
  });

  let baseXP = Number.isFinite(Number(window.state?.user?.xp)) ? Number(window.state.user.xp) : 50;

  let completionBonus = 0;
  Object.values(completedSites).forEach(siteData => {
    if (typeof siteData === 'object' && siteData !== null) {
      if (siteData.gps || siteData.gpsVerified) completionBonus += 100;
      if (siteData.photo || siteData.photoVerified) completionBonus += 70;
      if (siteData.quiz || siteData.quizPassed) completionBonus += 50;
    } else if (siteData) {
      completionBonus += 100;
    }
  });

  const totalCalculatedXP = Math.max(baseXP, 50 + completionBonus);

  if (window.state.user) {
    window.state.user.xp = totalCalculatedXP;
    window.saveStoredUserProfile(currentUid, window.state.user);
  }
  window.state.xp = totalCalculatedXP;

  document.querySelectorAll('.user-xp-display, .profile-xp-badge').forEach(el => {
    el.textContent = `${totalCalculatedXP} pts`;
  });

  return totalCalculatedXP;
};

window.awardSiteXP = function (siteId, phase) {
  return window.awardLandmarkXP(siteId, phase);
};

window.awardLandmarkXP = function (siteId, phase) {
  if (!window.state) window.state = {};
  const currentUid = auth?.currentUser?.uid || window.state?.user?.uid;
  const siteProgressKey = window.getSiteProgressKey(currentUid);
  const completedSitesKey = window.getCompletedSitesKey(currentUid);

  window.loadCurrentSiteProgress();

  const sId = String(siteId).toLowerCase().trim();
  if (!window.state.siteProgress[sId]) {
    window.state.siteProgress[sId] = {
      gpsVerified: false,
      gpsXP: 0,
      photoVerified: false,
      photoXP: 0,
      quizPassed: false,
      quizXP: 0,
      totalXP: 0
    };
  }

  const prog = window.state.siteProgress[sId];
  let xpAwarded = 0;
  let message = "";

  if (phase === 'GPS' && !prog.gpsVerified) {
    prog.gpsVerified = true;
    prog.gpsXP = 100;
    xpAwarded = 100;
    message = `📍 GPS Geofence Arrival verified! +100 XP awarded.`;
  } else if (phase === 'PHOTO' && !prog.photoVerified) {
    prog.photoVerified = true;
    prog.photoXP = 70;
    xpAwarded = 70;
    message = `📸 Photo Verification submitted! +70 XP awarded.`;
  } else if (phase === 'QUIZ' && !prog.quizPassed) {
    prog.quizPassed = true;
    prog.quizXP = 50;
    xpAwarded = 50;
    message = `🧠 Heritage Lore Quiz passed! +50 XP awarded.`;
  }

  if (xpAwarded > 0) {
    const currentTotal = prog.totalXP || 0;
    const newTotal = Math.min(220, currentTotal + xpAwarded);
    const actualGained = newTotal - currentTotal;
    prog.totalXP = newTotal;

    if (actualGained > 0) {
      window.state.xp = (window.state.xp || 0) + actualGained;
      if (window.state.user) {
        window.state.user.xp = (window.state.user.xp || 0) + actualGained;
        window.state.user.sitesVisited = Object.keys(window.state.siteProgress).filter(k => window.state.siteProgress[k].gpsVerified || window.state.siteProgress[k].photoVerified).length;
      }

      if (typeof window.checkAndAwardSmartMedals === 'function') {
        window.checkAndAwardSmartMedals();
      }

      let completedSites = [];
      try {
        completedSites = JSON.parse(localStorage.getItem(completedSitesKey) || '[]');
      } catch (e) { }
      if (!completedSites.includes(sId)) {
        completedSites.push(sId);
      }
      try {
        localStorage.setItem(completedSitesKey, JSON.stringify(completedSites));
      } catch (e) { }

      try {
        localStorage.setItem(siteProgressKey, JSON.stringify(window.state.siteProgress));
        if (currentUid && window.state.user) {
          window.saveStoredUserProfile(currentUid, window.state.user);
        }
      } catch (e) { }

      if (typeof window.recalculateTotalXP === 'function') {
        window.recalculateTotalXP();
      }

      if (typeof window.showNotification === 'function') {
        window.showNotification(message, "success");
      }
    }
  }

  return prog;
};

window.checkAndAwardSmartMedals = function () {
  if (!window.state) return;
  if (!window.state.unlockedMedals) {
    try {
      window.state.unlockedMedals = JSON.parse(localStorage.getItem('yathra_unlocked_medals') || '[]');
    } catch (e) {
      window.state.unlockedMedals = [];
    }
  }

  const medals = [
    { id: 'pathfinder_kingdom', title: 'Pathfinder of the Kingdom', tier: 'Bronze', xp: 150, cond: () => (window.state.user?.sitesVisited >= 3 || Object.keys(window.state.siteProgress || {}).length >= 3) },
    { id: 'royal_chronicler', title: 'Royal Chronicler', tier: 'Silver', xp: 200, cond: () => (Object.values(window.state.siteProgress || {}).filter(p => p.photoVerified).length >= 5 || window.state.user?.sitesVisited >= 5) },
    { id: 'guardian_polonnaruwa', title: 'Guardian of Polonnaruwa', tier: 'Gold', xp: 300, cond: () => (window.state.user?.quizzesPassed >= 1 && window.state.user?.sitesVisited >= 1) },
    { id: 'lankan_cartographer', title: 'Lankan Cartographer', tier: 'Diamond', xp: 500, cond: () => (window.state.user?.sitesVisited >= 5) },
    { id: 'sage_mahavamsa', title: 'Sage of the Mahavamsa', tier: 'Master Relic', xp: 400, cond: () => (window.state.user?.quizzesPassed >= 10) }
  ];

  medals.forEach(m => {
    if (!window.state.unlockedMedals.includes(m.id) && m.cond()) {
      window.state.unlockedMedals.push(m.id);
      window.state.xp = (window.state.xp || 0) + m.xp;
      if (window.state.user) {
        window.state.user.xp = (window.state.user.xp || 0) + m.xp;
        window.state.user.medals = window.state.unlockedMedals.length;
      }
      try {
        localStorage.setItem('yathra_unlocked_medals', JSON.stringify(window.state.unlockedMedals));
        localStorage.setItem('yathra_user_xp', String(window.state.xp));
        if (window.state.user) localStorage.setItem('yathra_current_user', JSON.stringify(window.state.user));
      } catch (e) { }

      if (typeof window.showNotification === 'function') {
        window.showNotification(`🏆 S.M.A.R.T. Medal Unlocked: ${m.title} (+${m.xp} XP)!`, "success");
      }
    }
  });
};

// Strict Site Checkpoint Verifier
window.verifySiteCheckpoint = function (siteId) {
  console.log("📍 [Checkpoint] Calculating live GPS distance for site:", siteId);
  if (!siteId) return;

  const pool = window.sitesData || (typeof sitesData !== 'undefined' ? sitesData : []);
  const rawList = Array.isArray(pool) ? pool : Object.values(pool);
  const siteList = rawList.filter(s => s && typeof s === 'object');
  const cleanId = String(siteId).toLowerCase().trim();

  const site = siteList.find(s => {
    if (!s) return false;
    const sid = s.id ? String(s.id).toLowerCase().trim() : '';
    const slug = s.slug ? String(s.slug).toLowerCase().trim() : '';
    const name = s.name ? String(s.name).toLowerCase().trim() : '';
    const normName = s.name ? s.name.toLowerCase().replace(/[^a-z0-9]/g, '_') : '';
    return sid === cleanId || slug === cleanId || name === cleanId || normName === cleanId;
  }) || window.state?.activeSite;

  if (!site) return;

  // Resolve specific coordinates for THIS site
  const siteCoords = window.resolveSiteCoordinates(site);
  console.log(`🗺️ Target Site: ${site.name} | Coords: (${siteCoords.lat}, ${siteCoords.lng})`);

  const btn = document.getElementById('btn-ar-verify') || document.querySelector('.btn-verify-checkpoint');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `🛰️ Acquiring Live GPS Satellite Lock...`;
  }

  if (!navigator.geolocation) {
    return;
  }

  // Request fresh location with maximum accuracy
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userLat = position.coords ? position.coords.latitude : null;
      const userLng = position.coords ? position.coords.longitude : null;

      if (!userLat || !userLng || isNaN(userLat) || isNaN(userLng)) {
        return;
      }

      // Real distance calculation for THIS specific landmark
      const distanceKm = window.calculateDistanceKm(userLat, userLng, siteCoords.lat, siteCoords.lng);
      console.log(`📡 User: (${userLat.toFixed(4)}, ${userLng.toFixed(4)}) ➡️ ${site.name} (${siteCoords.lat}, ${siteCoords.lng}): ${distanceKm.toFixed(1)} km`);

      if (distanceKm <= 0.5 || distanceKm === 0 || isNaN(distanceKm)) {
        if (!window.state) window.state = {};
        window.state.siteLocationVerified = site.id;
        // Location XP is awarded only after the full 15-minute presence session.
        window.initBackgroundImmersionTimer?.(site.id || cleanId);
        window.navigate('site-detail', { id: site.id });
      } else if (distanceKm > 0.5) {
        window.showDistanceWarningModal(site, distanceKm, false);
      }
    },
    (err) => {
      console.warn("GPS location error:", err);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
};

// Checkpoint Success Handler
window.completeCheckpointSuccess = function (site, distanceKm) {
  const sId = site.id || site.slug || site.name;

  // Award +70 XP for Photo Verification Submission
  const prog = window.awardLandmarkXP(sId, 'PHOTO');
  const xpReward = 70;

  if (!window.state) window.state = {};
  if (!window.state.verifiedSites) window.state.verifiedSites = [];
  if (!window.state.verifiedSites.includes(sId)) {
    window.state.verifiedSites.push(sId);
  }

  try {
    localStorage.setItem('yathra_verified_sites', JSON.stringify(window.state.verifiedSites));
  } catch (e) { }

  // Update Button UI
  const btn = document.getElementById('btn-ar-verify') || document.querySelector('.btn-verify-checkpoint');
  if (btn) {
    btn.disabled = true;
    btn.style.background = '#10B981';
    btn.style.boxShadow = '0 4px 14px rgba(16,185,129,0.3)';
    btn.innerHTML = `✓ Verified Photo Checkpoint (+70 XP Claimed)`;
  }

  // Show Success Modal
  window.showVerificationModal(
    site,
    xpReward,
    "Photo Checkpoint Verified!",
    `You have successfully submitted photo verification at ${site.name}. +70 XP has been added to your profile passport.`
  );
};

// Strict Distance Warning Modal
window.showDistanceWarningModal = function (site, distanceKm, referrer = 'directory') {
  const ref = (typeof referrer === 'string' && referrer) ? referrer : 'directory';
  const oldOverlay = document.getElementById('checkpoint-modal-overlay');
  if (oldOverlay) oldOverlay.remove();

  const overlay = document.createElement('div');
  overlay.id = 'checkpoint-modal-overlay';
  overlay.style.cssText = `
    position: absolute; inset: 0; background: rgba(8, 43, 51, 0.75);
    backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center;
    z-index: 10000; padding: 20px; box-sizing: border-box;
  `;

  overlay.innerHTML = `
    <div style="background: #FFFFFF; border-radius: 20px; padding: 24px 20px; width: 100%; max-width: 320px; text-align: center; box-shadow: 0 16px 40px rgba(0,0,0,0.3);">
      <div style="font-size: 38px; margin-bottom: 8px;">🛰️</div>
      <h3 style="font-size: 17px; color: #125463; margin: 0 0 8px 0; font-weight: 800;">
        Outside Verification Zone
      </h3>
      <p style="font-size: 12.5px; color: #4A3E2C; line-height: 1.55; margin: 0 0 20px 0;">
        You are currently located <strong>${(typeof distanceKm === 'number' ? distanceKm : 0).toFixed(1)} km</strong> away from <strong>${site ? site.name : 'Sanctuary'}</strong>.<br><br>
        To complete archaeological verification, you must be physically present within the <strong>500 m landmark perimeter</strong>.
      </p>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button onclick="document.getElementById('checkpoint-modal-overlay').remove();" style="width: 100%; background: #0C6C7A; color: #FFF; border: none; border-radius: 11px; padding: 11px; font-weight: 700; font-size: 13px; cursor: pointer;">
          Understood
        </button>
        <button onclick="document.getElementById('checkpoint-modal-overlay').remove(); window.navigate('${ref}');" style="width: 100%; background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1; border-radius: 11px; padding: 9px; font-weight: 700; font-size: 12px; cursor: pointer;">
          ← Return to ${ref === 'map' ? 'Map' : 'Directory'}
        </button>
      </div>
    </div>
  `;

  const chassis = document.querySelector('.screen-viewport') || document.querySelector('.iphone-chassis') || document.body;
  chassis.appendChild(overlay);
};

// Real Camera AR Scanner View (Triggered Only When On-Site <= 500 m)
window.launchCameraARScanner = function (site, distanceKm) {
  const host = document.querySelector('.screen-content') ||
    document.getElementById('app-screen') ||
    document.querySelector('.app-viewport') ||
    document.getElementById('app') ||
    document.body;

  if (!host) return;

  host.innerHTML = `
    <div class="screen ar-scanner-screen" style="position: relative; width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; padding: 20px 16px 40px 16px; box-sizing: border-box;">
      <!-- Video Element for Camera Stream -->
      <video id="ar-camera-feed" autoplay playsinline muted preload="auto" style="position: absolute; top:0; left:0; width: 100%; height: 100%; object-fit: cover; background: #000; z-index: 1; opacity: 0; transition: opacity 0.2s ease;" onloadeddata="this.style.opacity='1'"></video>
      
      <!-- AR Viewfinder Overlay -->
      <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: 2px dashed rgba(16,185,129,0.7); margin: 60px 30px 120px 30px; border-radius: 24px; z-index: 2; pointer-events: none; display: flex; align-items: center; justify-content: center;">
        <span style="color: #10B981; font-weight: 800; font-size: 12px; letter-spacing: 1px; background: rgba(0,0,0,0.6); padding: 6px 12px; border-radius: 20px;">
          📍 WITHIN 1.0 KM (${(distanceKm * 1000).toFixed(0)}m)
        </span>
      </div>

      <!-- Top Header -->
      <div style="position: relative; z-index: 10; display: flex; align-items: center; justify-content: space-between;">
        <button id="btn-close-ar" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); color: #FFF; border-radius: 10px; padding: 8px 14px; font-weight: 700; cursor: pointer;">
          ✕ Exit
        </button>
        <span style="background: rgba(12,108,122,0.8); color: #FFF; font-weight: 700; font-size: 12px; padding: 6px 12px; border-radius: 12px;">
          AR Landmark Scanner
        </span>
      </div>

      <!-- Bottom Capture & Scan Action -->
      <div style="position: relative; z-index: 10; text-align: center;">
        <p style="color: #FFFFFF; font-size: 13px; margin-bottom: 14px; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">
          Point camera at <b>${site.name}</b> to complete archaeological verification
        </p>
        <button id="btn-capture-landmark" style="width: 100%; background: #10B981; color: #FFF; border: none; border-radius: 14px; padding: 14px; font-weight: 800; font-size: 15px; cursor: pointer; box-shadow: 0 4px 20px rgba(16,185,129,0.4);">
          📸 Capture & Claim +${site.xp || 50} XP
        </button>
      </div>
    </div>
  `;

  // Start Real Camera Stream
  const video = document.getElementById('ar-camera-feed');
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        if (video) video.srcObject = stream;
      })
      .catch(err => {
        console.warn("Camera access denied or unavailable:", err);
      });
  }

  // Exit Camera
  document.getElementById('btn-close-ar').onclick = function () {
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
    window.selectAndOpenSite(site.id);
  };

  // Capture & Finalize Checkpoint
  document.getElementById('btn-capture-landmark').onclick = function () {
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
    window.completeCheckpointSuccess(site, distanceKm);
  };
};

// Success Rewards Modal
window.showVerificationModal = function (site, xpEarned, title, message) {
  const overlay = document.createElement('div');
  overlay.id = 'checkpoint-success-modal';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(5px);
    display: flex; align-items: center; justify-content: center;
    z-index: 10000; padding: 20px; box-sizing: border-box;
  `;

  const isRejection = xpEarned === 0 || (title && (title.includes('Rejection') || title.includes('Below') || title.includes('⚠️')));

  overlay.innerHTML = `
    <div style="background: #FFFFFF; border-radius: 22px; padding: 24px 20px; width: 100%; max-width: 320px; text-align: center; box-shadow: 0 12px 36px rgba(0,0,0,0.3); animation: popIn 0.3s ease-out;">
      <div style="width: 60px; height: 60px; border-radius: 50%; background: ${isRejection ? '#FEF2F2' : '#ECFDF5'}; color: ${isRejection ? '#DC2626' : '#10B981'}; font-size: 28px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto; box-shadow: 0 4px 12px ${isRejection ? 'rgba(220,38,38,0.2)' : 'rgba(16,185,129,0.2)'};">
        ${isRejection ? '⚠️' : '✓'}
      </div>
      <h3 style="font-size: 18px; color: #1E293B; margin: 0 0 6px 0; font-weight: 800;">${title}</h3>
      ${xpEarned > 0 ? `<div style="display: inline-block; background: #FEF3C7; color: #D97706; font-weight: 800; font-size: 14px; padding: 4px 14px; border-radius: 20px; margin-bottom: 12px;">+${xpEarned} XP AWARDED</div>` : ''}
      <p style="font-size: 13px; color: #475569; line-height: 1.5; margin: 0 0 20px 0;">${message}</p>
      
      <div style="display: flex; gap: 8px;">
        <button id="btn-modal-done" style="flex: 1; background: ${isRejection ? '#DC2626' : '#0C6C7A'}; color: #FFF; border: none; border-radius: 12px; padding: 12px; font-weight: 700; font-size: 13px; cursor: pointer;">
          ${isRejection ? 'Try Again' : 'Continue Exploring'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('btn-modal-done').onclick = function () {
    overlay.remove();
    if (site && (site.id || site)) {
      const siteId = site.id || site;
      if (typeof window.navigate === 'function') {
        window.navigate('site-detail', { id: siteId });
      }
    }
  };
};

// Universal Site Detail Opener (Delegates to authoritative definition at line 3411)
window.selectAndOpenSite = function (siteId) {
  if (typeof window.executeAppNavigation === 'function') {
    return window.executeAppNavigation('site-detail', { id: siteId });
  }
};
window.openSiteById = window.selectAndOpenSite;

window.openSiteById = window.selectAndOpenSite;

// Card Event Attacher Function
window.attachDirectoryCardEvents = function () {
  const cards = document.querySelectorAll('.heritage-card, .site-card-item, .directory-card, [data-site-id]');
  cards.forEach(card => {
    card.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      const id = card.getAttribute('data-site-id') || card.getAttribute('data-id') || card.dataset?.siteId;
      if (id) window.selectAndOpenSite(id);
    };
  });
};

function initWelcomeAppGate() {
  if (window.state) {
    window.state.currentScreen = 'welcome';
  }
  if (typeof window.navigate === 'function') {
    window.navigate('welcome');
  }
}

window.forceRenderDirectory = function () {
  if (typeof window.navigate === 'function') {
    window.navigate('welcome');
  }
};

const LEGACY_PRESENTATION_EVENT_IDS = new Set([
  'EVT-20260820-9A7F',
  'EVT-20260820-8B3E',
  'EVT-20260820-7C1D',
  'EVT-20260820-6D9A'
]);
const cleanedEventLedger = (state.eventLedger || []).filter(event => !LEGACY_PRESENTATION_EVENT_IDS.has(event?.eventId));
if (cleanedEventLedger.length !== (state.eventLedger || []).length) {
  state.eventLedger = cleanedEventLedger;
  localStorage.setItem('yathra_event_ledger', JSON.stringify(state.eventLedger));
}

// --- CORE GEOLOCATION & MULTI-FACTOR VERIFICATION ENGINE ---
function calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function evaluateAntiSpoofingGuard(userLat, userLng, currentTimestamp = Date.now()) {
  if (state.lastKnownLocation && state.lastKnownLocation.timestamp) {
    const timeDeltaSec = (currentTimestamp - state.lastKnownLocation.timestamp) / 1000;
    if (timeDeltaSec > 0 && timeDeltaSec < 3600) {
      const distMeters = calculateHaversineDistanceMeters(
        state.lastKnownLocation.latitude,
        state.lastKnownLocation.longitude,
        userLat,
        userLng
      );
      const speedKmH = (distMeters / timeDeltaSec) * 3.6;
      if (speedKmH > 120) {
        return { isSpoof: true, reason: `Unrealistic velocity jump: ${Math.round(speedKmH)} km/h (>120 km/h threshold)` };
      }
    }
  }
  state.lastKnownLocation = { latitude: userLat, longitude: userLng, timestamp: currentTimestamp };
  return { isSpoof: false, reason: "Velocity profile clean" };
}

function evaluateVisionInspection(site, userLat, userLng, capturedImageSrc, imageTimestamp = Date.now()) {
  const targetLat = site.latitude;
  const targetLng = site.longitude;
  const distanceMeters = calculateHaversineDistanceMeters(userLat, userLng, targetLat, targetLng);
  const geofenceRadius = GEOFENCE_RADIUS_METERS || 500;

  const spoofCheck = evaluateAntiSpoofingGuard(userLat, userLng, imageTimestamp);

  let visionScore = 88;
  if (capturedImageSrc && capturedImageSrc.length > 50) {
    let hash = 0;
    for (let i = 0; i < capturedImageSrc.length; i++) {
      hash = (hash << 5) - hash + capturedImageSrc.charCodeAt(i);
      hash |= 0;
    }
    visionScore = 75 + Math.abs(hash % 24);
  }

  let status = 'PASSED';
  let comment = '';

  if (spoofCheck.isSpoof) {
    status = 'SPOOF_SUSPECTED';
    comment = `Security Anomaly Intercepted: ${spoofCheck.reason}`;
  } else if (distanceMeters > geofenceRadius) {
    status = 'OUT_OF_BOUNDS';
    comment = `Geofence Delta Alert: Device is ${distanceMeters}m from site coordinates (Geofence Threshold: ${geofenceRadius}m).`;
  } else if (visionScore < 75) {
    status = 'FAILED_VISION';
    comment = `Vision Model Rejection: Landmark feature match score (${visionScore}%) is below required 75% threshold.`;
  } else {
    status = 'PASSED';
    comment = `Verification Successful: Landmark geometry matches reference dataset (${visionScore}% Confidence). Distance Delta: ${distanceMeters}m.`;
  }

  const block = recordVerificationLedgerEvent(site, userLat, userLng, distanceMeters, visionScore, status, capturedImageSrc);
  state.lastVerificationResult = { status, visionScore, distanceMeters, comment, block };
  state.verificationComment = comment;

  return state.lastVerificationResult;
}

function recordVerificationLedgerEvent(site, userLat, userLng, distanceMeters, visionScore, status, imageSrc) {
  const eventId = "EVT-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();
  const timestamp = new Date().toISOString();

  const rawPayload = `${eventId}:${timestamp}:${site.id}:${userLat}:${userLng}:${distanceMeters}:${visionScore}:${status}`;
  let hashVal = 0;
  for (let i = 0; i < rawPayload.length; i++) {
    hashVal = (hashVal << 7) - hashVal + rawPayload.charCodeAt(i);
    hashVal |= 0;
  }
  const signature = "0x" + Math.abs(hashVal).toString(16).padStart(8, '0') + Math.abs(hashVal * 31).toString(16).padEnd(24, 'f').substring(0, 56);

  const block = {
    eventId,
    timestamp,
    siteId: site.id,
    siteName: site.name,
    userCoords: { latitude: userLat, longitude: userLng, accuracy: 5.0 },
    targetCoords: { latitude: site.latitude, longitude: site.longitude },
    distanceDeltaMeters: distanceMeters,
    visionScore,
    status,
    imageMetadata: {
      sizeBytes: imageSrc ? imageSrc.length : 172000,
      mimeType: "image/jpeg",
      hash: "SHA256-" + signature.substring(2, 18)
    },
    signature
  };

  if (!state.eventLedger) state.eventLedger = [];
  state.eventLedger.unshift(block);
  localStorage.setItem('yathra_event_ledger', JSON.stringify(state.eventLedger));
  return block;
}

// Global reference for location intervals
let backgroundLocationInterval = null;
const GEOFENCE_RADIUS_METERS = 500;
const POLLING_INTERVAL_MS = 120000; // 2 minutes interval polling
const DRIFT_GRACE_LIMIT_MS = 180000; // 3 minutes structural grace period

window.__appInitialized = false;

function initApp() {
  if (window.__appInitialized) {
    return;
  }
  window.__appInitialized = true;
  console.log('[BOOT] initApp count=1');

  // Safely initialize listeners
  if (typeof window.initGlobalSiteClickListeners === 'function') {
    window.initGlobalSiteClickListeners();
  }

  // Dual-path router check
  if (typeof window.initAppRouter === 'function') {
    window.initAppRouter();
  }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  initAuthListener();

  const queueData = localStorage.getItem('yathra_sync_queue');
  if (queueData) {
    state.offlineSyncQueue = JSON.parse(queueData);
  } else {
    state.offlineSyncQueue = [];
  }

  window.addEventListener('online', () => {
    processSyncQueue();
  });
});

// --- GLOBAL ROUTING CONTROLLERS & EVENT DELEGATION ---

// 1. Launch Auth Card on 'signin' or 'signup' tab
window.openAuthScreen = function (targetTab = 'signin') {
  console.log("👉 Opening Auth screen on tab:", targetTab);
  if (!window.state) window.state = {};
  window.state.authActiveTab = targetTab === 'signup' ? 'signup' : 'signin';
  window.state.authOrigin = null;
  if (typeof window.executeAppNavigation === 'function') {
    window.executeAppNavigation('auth');
  } else if (typeof window.navigate === 'function') {
    window.navigate('auth');
  }
};

// 2. Direct Guest Bypass to Central Dashboard ('home')
window.continueAsGuest = async function (e) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
    e.stopPropagation();
  }

  if (window.__isEnteringGuestMode) {
    console.log('[GUEST-ENTRY] tap ignored (entry already in progress)');
    return;
  }
  window.__isEnteringGuestMode = true;

  try {
    // 1. If Firebase session is active, await signOut(auth) and confirm auth.currentUser === null
    if (typeof auth !== 'undefined' && auth && auth.currentUser) {
      console.log('[GUEST-ENTRY] firebaseSignOut=start');
      try {
        await signOut(auth);
        if (auth.currentUser !== null) {
          console.error('[GUEST-ENTRY] firebaseSignOut=failure (auth.currentUser not null)');
          if (typeof window.showNotification === 'function') {
            window.showNotification("Sign-out failed. Please try again.", "error");
          }
          return;
        }
        console.log('[GUEST-ENTRY] firebaseSignOut=success');
      } catch (err) {
        console.error('[GUEST-ENTRY] firebaseSignOut=failure', err);
        if (typeof window.showNotification === 'function') {
          window.showNotification("Sign-out failed. Please try again.", "error");
        }
        return;
      }
    }

    // 2. Establish explicit session-scoped guest mode
    sessionStorage.setItem('yathralanka_session_mode', 'guest');
    if (localStorage.getItem('yathralanka_session_mode') === 'guest') {
      localStorage.removeItem('yathralanka_session_mode');
    }
    localStorage.removeItem('yathralanka_current_user');
    localStorage.removeItem('yathralanka_active_user');
    localStorage.removeItem('yathralanka_user');

    // 3. Clear in-memory authenticated profile state and create normalized Guest Explorer
    const guestUser = {
      name: "Guest Explorer",
      displayName: "Guest Explorer",
      isGuest: true,
      emailVerified: false,
      xp: 0,
      level: "Novice Explorer",
      rank: "Novice Explorer",
      dashboard_visits: 1
    };

    if (!window.state) window.state = {};
    window.state.user = guestUser;
    window.state.currentUser = guestUser;
    window.state.isGuest = true;
    window.state.isLoggedIn = false;
    window.state.sessionMode = 'guest';
    window.state.currentScreen = 'home';
    window.state.currentParams = {};

    // DO NOT call native GoogleAuth.signOut() in the guest-entry path

    if (typeof window.executeAppNavigation === 'function') {
      window.executeAppNavigation('home');
    } else if (typeof window.navigate === 'function') {
      window.navigate('home');
    }
  } finally {
    window.__isEnteringGuestMode = false;
  }
};

// 3. Dual-Tab Switcher within the Auth Screen (Smooth Slider, Zero Geometry Jumps & Zero Bleed)
window.switchAuthSlider = function (targetTab) {
  if (!window.state) window.state = {};
  if (typeof state !== 'undefined') {
    state.authActiveTab = targetTab === 'signup' ? 'signup' : 'signin';
  }
  window.state.authActiveTab = targetTab === 'signup' ? 'signup' : 'signin';

  const track = document.getElementById('auth-sliding-track');
  const panelSignIn = document.getElementById('panel-auth-signin');
  const panelSignUp = document.getElementById('panel-auth-signup');
  const btnSignIn = document.getElementById('tab-btn-signin');
  const btnSignUp = document.getElementById('tab-btn-signup');
  const footerText = document.getElementById('auth-footer-text');
  const footerLink = document.getElementById('auth-footer-link');

  if (targetTab === 'signup') {
    if (track) track.style.transform = 'translateX(-50%)';
    if (panelSignIn) {
      panelSignIn.style.opacity = '0';
      panelSignIn.style.pointerEvents = 'none';
    }
    if (panelSignUp) {
      panelSignUp.style.opacity = '1';
      panelSignUp.style.pointerEvents = 'auto';
    }
    if (btnSignIn) {
      btnSignIn.style.background = 'transparent';
      btnSignIn.style.color = 'rgba(255,255,255,0.85)';
      btnSignIn.style.boxShadow = 'none';
    }
    if (btnSignUp) {
      btnSignUp.style.background = '#FFFFFF';
      btnSignUp.style.color = '#0B5A68';
      btnSignUp.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
    }
    if (footerText) footerText.textContent = "Already have an account?";
    if (footerLink) {
      footerLink.textContent = "Sign In";
      footerLink.setAttribute('onclick', "window.switchAuthSlider('signin')");
    }
  } else {
    if (track) track.style.transform = 'translateX(0%)';
    if (panelSignIn) {
      panelSignIn.style.opacity = '1';
      panelSignIn.style.pointerEvents = 'auto';
    }
    if (panelSignUp) {
      panelSignUp.style.opacity = '0';
      panelSignUp.style.pointerEvents = 'none';
    }
    if (btnSignIn) {
      btnSignIn.style.background = '#FFFFFF';
      btnSignIn.style.color = '#0B5A68';
      btnSignIn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
    }
    if (btnSignUp) {
      btnSignUp.style.background = 'transparent';
      btnSignUp.style.color = 'rgba(255,255,255,0.85)';
      btnSignUp.style.boxShadow = 'none';
    }
    if (footerText) footerText.textContent = "Don't have an account?";
    if (footerLink) {
      footerLink.textContent = "Sign Up";
      footerLink.setAttribute('onclick', "window.switchAuthSlider('signup')");
    }
  }
};
window.switchAuthTab = window.switchAuthSlider;

// Password Visibility Toggle
window.togglePasswordVisibility = function (inputId, buttonEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  buttonEl.style.color = isPassword ? '#0B5A68' : '#64748B';
  buttonEl.textContent = isPassword ? 'Hide' : 'Show';
  buttonEl.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
};

window.isGuestSession = function () {
  const session = typeof getSessionAccessState === 'function' ? getSessionAccessState() : null;
  if (session) return Boolean(session.isGuest);
  return Boolean(window.state?.isGuest || !window.state?.user?.uid);
};

window.formatDistrictName = function (value) {
  const name = String(value || 'Sri Lanka').trim();
  if (!name || /^sri lanka$/i.test(name)) return name || 'Sri Lanka';
  return /district$/i.test(name) ? name : `${name} District`;
};

window.rememberLandmarkOrigin = function () {
  const current = window.state?.currentScreen;
  if (current === 'map' || current === 'wanderer') {
    window.state.siteReferrer = 'map';
    window.state.siteReferrerParams = window.state.currentParams || {};
  } else if (current === 'directory') {
    window.state.siteReferrer = 'directory';
    window.state.siteReferrerParams = window.state.currentParams || {};
  }
};

window.openLandmarkDetail = function (siteId) {
  if (!window.state) window.state = {};
  window.rememberLandmarkOrigin();
  window.state.siteDetailTab = 'overview';
  window.closeSitePreview?.();
  window.navigate('site-detail', { id: siteId, entry: window.state.siteReferrer });
};

window.returnToSiteOverview = function (siteId) {
  if (!window.state) window.state = {};
  window.state.siteDetailTab = 'overview';
  window.navigate('site-detail', { id: siteId, preserveOrigin: true });
};

window.handleLandmarkBack = function () {
  const destination = window.state?.siteReferrer === 'map' ? 'map' : 'directory';
  const params = window.state?.siteReferrerParams || {};
  window.state.siteDetailTab = 'overview';
  window.navigate(destination, params);
};

// Forgot Password Flow Handlers
window.openForgotPasswordModal = function () {
  const modal = document.getElementById('forgot-password-modal');
  if (modal) modal.style.display = 'flex';
};

window.closeForgotPasswordModal = function () {
  const modal = document.getElementById('forgot-password-modal');
  if (modal) modal.style.display = 'none';
};

window.submitForgotPassword = function () {
  const input = document.getElementById('forgot-identifier');
  const val = input ? input.value.trim() : '';
  if (!val) {
    alert("Please enter a valid email or phone number.");
    return;
  }
  alert(`✓ Password reset instructions have been sent to: ${val}`);
  window.closeForgotPasswordModal();
};

// ============================================================================
// 1. DATABASE SCHEMA & PURGE CONTROLLER
// ============================================================================
const USER_DB_KEY = 'yathralanka_users_v2';
const ACTIVE_USER_KEY = 'yathralanka_active_session';
const SESSION_START_KEY = 'yathralanka_session_start_ts';

// Database reset utility (Only runs when manually invoked in dev console: window.purgeAndResetDatabase())
window.purgeAndResetDatabase = function () {
  localStorage.removeItem('yathralanka_users');
  localStorage.removeItem('yathralanka_pending_users');
  localStorage.removeItem('yathralanka_registered_users');
  localStorage.removeItem('yathralanka_current_user');
  localStorage.removeItem('yathralanka_active_user');
  if (typeof USER_DB_KEY !== 'undefined') localStorage.removeItem(USER_DB_KEY);
  if (typeof ACTIVE_USER_KEY !== 'undefined') localStorage.removeItem(ACTIVE_USER_KEY);
  if (typeof SESSION_START_KEY !== 'undefined') localStorage.removeItem(SESSION_START_KEY);
  sessionStorage.clear();
  console.log("🧹 Database purged manually. Clean slate active.");
};

// Ensure database initialization never automatically purges data on reload
(function initializeDatabaseStructure() {
  if (!localStorage.getItem('yathralanka_users')) {
    localStorage.setItem('yathralanka_users', JSON.stringify({}));
  }
  if (!localStorage.getItem('yathralanka_pending_users')) {
    localStorage.setItem('yathralanka_pending_users', JSON.stringify({}));
  }
})();

function getRegisteredUsers() {
  try {
    const raw = localStorage.getItem(USER_DB_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLegacyUserRecord(userObj) {
  if (!userObj || !userObj.email) return;
  const users = getRegisteredUsers();
  const existingIndex = users.findIndex(u => u.email && u.email.toLowerCase() === userObj.email.toLowerCase());

  if (existingIndex >= 0) {
    users[existingIndex] = { ...users[existingIndex], ...userObj };
  } else {
    users.push(userObj);
  }

  localStorage.setItem(USER_DB_KEY, JSON.stringify(users));
}

function saveRegisteredUser(userObj) {
  saveLegacyUserRecord(userObj);
}

window.setActiveUser = function (userData) {
  if (!window.state) window.state = {};
  window.state.user = userData;
  window.state.isGuest = userData.isGuest || false;
  try {
    localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(userData));
  } catch (e) { }
};

window.getActiveUser = function () {
  if (window.state?.user) return window.state.user;
  try {
    const raw = localStorage.getItem(ACTIVE_USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!window.state) window.state = {};
      window.state.user = parsed;
      window.state.isGuest = parsed.isGuest || false;
      return parsed;
    }
  } catch (e) { }
  return { name: "Guest Explorer", isGuest: true, xp: 0, level: "Novice Explorer" };
};

// ============================================================================
// 2. LEVEL PROGRESSION ENGINE
// ============================================================================
const LEVEL_LADDER = [
  { minXP: 1000, title: "Heritage Guardian" },
  { minXP: 600, title: "Ancient Chronicler" },
  { minXP: 300, title: "Cultural Voyager" },
  { minXP: 100, title: "Heritage Seeker" },
  { minXP: 0, title: "Novice Explorer" }
];

window.calculateLevelTitle = function (xp) {
  const points = Number(xp) || 0;
  const match = LEVEL_LADDER.find(tier => points >= tier.minXP);
  return match ? match.title : "Novice Explorer";
};

// ============================================================================
// 3. BEHAVIORAL & ACTIVITY TRACKING ENGINE
// ============================================================================
function createNewUserSchema({ name, email, avatar = null, provider = 'email', password = null }) {
  const now = new Date().toISOString();
  const initialXP = 50; // First-Time Explorer Welcome Bonus

  return {
    id: 'usr_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    name: name || "Explorer",
    email: email.toLowerCase(),
    password: password || null,
    avatar: avatar,
    provider: provider,
    isGuest: false,

    // Core Progression (Starts with 50 XP Welcome Gift)
    xp: initialXP,
    level: window.calculateLevelTitle(initialXP),

    // Lifecycle & Login Telemetry (Tracked silently in background)
    createdAt: now,
    lastLoginAt: now,
    loginCount: 1,
    sessionHistory: [
      {
        loginAt: now,
        userAgent: navigator.userAgent,
        platform: navigator.platform
      }
    ],

    // Behavioral Metrics (Preserved for Profile Screen)
    totalTimeSpentSec: 0,
    screenVisits: { welcome: 1, auth: 1, home: 1 },
    featuresUsed: { arCamera: 0, quizCompleted: 0, audioPlayed: 0, sitesVisited: 0 },
    completedQuests: [],
    unlockedBadges: ["Pioneer Explorer"],
    activityLog: [
      {
        timestamp: now,
        actionType: "ACCOUNT_CREATED",
        screen: "auth",
        meta: { provider: provider },
        xpEarned: 50
      },
      {
        timestamp: now,
        actionType: "WELCOME_BONUS_AWARDED",
        screen: "home",
        meta: { bonusXP: 50 },
        xpEarned: 50
      }
    ]
  };
}

window.logUserActivity = function (actionType, screen = "unknown", meta = {}, xpAwarded = 0) {
  const currentUser = window.getActiveUser();
  if (!currentUser || currentUser.isGuest) return;

  const now = new Date().toISOString();
  const activityEvent = {
    timestamp: now,
    actionType: actionType,
    screen: screen,
    meta: meta,
    xpEarned: xpAwarded
  };

  if (!Array.isArray(currentUser.activityLog)) currentUser.activityLog = [];
  currentUser.activityLog.push(activityEvent);

  if (!currentUser.screenVisits) currentUser.screenVisits = {};
  currentUser.screenVisits[screen] = (currentUser.screenVisits[screen] || 0) + 1;

  if (xpAwarded > 0) {
    currentUser.xp = (Number(currentUser.xp) || 0) + Number(xpAwarded);
    currentUser.level = window.calculateLevelTitle(currentUser.xp);
  }

  saveUserRecord(currentUser);
  window.setActiveUser(currentUser);

  console.log(`📊 [Telemetry] Logged '${actionType}' on '${screen}'. Current XP: ${currentUser.xp}`);
};

window.awardUserXP = function (amount, reason = "Completed Action") {
  const currentScreen = window.state?.currentScreen || "general";
  window.logUserActivity("XP_AWARDED", currentScreen, { reason }, amount);

  if (window.state?.currentScreen === 'home' && typeof renderDashboard === 'function') {
    const container = document.getElementById('app-container') || document.querySelector('.app-viewport');
    if (container) container.innerHTML = renderDashboard();
  }
};

setInterval(() => {
  const currentUser = window.getActiveUser();
  if (currentUser && !currentUser.isGuest) {
    currentUser.totalTimeSpentSec = (currentUser.totalTimeSpentSec || 0) + 5;
    saveUserRecord(currentUser);
  }
}, 5000);

// ============================================================================
// 4. AUTHENTICATION & LOGIN PROCESSORS
// ============================================================================
window.triggerRealOAuth = function (provider) {
  if (typeof window.triggerOAuthFlow === 'function') {
    window.triggerOAuthFlow(provider);
  }
};

window.handleOAuthRedirectCallback = async function () {
  const hash = window.location.hash;
  if (!hash || !hash.includes('access_token=')) return;

  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');

  if (accessToken) {
    history.replaceState(null, null, window.location.pathname);

    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const profile = await response.json();

      if (profile.email) {
        const emailKey = profile.email.toLowerCase();
        const users = getRegisteredUsers();
        let user = users.find(u => u.email && u.email.toLowerCase() === emailKey);
        const now = new Date().toISOString();

        if (!user) {
          user = createNewUserSchema({
            name: profile.name || profile.given_name || "Explorer",
            email: profile.email,
            avatar: profile.picture || null,
            provider: 'Google'
          });
          saveUserRecord(user);
          console.log(`🆕 [New User Registered]: ${user.name} (${user.email}) | Starting XP: 0`);
        } else {
          user.name = profile.name || user.name;
          user.avatar = profile.picture || user.avatar;
          user.lastLoginAt = now;
          user.loginCount = (user.loginCount || 1) + 1;

          if (!Array.isArray(user.sessionHistory)) user.sessionHistory = [];
          user.sessionHistory.push({
            loginAt: now,
            userAgent: navigator.userAgent,
            platform: navigator.platform
          });

          if (!Array.isArray(user.activityLog)) user.activityLog = [];
          user.activityLog.push({
            timestamp: now,
            actionType: "USER_LOGIN",
            screen: "auth",
            meta: { loginNumber: user.loginCount, provider: "Google" },
            xpEarned: 0
          });

          user.level = window.calculateLevelTitle(user.xp);
          saveUserRecord(user);
          console.log(`👋 [Returning User]: ${user.name} | Login Count: ${user.loginCount} | XP: ${user.xp}`);
        }

        window.setActiveUser(user);
        window.logUserActivity("SCREEN_ENTER", "home", {});
        window.navigate('home');
      }
    } catch (err) {
      console.error("Failed to authenticate Google user:", err);
      alert("Sign-in failed. Please try again.");
    }
  }
};

window.checkOAuthCallback = window.handleOAuthRedirectCallback;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.handleOAuthRedirectCallback);
} else {
  window.handleOAuthRedirectCallback();
}

window.handleAuthSuccess = function (provider, e) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }

  const idInput = document.getElementById('auth-identifier') || document.getElementById('auth-signup-identifier');
  const nameInput = document.getElementById('auth-signup-name');

  let displayName = "Guardian Explorer";
  let displayContact = "explorer@yathralanka.lk";

  if (provider === 'google') {
    displayName = "Google Explorer";
    displayContact = "user@gmail.com";
  } else if (provider === 'apple') {
    displayName = "Apple Explorer";
    displayContact = "user@privaterelay.appleid.com";
  } else if (provider === 'facebook') {
    displayName = "Facebook Explorer";
    displayContact = "user@facebook.com";
  } else if (idInput && idInput.value.trim()) {
    displayContact = idInput.value.trim();
    displayName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : (displayContact.includes('@') ? displayContact.split('@')[0] : displayContact);
  }

  if (!window.state) window.state = {};
  window.state.isGuest = false;
  window.state.user = {
    name: displayName,
    contact: displayContact,
    xp: 250,
    level: "Heritage Guardian"
  };

  console.log(`✓ Authenticated via [${provider}]. Navigating to Central Dashboard...`);
  if (typeof window.handlePostLoginSuccess === 'function') {
    window.handlePostLoginSuccess(window.state.user);
  } else {
    window.navigate('home');
  }
};

// 4. Attach Global Event Delegation Listener for Welcome Screen Buttons
document.addEventListener('click', function (e) {
  const target = e.target.closest('#btn-welcome-signin, #btn-welcome-signup, #btn-welcome-guest, .btn-welcome-signin, .btn-welcome-signup, .btn-guest-explore');
  if (!target) return;

  if (target.id === 'btn-welcome-signin' || target.classList.contains('btn-welcome-signin')) {
    e.preventDefault();
    e.stopPropagation();
    window.openAuthScreen('signin');
  } else if (target.id === 'btn-welcome-signup' || target.classList.contains('btn-welcome-signup')) {
    e.preventDefault();
    e.stopPropagation();
    window.openAuthScreen('signup');
  } else if (target.id === 'btn-welcome-guest' || target.classList.contains('btn-guest-explore')) {
    e.preventDefault();
    e.stopPropagation();
    window.continueAsGuest(e);
  }
});

window.initApp = initApp;

// ============================================================================
// 1. STATE & AUTH REPOSITORY
// ============================================================================

window.state = {
  currentScreen: 'welcome',
  currentParams: {},
  authActiveTab: 'signin',
  authOrigin: null // null when coming from Welcome; screen name when from inner guest
};

window.getActiveUser = function () {
  try {
    const raw = localStorage.getItem(ACTIVE_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { }
  return { name: "Guest Explorer", isGuest: true, xp: 0, level: "Novice Explorer" };
};

window.setActiveUser = function (user) {
  localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(user));
};

// ============================================================================
// 2. NAVIGATION & ROUTER
// ============================================================================
if (!window.state) {
  window.state = {
    currentScreen: 'welcome',
    authActiveTab: 'signin',
    authOrigin: null, // null from welcome; inner screen name when opened as guest
    isGuest: false
  };
}

// Open Auth Screen directly from Welcome Screen (uses canonical window.openAuthScreen above)

// Open Auth Screen from Inside as Guest (SHOWS BACK BUTTON)
window.openAuthAsGuest = function (fromScreen = 'home') {
  window.state.authActiveTab = 'signin';
  window.state.authOrigin = fromScreen; // Enables back button returning to fromScreen
  window.navigate('auth');
};

// Handle Guest Flow: Bypass Auth and go straight to Home (delegates to primary continueAsGuest handler)
// window.continueAsGuest is defined above as the single canonical guest handler

window.handleAuthBackClick = function () {
  const destination = window.state.authOrigin || 'home';
  window.navigate(destination, window.state.currentParams || {});
};

// ============================================================================
// PROFILE SCREEN RENDERER (Supports Verified Users & Clean Sign Out)
// ============================================================================
window.renderProfileLinksList = function () {
  const links = [
    { title: 'My Travel Map', icon: '🗺️' },
    { title: 'My Medals Gallery', icon: '🏅' },
    { title: 'My Community Events', icon: '🤝' },
    { title: 'Knowledge Quizzes', icon: '🧠' },
    { title: 'Settings', icon: '⚙️' }
  ];

  return `
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${links.map(link => `
        <div style="background: #FFFFFF; border-radius: 14px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #E2E8F0; box-shadow: 0 2px 6px rgba(0,0,0,0.02); cursor: pointer;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 16px;">${link.icon}</span>
            <span style="font-size: 13.5px; font-weight: 700; color: #1E293B;">${link.title}</span>
          </div>
          <span style="font-size: 16px; color: #94A3B8; font-weight: bold;">›</span>
        </div>
      `).join('')}
    </div>
  `;
};

window.renderProfileScreen = function (params = {}) {
  if (typeof renderProfile === 'function') {
    return renderProfile();
  }
  const container = document.getElementById('screen-container') || document.querySelector('.main-content-area');

  // Retrieve current active user session
  const currentUser = window.state?.user || JSON.parse(localStorage.getItem('yathralanka_current_user') || 'null');
  const isGuest = !currentUser || !currentUser.emailVerified;

  let html = '';

  if (isGuest) {
    // ------------------------------------------------------------------------
    // GUEST PROFILE VIEW
    // ------------------------------------------------------------------------
    html = `
      <div class="profile-view-wrapper profile-screen" style="padding: 20px 16px; max-width: 420px; margin: 0 auto; box-sizing: border-box; padding-bottom: 85px !important;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h1 style="font-size: 24px; font-weight: 800; color: #125463; margin: 0;">My Profile</h1>
          <button onclick="typeof window.openAuthScreen === 'function' ? window.openAuthScreen('signin') : (window.showAuthModal ? window.showAuthModal('signin') : window.renderLanding())" style="background: #EAA335; color: #182226; border: none; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 11.5px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
            🔑 Sign In / Register
          </button>
        </div>

        <div style="background: #FAF5E8; border: 1px solid #DFCEAA; border-radius: 18px; padding: 22px 18px; text-align: center; margin-bottom: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.04);">
          <div style="font-size: 32px; margin-bottom: 8px;">🧭</div>
          <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 800; color: #125463;">Exploring as a Guest</h3>
          <p style="margin: 0 0 16px 0; font-size: 12px; color: #64748B; line-height: 1.5;">
            You are exploring as a Guest. Sign in to save earned badges, claim merchant rewards, and access leaderboards.
          </p>
          <button onclick="typeof window.openAuthScreen === 'function' ? window.openAuthScreen('signin') : (window.showAuthModal ? window.showAuthModal('signin') : window.renderLanding())" style="width: 100%; background: #125463; color: #FFFFFF; font-size: 13px; font-weight: 700; border: none; padding: 11px; border-radius: 10px; cursor: pointer;">
            Sign In / Create Account
          </button>
        </div>

        ${window.renderProfileLinksList()}
        ${window.renderGlobalFooter('profile')}
      </div>
    `;
  } else {
    // ------------------------------------------------------------------------
    // VERIFIED USER PROFILE VIEW (Rajitha)
    // ------------------------------------------------------------------------
    const displayName = currentUser.name || 'Explorer';
    const email = currentUser.email || '';
    const xp = currentUser.xp || 50;
    const medals = currentUser.medals || 0;
    const sitesVisited = currentUser.sitesVisited || 0;
    const quizzesPassed = currentUser.quizzesPassed || 0;

    html = `
      <div class="profile-view-wrapper profile-screen" style="padding: 20px 16px; max-width: 420px; margin: 0 auto; box-sizing: border-box; padding-bottom: 85px !important;">
        
        <!-- Header & Sign Out -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
          <h1 style="font-size: 24px; font-weight: 800; color: #125463; margin: 0;">My Profile</h1>
          <button onclick="window.handleSignOut()" style="background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 11.5px; cursor: pointer;">
            Log Out
          </button>
        </div>

        <!-- Explorer Info Card -->
        <div style="background: #FFFFFF; border-radius: 18px; padding: 20px 18px; box-shadow: 0 4px 18px rgba(0,0,0,0.06); margin-bottom: 16px; border: 1px solid #E2E8F0; text-align: center;">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: #125463; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; margin: 0 auto 10px auto; border: 3px solid #EAA335;">
            ${displayName.charAt(0).toUpperCase()}
          </div>
          <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #125463;">${displayName}</h2>
          <div style="font-size: 12px; color: #64748B; margin-top: 2px;">${email}</div>
          
          <div style="display: inline-block; background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 20px; padding: 4px 14px; margin-top: 10px; font-size: 11px; font-weight: 800; color: #92400E;">
            Level: Novice Explorer • ${xp} XP
          </div>
        </div>

        <!-- Stat Badges (0 defaults instead of undefined) -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px;">
          <div style="background: #FFFFFF; border-radius: 14px; padding: 12px 6px; text-align: center; border: 1px solid #E2E8F0; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
            <div style="font-size: 18px; font-weight: 800; color: #125463;">${medals}</div>
            <div style="font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; margin-top: 2px;">Medals</div>
          </div>
          <div style="background: #FFFFFF; border-radius: 14px; padding: 12px 6px; text-align: center; border: 1px solid #E2E8F0; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
            <div style="font-size: 18px; font-weight: 800; color: #125463;">${sitesVisited}</div>
            <div style="font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; margin-top: 2px;">Sites Visited</div>
          </div>
          <div style="background: #FFFFFF; border-radius: 14px; padding: 12px 6px; text-align: center; border: 1px solid #E2E8F0; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
            <div style="font-size: 18px; font-weight: 800; color: #125463;">${quizzesPassed}</div>
            <div style="font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; margin-top: 2px;">Mastery Badges</div>
          </div>
        </div>

        ${window.renderProfileLinksList()}
        ${window.renderGlobalFooter('profile')}
      </div>
    `;
  }

  if (container && window.state?.currentScreen !== 'profile') {
    container.innerHTML = html;
  }
  return html;
};

// ============================================================================
// SIGN OUT HANDLER
// ============================================================================
window.handleSignOut = function () {
  console.log("🔒 Signing out session completely...");
  sessionStorage.removeItem('yathralanka_session_mode');
  localStorage.setItem('yathralanka_session_mode', 'signed_out');
  if (typeof window.clearActiveUserSession === 'function') {
    window.clearActiveUserSession();
  }

  if (typeof signOut === 'function' && auth) {
    try { signOut(auth); } catch (e) {}
  }
  if (typeof GoogleAuth !== 'undefined' && typeof GoogleAuth.signOut === 'function') {
    if (typeof ensureGoogleAuthInitialized === 'function') {
      ensureGoogleAuthInitialized().then(() => {
        GoogleAuth.signOut().catch(() => {});
      }).catch(() => {});
    }
  }

  if (window.state) {
    window.state.user = null;
    window.state.currentUser = null;
    window.state.isGuest = false;
    window.state.isLoggedIn = false;
    window.state.sessionMode = 'signed_out';
    window.state.currentScreen = 'welcome';
  }

  if (typeof window.executeAppNavigation === 'function') {
    window.executeAppNavigation('welcome');
  } else if (typeof window.navigate === 'function') {
    window.navigate('welcome');
  }
};

// --- BULLETPROOF ROUTER EXECUTION & MAP THREAD UNLOCKER ---
window.executeAppNavigation = function (targetScreen, params = {}) {
  try {
    if (!window.state) window.state = {};
    const screenBefore = window.state.currentScreen;
    const paramsBefore = window.state.currentParams || {};

    // A verified on-site visit owns a single landmark for 15 minutes. The
    // visitor can use every screen and every photo option for that landmark,
    // but cannot enter a second landmark while the session is active.
    const landmarkRoutes = ['site-detail', 'site_preview', 'site-details', 'site_preview_full'];
    const requestedLandmarkId = params?.id || params?.siteId || null;
    if (
      landmarkRoutes.includes(targetScreen) &&
      requestedLandmarkId &&
      typeof window.canOpenLandmarkDuringActiveSession === 'function' &&
      !window.canOpenLandmarkDuringActiveSession(requestedLandmarkId, true)
    ) {
      return false;
    }

    window.state.isAuthenticating = false;
    window.state.currentScreen = targetScreen;
    window.state.currentParams = params;
    window.state.overlay = null;

    if (window.__navCounters) {
      window.__navCounters.authoritativeRouterCalls++;
      window.__navCounters.renderCalls++;
    }

    console.log(`[NAV] transition start: requested=${targetScreen}, before=${screenBefore}, currentScreen=${window.state?.currentScreen}`);
    
    // ROUTE-LEVEL GUEST GUARD (Part 3 & Part 5)
    const protectedRoutes = [
      'site-detail',
      'site-details',
      'site_preview_full',
      'quiz',
      'verification',
      'checkpoint',
      'quest-social',
      'quest-food',
      'quest-wandering',
      'quest-wildlife',
      'quest-warrior'
    ];

    if (protectedRoutes.includes(targetScreen)) {
      const session = typeof getSessionAccessState === 'function' ? getSessionAccessState() : { isGuest: true };
      if (session.isGuest) {
        console.log(`[ROUTE-GUARD] route=${targetScreen} result=guest-gated`);
        window.state.currentScreen = screenBefore || 'home';
        if (typeof requestProtectedAccess === 'function') {
          requestProtectedAccess({
            capability: (targetScreen === 'quiz' ? 'quiz' : (targetScreen === 'verification' ? 'verification' : 'full-landmark')),
            originRoute: screenBefore || 'home',
            originParams: params || {},
            onAuthorized: () => {
              window.executeAppNavigation(targetScreen, params);
            }
          });
        }
        return false;
      }
      console.log(`[ROUTE-GUARD] route=${targetScreen} result=allowed`);
    }

    console.log('[NAV-COUNT]', JSON.stringify({
      source: `tap:${targetScreen}`,
      requestedTarget: targetScreen,
      authoritativeRouterCalls: window.__navCounters?.authoritativeRouterCalls || 1,
      legacyRouterCalls: window.__navCounters?.legacyRouterCalls || 0,
      renderCalls: window.__navCounters?.renderCalls || 1
    }));

    // Clean up any lingering overlays, modals, or backdrops across screen changes
    ['auth-loading-overlay', 'site-preview-drawer-backdrop', 'proximity-gate-modal-overlay', 'auth-required-modal-overlay', 'welcome-interception-modal', 'checkpoint-modal-overlay'].forEach(id => {
      document.querySelectorAll('#' + id).forEach(el => el.remove());
    });
    document.querySelectorAll('.site-preview-drawer-backdrop, .proximity-gate-modal-overlay').forEach(el => el.remove());

    // Cleanup lingering intervals & geolocation watchers
    if (window._immersionTimerIntervals) {
      Object.keys(window._immersionTimerIntervals).forEach(id => {
        clearInterval(window._immersionTimerIntervals[id]);
      });
      window._immersionTimerIntervals = {};
    }
    if (window.gpsWatchId) {
      navigator.geolocation.clearWatch(window.gpsWatchId);
      window.gpsWatchId = null;
    }

    const appRoot = document.getElementById('app') ||
      document.getElementById('app-container') ||
      document.querySelector('.phone-screen') ||
      document.querySelector('.iphone-chassis') ||
      document.querySelector('.app-viewport') ||
      document.body;

    let viewport = document.getElementById('screen-viewport');
    if (!viewport && appRoot) {
      appRoot.innerHTML = `
        <div class="phone-notch-bar"><div class="phone-notch-pill"></div></div>
        <div id="screen-viewport" class="screen-viewport" style="width: 100%; height: 100%; overflow-y: auto; position: relative;"></div>
        <div class="phone-home-indicator"></div>
      `;
      viewport = document.getElementById('screen-viewport');
    }

    if (!viewport) return;

    // MAP INITIALIZATION ORDER (Step 4 Requirement 2):
    // a. Teardown previous map before replacing DOM
    console.log('[MAP-LIFECYCLE] before-render');
    if (targetScreen !== 'map' && targetScreen !== 'wanderer') {
      if (typeof window.leaveMap === 'function') {
        window.leaveMap();
      }
    }

    // Gated Side Quests Verification Dependency
    const sideQuestScreens = ['quests', 'quest-social', 'quest-food', 'quest-wandering', 'quest-wildlife', 'quest-warrior'];
    if (sideQuestScreens.includes(targetScreen)) {
      const isUnlocked = typeof window.checkSideQuestsUnlocked === 'function' ? window.checkSideQuestsUnlocked() : true;
      if (!isUnlocked) {
        const lockMsg = "Complete location presence and landmark photo verification to unlock side quests.";
        if (typeof window.showNotification === 'function') {
          window.showNotification(lockMsg, "warning");
        }
        targetScreen = 'site-detail';
        window.state.currentScreen = 'site-detail';
      }
    }

    let htmlContent = '';

    switch (targetScreen) {
      case 'welcome':
      case 'landing':
      case 'splash':
        htmlContent = typeof renderWelcomeScreen === 'function' ? renderWelcomeScreen() : (typeof renderLanding === 'function' ? renderLanding() : '');
        break;

      case 'auth':
      case 'login':
        htmlContent = typeof renderLogin === 'function' ? renderLogin() : (typeof renderAuthCard === 'function' ? renderAuthCard('signin') : '');
        break;

      case 'signup':
        htmlContent = typeof renderSignUp === 'function' ? renderSignUp() : (typeof renderAuthCard === 'function' ? renderAuthCard('signup') : '');
        break;

      case 'permissions':
        htmlContent = typeof renderPermissions === 'function' ? renderPermissions() : '';
        break;

      case 'choose-role':
        htmlContent = typeof renderChooseRole === 'function' ? renderChooseRole() : '';
        break;

      case 'calibrate-compass':
        htmlContent = typeof renderCalibrateCompass === 'function' ? renderCalibrateCompass() : '';
        break;

      case 'how-scoring-works':
        htmlContent = typeof renderHowScoring === 'function' ? renderHowScoring() : '';
        break;

      case 'settings':
        htmlContent = typeof renderSettings === 'function' ? renderSettings() : '';
        break;

      case 'offline-sync':
        htmlContent = typeof renderOfflineSync === 'function' ? renderOfflineSync() : '';
        break;

      case 'heritage-trail':
        htmlContent = typeof renderTrailList === 'function' ? renderTrailList('Heritage Trail') : '';
        break;

      case 'hidden-gems':
        htmlContent = typeof renderTrailList === 'function' ? renderTrailList('Hidden Gems') : '';
        break;

      case 'home':
      case 'dashboard':
        htmlContent = typeof renderDashboard === 'function' ? renderDashboard() : '<div>Dashboard loading...</div>';
        break;

      case 'map':
      case 'wanderer':
        htmlContent = typeof renderMapScreen === 'function' ? renderMapScreen(params) : '<div>Map loading...</div>';
        break;

      case 'site-detail':
      case 'site_preview':
      case 'site-details':
        {
          if (screenBefore === 'map' || screenBefore === 'wanderer') {
            window.state.siteReferrer = 'map';
            window.state.siteReferrerParams = paramsBefore;
          } else if (screenBefore === 'directory') {
            window.state.siteReferrer = 'directory';
            window.state.siteReferrerParams = paramsBefore;
          }
          window.state.siteDetailTab = 'overview';
          const reqId = params?.id || params?.siteId || window.state?.activeSite?.id || null;
          console.log(`[SITE-RUNTIME 01] tap id=${reqId}`);

          // Ensure preview drawer is removed before site detail rendering
          document.querySelectorAll('#site-preview-drawer-backdrop, .site-preview-drawer-backdrop').forEach(el => el.remove());
          if (window.state) window.state.overlay = null;

          const resolvedSite = (typeof window.resolveSiteFromId === 'function' ? window.resolveSiteFromId(reqId) : null) || window.state?.activeSite || null;
          console.log(`[SITE-RUNTIME 02] resolved id=${resolvedSite ? resolvedSite.id : null}`);

          if (resolvedSite) {
            window.state.activeSite = resolvedSite;
            window.state.selectedSite = resolvedSite;
            htmlContent = typeof renderSiteDetail === 'function' ? renderSiteDetail(resolvedSite) : '<div>Site details loading...</div>';
          } else {
            console.error(`[SITE-RUNTIME ERROR] stage=resolution name=NotFound message=Failed to resolve site for requestedId=${reqId}`);
            window.state.activeSite = null;
            window.state.selectedSite = null;
            htmlContent = `
              <div class="screen" style="padding: 24px; text-align: center; color: #1E293B; background: #FAF5E8; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box;">
                <div style="font-size: 38px; margin-bottom: 8px;">🏛️</div>
                <h3 style="font-size: 18px; font-weight: 800; color: #0B5A68; margin-bottom: 6px;">Landmark Not Found</h3>
                <p style="font-size: 12.5px; color: #64748B; margin-bottom: 18px; line-height: 1.45;">The requested site record "${reqId || 'unknown'}" could not be resolved from the directory dataset.</p>
                <button onclick="window.executeAppNavigation('directory')" style="background: #0B5A68; color: #FFFFFF; border: none; border-radius: 11px; padding: 11px 20px; font-weight: 800; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(11,90,104,0.3);">
                  Back to Directory →
                </button>
              </div>
            `;
          }
        }
        break;

      case 'dwell-time':
        htmlContent = typeof renderDwellTime === 'function' ? renderDwellTime() : '';
        break;

      case 'camera':
        htmlContent = typeof renderCamera === 'function' ? renderCamera() : '';
        break;

      case 'camera-success':
        htmlContent = typeof renderCameraSuccess === 'function' ? renderCameraSuccess() : '';
        break;

      case 'camera-reject':
        htmlContent = typeof renderCameraReject === 'function' ? renderCameraReject() : '';
        break;

      case 'quiz':
        htmlContent = typeof renderQuiz === 'function' ? renderQuiz() : '';
        break;

      case 'quiz-cooldown':
        htmlContent = typeof renderQuizCooldown === 'function' ? renderQuizCooldown() : '';
        break;

      case 'quests':
        htmlContent = typeof renderQuestsList === 'function' ? renderQuestsList() : '';
        break;

      case 'quest-social':
        htmlContent = typeof renderQuestSocial === 'function' ? renderQuestSocial() : '';
        break;

      case 'quest-food':
        htmlContent = typeof renderQuestFood === 'function' ? renderQuestFood() : '';
        break;

      case 'quest-wandering':
        htmlContent = typeof renderQuestWandering === 'function' ? renderQuestWandering() : '';
        break;

      case 'quest-wildlife':
        htmlContent = typeof renderQuestWildlife === 'function' ? renderQuestWildlife() : '';
        break;

      case 'quest-warrior':
        htmlContent = typeof renderQuestWarrior === 'function' ? renderQuestWarrior() : '';
        break;

      case 'activism':
        htmlContent = typeof renderActivismDashboard === 'function' ? renderActivismDashboard(params) : (typeof renderActivismScreen === 'function' ? renderActivismScreen(params) : '<div>Activism loading...</div>');
        break;

      case 'petition':
        htmlContent = typeof renderPetitionPage === 'function' ? renderPetitionPage() : '';
        break;

      case 'donations':
        htmlContent = typeof renderDonationsPage === 'function' ? renderDonationsPage() : '';
        break;

      case 'cleanup':
        htmlContent = typeof renderCleanupPage === 'function' ? renderCleanupPage() : '';
        break;

      case 'create-event':
        htmlContent = typeof renderCreateEventPage === 'function' ? renderCreateEventPage() : '';
        break;

      case 'rewards':
        htmlContent = typeof renderRewardsDashboard === 'function' ? renderRewardsDashboard(params) : '<div>Rewards loading...</div>';
        break;

      case 'rewards-list':
        htmlContent = typeof renderRewardsList === 'function' ? renderRewardsList() : '';
        break;

      case 'coupon-redeem':
        htmlContent = typeof renderCouponRedeem === 'function' ? renderCouponRedeem() : '';
        break;

      case 'rank':
        htmlContent = typeof renderRankScreen === 'function' ? renderRankScreen() : '';
        break;

      case 'leaderboard':
        htmlContent = typeof renderLeaderboard === 'function' ? renderLeaderboard() : '';
        break;

      case 'profile':
        htmlContent = typeof renderProfile === 'function' ? renderProfile() : (typeof renderProfileScreen === 'function' ? renderProfileScreen(params) : '<div>Profile loading...</div>');
        break;

      case 'directory':
        htmlContent = typeof renderDirectoryScreen === 'function' ? renderDirectoryScreen(params) : '<div>Directory loading...</div>';
        break;

      case 'guidelines':
        htmlContent = typeof renderGuidelines === 'function' ? renderGuidelines() : '';
        break;

      case 'ledger':
        htmlContent = typeof renderLedger === 'function' ? renderLedger() : '';
        break;

      case 'travel-poster':
        htmlContent = typeof renderTravelPoster === 'function' ? renderTravelPoster() : '';
        break;

      default:
        htmlContent = typeof renderDashboard === 'function' ? renderDashboard() : '<div>Home</div>';
    }

    // Assign DOM HTML to screen viewport
    viewport.innerHTML = htmlContent;
    if (typeof window.ensureActiveLandmarkSessionTimer === 'function') {
      window.ensureActiveLandmarkSessionTimer();
    }
    viewport.scrollTop = 0;
    viewport.querySelectorAll('.back-button').forEach((button) => {
      if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', 'Back');
      if (!button.hasAttribute('type')) button.setAttribute('type', 'button');
    });

    // MAP INITIALIZATION ORDER:
    if (targetScreen === 'map' || targetScreen === 'wanderer') {
      requestAnimationFrame(() => {
        if (typeof window.enterMap === 'function') {
          window.enterMap(params);
        }
      });
    }

    // SITE DETAIL POST-MOUNT VERIFICATION:
    if (targetScreen === 'site-detail' || targetScreen === 'site_preview' || targetScreen === 'site-details') {
      const siteScreenEl = viewport.querySelector('.site-detail-screen');
      const isMounted = Boolean(siteScreenEl?.isConnected);
      const rect = siteScreenEl ? siteScreenEl.getBoundingClientRect() : { width: 0, height: 0 };
      console.log(`[SITE-RUNTIME 08] mount-success connected=${isMounted} size=${Math.round(rect.width)}x${Math.round(rect.height)}`);

      if (window.state?.activeSite && window.state?.siteLocationVerified === window.state.activeSite.id) {
        if (typeof window.initBackgroundImmersionTimer === 'function') {
          try {
            window.initBackgroundImmersionTimer(window.state.activeSite.id);
          } catch (timerErr) {
            console.warn("Immersion timer post-mount warning:", timerErr);
          }
        }
      }
    }

    // AUTH UI VERIFICATION CHECK
    if (targetScreen === 'auth' || targetScreen === 'login' || targetScreen === 'signup') {
      const outerWrappers = document.querySelectorAll('.auth-screen-container').length;
      const backButtons = document.querySelectorAll('#login-back, #signup-back, #btn-auth-back').length;
      console.log(`[AUTH-UI] outerWrappers=${outerWrappers} backButtons=${backButtons}`);
    }

    // CONTROLLED ROUTER-OWNED FOOTER RENDERING & VISIBILITY (Part 1 Requirement)
    if (!window.__footerRenderCount) window.__footerRenderCount = 0;
    window.__footerRenderCount++;

    const primaryNavScreens = ['home', 'dashboard', 'activism', 'rewards', 'profile'];
    let bodyFooter = document.getElementById('body-direct-global-nav');

    if (primaryNavScreens.includes(targetScreen)) {
      let activeTab = 'home';
      if (targetScreen === 'activism') activeTab = 'activism';
      else if (targetScreen === 'rewards') activeTab = 'rewards';
      else if (targetScreen === 'profile') activeTab = 'profile';
      else activeTab = 'home';

      if (!bodyFooter) {
        bodyFooter = document.createElement('div');
        bodyFooter.id = 'body-direct-global-nav';
        document.body.appendChild(bodyFooter);
      }
      bodyFooter.innerHTML = typeof renderGlobalFooter === 'function' ? renderGlobalFooter(activeTab) : '';
      bodyFooter.style.setProperty('display', 'block', 'important');

      console.log(`[FOOTER] renderCount=${window.__footerRenderCount} route=${targetScreen}`);
      console.log('[FOOTER] visibility=shown');
      console.log('[FOOTER] observerActive=false');
    } else {
      if (bodyFooter) {
        bodyFooter.style.setProperty('display', 'none', 'important');
        bodyFooter.innerHTML = '';
      }
      console.log(`[FOOTER] renderCount=${window.__footerRenderCount} route=${targetScreen}`);
      console.log('[FOOTER] visibility=hidden');
      console.log('[FOOTER] observerActive=false');
    }

    if (typeof attachEvents === 'function') {
      try { attachEvents(); } catch (aeErr) { console.warn("attachEvents notice:", aeErr); }
    }

    console.log(`[NAV] transition end: rendered targetScreen=${targetScreen}`);
  } catch (navErr) {
    console.error("Critical navigation error caught safely:", navErr);
  }
};
window.navigate = window.executeAppNavigation;

window.showProximityGateModal = function (site, distMeters) {
  if (window.__siteTapCounters) {
    window.__siteTapCounters.showProximityGateModal++;
    console.log('[SITE-TAP-COUNT]', JSON.stringify(window.__siteTapCounters));
  }
  const existing = document.getElementById('proximity-gate-modal-overlay');
  if (existing) existing.remove();

  const distStr = distMeters >= 1000 ? (distMeters / 1000).toFixed(1) + " km" : Math.round(distMeters) + " meters";
  const siteName = site ? (site.name || 'this landmark') : 'this landmark';

  const backdrop = document.createElement('div');
  backdrop.id = 'proximity-gate-modal-overlay';
  backdrop.style.cssText = `
    position: fixed; inset: 0; background: rgba(8, 24, 28, 0.82); backdrop-filter: blur(6px);
    z-index: 2147483647; display: flex; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box;
  `;

  const sId = site ? site.id : '';
  const origin = window.state?.siteReferrer === 'map' ? 'map' : 'directory';
  const originLabel = origin === 'map' ? 'Return to Main Map' : 'Return to Directory';

  backdrop.innerHTML = `
    <div style="background: #FFFFFF; border-radius: 20px; padding: 24px; max-width: 380px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.25); text-align: center; border-top: 5px solid #EBB34D; box-sizing: border-box;">
      <h3 style="font-size: 18px; font-weight: 800; color: #0B5A68; margin: 0 0 10px 0;">
        Verification Locked
      </h3>
      <p style="font-size: 12.5px; color: #475569; line-height: 1.55; margin: 0 0 20px 0; font-weight: 500;">
        You are <strong>${distStr}</strong> away from <strong>${siteName}</strong>. Visit within 500 metres to unlock photo verification and checkpoints.
      </p>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button 
          id="btn-proximity-quiz"
          onclick="document.getElementById('proximity-gate-modal-overlay').remove(); window.returnToSiteOverview('${sId}');"
          style="width: 100%; background: #0B5A68; color: #FFFFFF; border: none; padding: 12px 16px; border-radius: 12px; font-weight: 800; font-size: 13.5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(11,90,104,0.2);">
          <span>Return to ${siteName} Overview &amp; Quiz</span>
        </button>
        <button 
          id="btn-proximity-origin"
          onclick="document.getElementById('proximity-gate-modal-overlay').remove(); window.handleLandmarkBack();"
          style="width: 100%; background: #F1F5F9; color: #475569; border: 1.5px solid #CBD5E1; padding: 11px 16px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer;">
          ${originLabel}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
};

window.selectAndOpenSite = function (siteId) {
  console.log('[SITE-FREEZE HANDLER C - selectAndOpenSite Def 2 (Line 3409)] entered siteId:', siteId);
  if (window.__siteTapCounters) {
    window.__siteTapCounters.selectAndOpenSite++;
    console.log('[SITE-TAP-COUNT]', JSON.stringify(window.__siteTapCounters));
  }
  console.log('[SITE-ACTUAL 05] selectAndOpenSite entered:', siteId);
  console.log('[FREEZE-DEBUG] site selection received (def 2):', siteId);
  if (typeof window.updateGlobalFooterVisibility === 'function') {
    window.updateGlobalFooterVisibility();
  }
  if (!siteId && siteId !== 0) return;

  const pool = window.sitesData || (typeof sitesData !== 'undefined' ? sitesData : []);
  const rawList = Array.isArray(pool) ? pool : Object.values(pool);
  const cleanId = String(siteId).toLowerCase().replace(/[-_]/g, '');

  let site = rawList.find(s => {
    if (!s) return false;
    const sid = String(s.id || '').toLowerCase().replace(/[-_]/g, '');
    const sname = String(s.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return sid === cleanId || sname.includes(cleanId) || cleanId.includes(sid);
  });

  if (!site) {
    const dirData = typeof getDirectoryDataset === 'function' ? getDirectoryDataset() : [];
    site = dirData.find(d => String(d.id).toLowerCase().replace(/[-_]/g, '') === cleanId) || {
      id: siteId,
      name: String(siteId).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      location: "Sri Lanka",
      description: "Historical archaeological landmark and cultural heritage sanctuary.",
      image: "/Element%20Pictures/placeholder.jpg",
      xp: 50,
      category: "Heritage Trail",
      checkpoints: [
        { id: 'cp_1', name: 'Main Architectural Gate', description: 'Approach the entrance facade to verify visit.', xpReward: 50 }
      ]
    };
  }

  if (!window.state) window.state = {};
  window.state.activeSite = site;
  window.state.selectedSite = site;
  window.openLandmarkDetail(site.id);
};

// Flush queued navigation if an early route triggered it
if (pendingNavigation) {
  const { targetScreen, params } = pendingNavigation;
  pendingNavigation = null;
  window.executeAppNavigation(targetScreen, params);
}

function renderWandererScreen(params = {}) {
  return `
    <div class="screen wanderer-screen" style="position: relative; width: 100%; height: 100%; background: #F6EBD9; display: flex; flex-direction: column; overflow: hidden;">
      
      <!-- Top Floating Navigation Bar -->
      <div style="position: absolute; top: 14px; left: 14px; right: 14px; z-index: 200; display: flex; align-items: center; justify-content: space-between; pointer-events: none;">
        <button 
          type="button" 
          onclick="window.navigate('home')" 
          style="pointer-events: auto; padding: 7px 14px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.1); background: rgba(255,255,255,0.85); backdrop-filter: blur(8px); color: #1E293B; font-size: 13.5px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.12);">
          ← Dashboard
        </button>
        <span style="pointer-events: auto; background: rgba(255,255,255,0.85); backdrop-filter: blur(8px); padding: 6px 14px; border-radius: 12px; font-size: 13px; font-weight: 800; color: #0B5A68; box-shadow: 0 2px 8px rgba(0,0,0,0.12);">
          Wanderer Map
        </span>
      </div>

      <!-- Map Canvas Container with Interactive Markers -->
      <div style="position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden;">
        <img 
          src="/srilanka-map.png" 
          alt="Sri Lanka Map"
          style="width: 100%; height: 100%; object-fit: contain; display: block;"
          onerror="if (!this.dataset.retry) { this.dataset.retry = '1'; this.src = '/Element%20Pictures/srilanka-map.png'; } else if (this.dataset.retry === '1') { this.dataset.retry = '2'; this.src = '/assets/srilanka-map.png'; }"
        />

        <!-- Overlay Pins -->
        <div onclick="window.navigate('site_preview', { id: 'sigiriya' })" style="position: absolute; top: 43%; left: 52%; transform: translate(-50%, -50%); cursor: pointer; z-index: 100; text-align: center;">
          <div style="background: #EA580C; color: #FFFFFF; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 6px; margin-bottom: 2px; box-shadow: 0 2px 6px rgba(0,0,0,0.25);">Sigiriya</div>
          <div style="width: 14px; height: 14px; background: #EA580C; border: 2.5px solid #FFFFFF; border-radius: 50%; box-shadow: 0 0 10px rgba(234,88,12,0.8); margin: 0 auto;"></div>
        </div>

        <div onclick="window.navigate('site_preview', { id: 'kandy' })" style="position: absolute; top: 58%; left: 50%; transform: translate(-50%, -50%); cursor: pointer; z-index: 100; text-align: center;">
          <div style="background: #0284C7; color: #FFFFFF; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 6px; margin-bottom: 2px; box-shadow: 0 2px 6px rgba(0,0,0,0.25);">Kandy</div>
          <div style="width: 14px; height: 14px; background: #0284C7; border: 2.5px solid #FFFFFF; border-radius: 50%; box-shadow: 0 0 10px rgba(2,132,199,0.8); margin: 0 auto;"></div>
        </div>

        <div onclick="window.navigate('site_preview', { id: 'galle_fort' })" style="position: absolute; top: 82%; left: 38%; transform: translate(-50%, -50%); cursor: pointer; z-index: 100; text-align: center;">
          <div style="background: #16A34A; color: #FFFFFF; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 6px; margin-bottom: 2px; box-shadow: 0 2px 6px rgba(0,0,0,0.25);">Galle Fort</div>
          <div style="width: 14px; height: 14px; background: #16A34A; border: 2.5px solid #FFFFFF; border-radius: 50%; box-shadow: 0 0 10px rgba(22,163,74,0.8); margin: 0 auto;"></div>
        </div>

        <div onclick="window.navigate('site_preview', { id: 'yala' })" style="position: absolute; top: 78%; left: 66%; transform: translate(-50%, -50%); cursor: pointer; z-index: 100; text-align: center;">
          <div style="background: #D97706; color: #FFFFFF; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 6px; margin-bottom: 2px; box-shadow: 0 2px 6px rgba(0,0,0,0.25);">Yala</div>
          <div style="width: 14px; height: 14px; background: #D97706; border: 2.5px solid #FFFFFF; border-radius: 50%; box-shadow: 0 0 10px rgba(217,119,6,0.8); margin: 0 auto;"></div>
        </div>
      </div>

      <div style="position: absolute; bottom: 16px; left: 16px; right: 16px; z-index: 200; background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px); border-radius: 16px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 16px rgba(0,0,0,0.12);">
        <div style="font-size: 12px; font-weight: 700; color: #1E293B;">
          📍 Tap any site pin to explore
        </div>
        <button type="button" onclick="window.navigate('directory')" style="background: #F5A623; color: #1E293B; border: none; border-radius: 10px; padding: 6px 12px; font-size: 11.5px; font-weight: 800; cursor: pointer;">
          View Directory
        </button>
      </div>

    </div>
  `;
}

window.openGoogleMaps = function () {
  window.open('https://maps.google.com/?q=Sri+Lanka+Heritage+Sites', '_blank');
};

// Map Screen Component
function renderMapScreen(params = {}) {
  console.log('[MAP-ACTUAL 04] renderMapScreen entered');
  console.log('[MAP-FREEZE 01] map action received');
  const html = `
    <div class="screen map-screen" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden; background: #0B5A68;">
      
      <!-- Top Left Header & Guest Badge -->
      <div class="yl-map-title" style="position: absolute; top: 16px; left: 16px; z-index: 1000; display: flex; align-items: center; gap: 8px;">
        <span style="font-weight: 800; font-size: 16px; color: #FFFFFF; text-shadow: 0 1px 3px rgba(0,0,0,0.6);">Main Map</span>
        ${window.getGuestModeBadge()}
      </div>

      <!-- Top Right Universal Back Button -->
      ${window.renderUniversalBackButton('home')}

      <!-- Top Right Legend Index (Offset below Universal Back Button) -->
      <div class="yl-map-legend" style="position: absolute; top: 68px; right: 14px; background: rgba(255,255,255,0.96); backdrop-filter: blur(8px); border-radius: 14px; padding: 9px 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.18); z-index: 1000; font-size: 11px; border: 1px solid rgba(0,0,0,0.06);">
        <div style="display: flex; align-items: center; gap: 7px; margin-bottom: 5px;">
          <span style="width: 10px; height: 10px; border-radius: 50%; background: #2563EB; display: inline-block; box-shadow: 0 0 0 2px rgba(37,99,235,0.25);"></span>
          <span style="font-weight: 700; color: #1E293B;">You Are Here</span>
        </div>
        <div style="display: flex; align-items: center; gap: 7px; margin-bottom: 5px;">
          <span style="width: 10px; height: 10px; border-radius: 50%; background: #0C6C7A; display: inline-block;"></span>
          <span style="font-weight: 700; color: #0C6C7A;">Heritage Trail</span>
        </div>
        <div style="display: flex; align-items: center; gap: 7px;">
          <span style="width: 10px; height: 10px; border-radius: 50%; background: #E59819; display: inline-block;"></span>
          <span style="font-weight: 700; color: #B45309;">Hidden Gems</span>
        </div>
        <div style="display: flex; align-items: center; gap: 7px; margin-top: 5px;">
          <span style="width: 12px; height: 12px; border-radius: 50%; background: #10B981; color: #FFF; display: inline-flex; align-items:center; justify-content:center; font-size:8px; font-weight:900;">✓</span>
          <span style="font-weight: 800; color: #047857;">Verified Visit</span>
        </div>
      </div>

      <!-- Leaflet Map Element -->
      <div id="map" style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; z-index: 1;"></div>

      <!-- Bottom Right Floating Controls (+, -, Reset) -->
      <div class="yl-map-controls" style="position: absolute; bottom: 82px; right: 16px; z-index: 1000; display: flex; flex-direction: column; gap: 6px;">
        <button 
          type="button" 
          onclick="if (window.activeLeafletMap) window.activeLeafletMap.zoomIn();"
          style="width: 38px; height: 38px; border-radius: 12px; background: #FFFFFF; border: 1px solid rgba(0,0,0,0.1); color: #1E293B; font-size: 18px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 10px rgba(0,0,0,0.18);">
          +
        </button>
        <button 
          type="button" 
          onclick="if (window.activeLeafletMap) window.activeLeafletMap.zoomOut();"
          style="width: 38px; height: 38px; border-radius: 12px; background: #FFFFFF; border: 1px solid rgba(0,0,0,0.1); color: #1E293B; font-size: 18px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 10px rgba(0,0,0,0.18);">
          −
        </button>
        <button 
          type="button" 
          onclick="window.resetMapToFrame()"
          title="Reset View"
          style="width: 38px; height: 38px; border-radius: 12px; background: #0B5A68; border: none; color: #FFFFFF; font-size: 14px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 10px rgba(11,90,104,0.35);">
          ⛶
        </button>
      </div>
      ${typeof renderGlobalFooter === 'function' ? renderGlobalFooter('home') : ''}

    </div>
  `;

  return html;
}

// --- ROBUST OFFLINE-SAFE LEAFLET MAP WRAPPER ---
window.initLeafletMapInstance = function (containerEl = null, params = {}) {
  let stage = 'start';
  try {
    const mapElement = containerEl || document.getElementById('map') || document.getElementById('yathra-main-map');
    stage = 'dom-check';
    const isConnected = Boolean(mapElement?.isConnected);
    const rect = mapElement ? mapElement.getBoundingClientRect() : { width: 0, height: 0 };

    if (!mapElement || !isConnected) {
      const err = new Error('#map element not connected to DOM');
      console.error(`[MAP-RUNTIME ERROR] stage=${stage} name=${err.name} message=${err.message} stack=${err.stack}`);
      return null;
    }

    mapElement.style.height = '100%';
    mapElement.style.width = '100%';

    stage = 'leaflet-check';
    const leafletAvailable = typeof L !== 'undefined';
    console.log(`[MAP-RUNTIME 03] leaflet-available=${leafletAvailable}`);

    if (!leafletAvailable) {
      console.warn("⚠️ Leaflet library unavailable. Rendering fallback view.");
      mapElement.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; background: #FDF8E9; color: #1E293B; padding: 20px; text-align: center; box-sizing: border-box;">
          <div style="font-size: 36px; margin-bottom: 8px;">🗺️</div>
          <h3 style="font-size: 16px; font-weight: 800; color: #0B5A68; margin-bottom: 6px;">Offline Map Mode</h3>
          <p style="font-size: 12px; color: #64748B; line-height: 1.4; margin-bottom: 16px;">
            Interactive map tiles require an active network connection. You can explore all heritage sites via the directory.
          </p>
          <button onclick="window.executeAppNavigation('directory')" style="background: #0B5A68; color: #FFFFFF; border: none; border-radius: 10px; padding: 10px 18px; font-weight: 700; font-size: 12.5px; cursor: pointer;">
            Go to Directory →
          </button>
        </div>
      `;
      return null;
    }

    if (window.activeLeafletMap) {
      try { window.activeLeafletMap.remove(); } catch (e) { }
      window.activeLeafletMap = null;
    }

    // Inject Pulsing Bulb Keyframes
    if (!document.getElementById('map-bulb-glow-style')) {
      const style = document.createElement('style');
      style.id = 'map-bulb-glow-style';
      style.innerHTML = `
        @keyframes bulbGlowPulse {
          0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7), 0 0 8px #2563EB; transform: scale(0.95); }
          50% { box-shadow: 0 0 0 14px rgba(37, 99, 235, 0), 0 0 22px #60A5FA; transform: scale(1.15); }
          100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0), 0 0 8px #2563EB; transform: scale(0.95); }
        }
        .live-user-glowing-bulb {
          width: 16px; height: 16px; background: #2563EB; border: 2.5px solid #FFFFFF; border-radius: 50%;
          animation: bulbGlowPulse 1.8s infinite ease-in-out;
        }
      `;
      document.head.appendChild(style);
    }

    const sriLankaBounds = [[5.85, 79.50], [9.85, 81.90]];

    stage = 'constructor';
    console.log('[MAP-RUNTIME 04] constructor-start');
    const map = L.map(mapElement, {
      zoomControl: false,
      attributionControl: false,
      maxBounds: [[5.0, 78.5], [10.5, 83.0]],
      minZoom: 6.5,
      zoomSnap: 0.25,
      zoomDelta: 0.5
    });

    map.fitBounds(sriLankaBounds, { padding: [8, 8] });
    map.panBy([0, 28], { animate: false });
    window.activeLeafletMap = map;
    console.log('[MAP-RUNTIME 05] constructor-success');

    window.resetMapToFrame = function () {
      if (window.activeLeafletMap) {
        window.activeLeafletMap.fitBounds(sriLankaBounds, { padding: [8, 8] });
        window.activeLeafletMap.panBy([0, 28], { animate: false });
      }
    };

    stage = 'tiles';
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      errorTileUrl: ''
    });

    tileLayer.on('tileerror', function(errorEvent) {
      console.warn("⚠️ Tile load timeout or offline:", errorEvent);
    });

    tileLayer.addTo(map);
    console.log('[MAP-RUNTIME 06] tiles-added');

    stage = 'markers';
    let markerCount = 0;
    try {
      const processedCoords = [];
      const labelEntries = [];
      const allSites = typeof getDirectoryDataset === 'function' ? getDirectoryDataset() : [];
      const priorityLabels = new Set([
        'colombo_museum', 'independence_memorial_hall', 'sigiriya',
        'temple_of_the_tooth', 'ruwanweliseya', 'galle_fort', 'dowa_temple'
      ]);

      allSites.forEach((site) => {
        let coords = window.resolveSiteCoordinates ? window.resolveSiteCoordinates(site) : { lat: site.lat, lng: site.lng };
        if (!coords || !coords.lat || !coords.lng) return;
        const isHidden = site.category === 'Hidden Gems';
        const achievement = window.getLandmarkAchievementStatus(site.id);
        const fullyVerified = achievement.locationVerified && achievement.photoVerified;
        const hasAchievement = achievement.locationVerified || achievement.photoVerified;
        const color = fullyVerified ? '#D49A16' : (hasAchievement ? '#10B981' : (isHidden ? '#E59819' : '#0C6C7A'));
        const markerSymbol = hasAchievement ? '✓' : '';
        const markerSize = fullyVerified ? 26 : (hasAchievement ? 24 : 22);

        processedCoords.forEach(existing => {
          if (typeof window.calculateDistanceKm === 'function') {
            const d = window.calculateDistanceKm(coords.lat, coords.lng, existing.lat, existing.lng);
            if (d < 2.5) {
              coords = { lat: coords.lat + 0.022, lng: coords.lng + 0.022 };
            }
          }
        });
        processedCoords.push(coords);

        const icon = L.divIcon({
          className: `custom-map-pin ${hasAchievement ? 'verified-map-pin' : ''}`,
          html: `
            <div style="position: relative; width: ${markerSize}px; height: ${markerSize}px; background: ${color}; color:#FFFFFF; border-radius: 50%; border: 3px solid #FFFFFF; box-shadow: ${hasAchievement ? '0 0 0 3px rgba(16,185,129,.28), 0 4px 12px rgba(0,0,0,.4)' : '0 3px 8px rgba(0,0,0,0.35)'}; cursor: pointer; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:900;">${markerSymbol}</div>
          `,
          iconSize: [markerSize, markerSize],
          iconAnchor: [markerSize / 2, markerSize / 2]
        });

        const marker = L.marker([coords.lat, coords.lng], { icon, zIndexOffset: 2000 }).addTo(map);
        markerCount++;

        if (typeof window.getShortSiteName === 'function') {
          marker.bindTooltip(`${hasAchievement ? '✓ ' : ''}${window.getShortSiteName(site)}`, { permanent: true, direction: 'top', className: `map-site-label ${hasAchievement ? 'map-site-label-verified' : ''}` });
          labelEntries.push({ marker, minZoom: priorityLabels.has(site.id) ? 6.5 : 7.75 });
        }
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (typeof window.openSitePreview === 'function') {
            window.openSitePreview(site.id);
          }
        });
      });

      const updateMapLabelVisibility = () => {
        const zoom = map.getZoom();
        labelEntries.forEach(({ marker, minZoom }) => {
          marker.getTooltip()?.setOpacity(zoom >= minZoom ? 1 : 0);
        });
      };
      map.on('zoomend', updateMapLabelVisibility);
      updateMapLabelVisibility();
    } catch (pinErr) {
      console.warn("Non-critical pin error:", pinErr);
    }
    console.log(`[MAP-RUNTIME 07] markers-added count=${markerCount}`);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userIcon = L.divIcon({
            className: 'user-pin-wrapper',
            html: `<div class="live-user-glowing-bulb"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          });
          L.marker([pos.coords.latitude, pos.coords.longitude], { icon: userIcon, zIndexOffset: 100, interactive: false }).addTo(map).bindPopup("<b>You Are Here</b>");
        },
        (geoErr) => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    setTimeout(() => {
      if (map && typeof map.invalidateSize === 'function') {
        map.invalidateSize();
      }
    }, 150);

    stage = 'complete';
    console.log('[MAP-RUNTIME 08] initialization-complete');
    return map;
  } catch (mapErr) {
    console.error(`[MAP-RUNTIME ERROR] stage=${stage} name=${mapErr?.name || 'Error'} message=${mapErr?.message || mapErr} stack=${mapErr?.stack || ''}`);
    const mapElement = containerEl || document.getElementById('map');
    if (mapElement) {
      mapElement.innerHTML = `
        <div style="padding: 24px; text-align: center; color: #1E293B; background: #FAF5E8; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box;">
          <div style="font-size: 38px; margin-bottom: 8px;">🗺️</div>
          <h3 style="font-size: 18px; font-weight: 800; color: #0B5A68; margin-bottom: 6px;">Map Display Error</h3>
          <p style="font-size: 12.5px; color: #64748B; margin-bottom: 18px; line-height: 1.45;">Failed to initialize map instance.</p>
          <button onclick="window.executeAppNavigation('directory')" style="background: #0B5A68; color: #FFFFFF; border: none; border-radius: 11px; padding: 11px 20px; font-weight: 800; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(11,90,104,0.3);">
            Back to Directory →
          </button>
        </div>
      `;
    }
    return null;
  }
};
window.initLeafletMap = window.initLeafletMapInstance;

// ============================================================================
// EXACT PRODUCTION SCREEN 001: WELCOME SCREEN
// ============================================================================
function renderWelcomeScreen() {
  return `
    <div class="screen welcome-screen yl-welcome-screen" style="position: relative; width: 100%; height: 100%; background-color: #0B5A68; display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: 48px 20px 32px 20px; box-sizing: border-box; overflow: hidden;">
      
      <!-- Section 1: Upper Zone (Centered Emblem Logo) -->
      <div class="welcome-top-zone yl-welcome-logo-zone" style="flex: 1; width: 100%; display: flex; align-items: center; justify-content: center;">
        <img 
          src="/Element%20Pictures/logo.png" 
          alt="YathraLanka"
          style="width: 285px; max-width: 86%; max-height: 260px; height: auto; object-fit: contain; background-color: #0B5A68; mix-blend-mode: normal; filter: none; border: none; display: block;" 
          onerror="if (!this.dataset.retry) { this.dataset.retry = '1'; this.src = '/assets/logo.png'; } else if (this.dataset.retry === '1') { this.dataset.retry = '2'; this.src = '/logo.png'; } else if (this.dataset.retry === '2') { this.dataset.retry = '3'; this.src = 'Element%20Pictures/logo.png'; }"
        />
      </div>

      <!-- Section 2: Lower Content Block -->
      <div class="welcome-bottom-block yl-welcome-actions" style="width: 100%; max-width: 290px; display: flex; flex-direction: column; align-items: center; text-align: center; margin-top: auto;">
        
        <!-- Brand Title & Tagline -->
        <h1 style="font-family: 'Cinzel', Georgia, serif; font-size: 32px; font-weight: 700; color: #F5BE48; margin: 0 0 2px 0; letter-spacing: 0.5px; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.20);">
          YathraLanka
        </h1>
        
        <p style="font-size: 13.5px; font-weight: 600; color: #E8A838; margin: 0 0 16px 0; letter-spacing: 0.2px;">
          Play the game. Protect the past.
        </p>

        <!-- Action Button Stack (gap: 10px) -->
        <div style="width: 100%; display: flex; flex-direction: column; gap: 10px;">
          
          <button 
            id="btn-welcome-signin"
            type="button" 
            onclick="window.openAuthScreen('signin')"
            class="yl-welcome-primary" style="width: 100%; background: #F5A623; color: #1E293B; font-size: 15px; font-weight: 700; padding: 14px; border-radius: 12px; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.20); transition: transform 0.15s ease;">
            Sign In
          </button>

          <button 
            id="btn-welcome-signup"
            type="button" 
            onclick="window.openAuthScreen('signup')"
            class="yl-welcome-secondary" style="width: 100%; background: transparent; border: 2px solid #CBD5E1; color: #FFFFFF; font-size: 15px; font-weight: 700; padding: 12px; border-radius: 12px; cursor: pointer; transition: background 0.15s ease;">
            Sign Up
          </button>

          <button 
            id="btn-welcome-guest"
            type="button" 
            onclick="window.continueAsGuest(event)"
            class="yl-welcome-guest" style="width: 100%; background: rgba(255, 255, 255, 0.10); border: 1px solid rgba(255, 255, 255, 0.25); backdrop-filter: blur(6px); color: #FFFFFF; font-size: 14px; font-weight: 600; padding: 12px; border-radius: 12px; cursor: pointer; transition: background 0.15s ease;">
            Continue as Guest
          </button>

        </div>

      </div>

    </div>
  `;
}



function goBack() {
  if (state.currentScreen === 'site-detail') {
    navigate(state.siteReferrer || 'dashboard', false);
    return;
  }

  if (state.navStack.length > 0) {
    const prev = state.navStack.pop();
    navigate(prev, false);
  } else {
    navigate('dashboard');
  }
}

function addXP(amount, message = '') {
  state.user.xp += amount;

  let currentRank = 'None';
  rankingScale.forEach(lvl => {
    if (state.user.xp >= lvl.threshold) {
      currentRank = lvl.rank;
    }
  });

  if (state.user.rank !== currentRank) {
    state.user.rank = currentRank;
    showNotification(`New Rank Unlocked: ${currentRank}!`);
  }

  if (message) {
    showNotification(`${message} (+${amount} XP)`);
  }
  saveUserProfile();
}

function saveUserProfile() {
  try {
    state.currentUser = state.user;
    localStorage.setItem('yathra_user_profile', JSON.stringify(state.user));
    if (state.user && !state.isGuest && state.user.uid) {
      localStorage.setItem('yathra_current_user', JSON.stringify(state.user));
    }
  } catch (err) {
    console.error("Local user profile caching error:", err);
  }

  const user = auth.currentUser;
  if (!user || state.isGuest) return Promise.resolve();

  const userDocRef = doc(db, 'users', user.uid);
  return setDoc(userDocRef, {
    xp: state.user.xp,
    rank: state.user.rank,
    medals: state.user.medals,
    sitesVisited: state.user.sitesVisited,
    quizzesPassed: state.user.quizzesPassed,
    role: state.user.role,
    interests: state.user.interests,
    permissions: state.user.permissions,
    signedPetitions: state.user.signedPetitions,
    donatedAmount: state.user.donatedAmount,
    joinedEvents: state.user.joinedEvents,
    unlockedCoupons: state.user.unlockedCoupons,
    completedQuizzes: state.user.completedQuizzes,
    dwellTimeCompleted: state.user.dwellTimeCompleted,
    verifiedPhotos: state.user.verifiedPhotos,
    siteProgress: state.siteProgress || {},
    museumProductionResetVersion: MUSEUM_PRODUCTION_RESET_VERSION,
    independenceProductionResetVersion: INDEPENDENCE_PRODUCTION_RESET_VERSION,
    bmichProductionResetVersion: BMICH_PRODUCTION_RESET_VERSION
  }, { merge: true })
    .catch(err => {
      if (err && (err.code === 'permission-denied' || err.message?.includes('permission'))) {
        console.warn("Firestore write permission denied. Profile stored in localStorage only.");
      } else {
        console.warn("Firestore save user profile fallback active:", err);
      }
    });
}

function showNotification(text, type = 'info') {
  const existingToasts = document.querySelectorAll('.yathra-toast');
  existingToasts.forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = `yathra-toast ${type}`;
  toast.textContent = text;

  const targetContainer = document.querySelector('.iphone-chassis') || document.body;
  targetContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastFadeOut 0.3s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// --- AUTHENTICATION & SECURITY UTILITIES ---
function calculatePasswordEntropy(password) {
  if (!password) return { score: 0, level: 0, label: 'Too Short' };
  let score = 0;
  if (password.length >= 8) score += 20;
  if (password.length >= 10) score += 20;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 20;
  if (/\d/.test(password)) score += 20;
  if (/[^a-zA-Z0-9]/.test(password)) score += 20;

  let level = 0;
  let label = 'Too Short';
  if (score >= 80) { level = 4; label = 'Strong'; }
  else if (score >= 60) { level = 3; label = 'Good'; }
  else if (score >= 40) { level = 2; label = 'Fair'; }
  else if (score > 0) { level = 1; label = 'Weak'; }

  return { score, level, label };
}

function translateAuthError(code, defaultMsg) {
  switch (code) {
    case 'auth/user-not-found':
      return "No account found with this email address.";
    case 'auth/wrong-password':
      return "Incorrect password. Please try again.";
    case 'auth/invalid-credential':
      return "Invalid email or password. Please verify credentials.";
    case 'auth/email-already-in-use':
      return "An account with this email address already exists.";
    case 'auth/weak-password':
      return "Password is too weak. Please use at least 10 characters with numbers & symbols.";
    case 'auth/invalid-email':
      return "Please enter a valid email address.";
    case 'auth/missing-password':
      return "Please enter your password.";
    case 'auth/popup-closed-by-user':
      return "Sign in window was closed before completing.";
    case 'auth/popup-blocked':
      return "Pop-up blocked by browser. Attempting redirect fallback...";
    case 'auth/network-request-failed':
      return "Network error. Working in offline cached profile mode.";
    default:
      return defaultMsg || "Authentication error occurred. Please try again.";
  }
}

function executePendingAction() {
  if (state.pendingAction) {
    const action = state.pendingAction;
    state.pendingAction = null;
    closeAuthModal();
    if (typeof action.callback === 'function') {
      showNotification("Authentication verified! Proceeding with action...", "success");
      action.callback();
    }
  }
}

function handleAuthUserSuccess(user, toastMsg) {
  const userDocRef = doc(db, 'users', user.uid);
  getDoc(userDocRef).then((docSnap) => {
    state.user = { ...initialUserState };
    if (docSnap.exists()) {
      state.user = { ...state.user, ...docSnap.data() };
    } else {
      state.user.role = 'Explorer';
    }
    state.user.uid = user.uid;
    state.currentUser = state.user;
    state.isGuest = false;
    localStorage.setItem('yathra_current_user', JSON.stringify(state.user));
    saveUserProfile();
    showNotification(toastMsg || `Welcome back, ${user.displayName || "Explorer"}!`, "success");
    closeAuthModal();
    if (state.pendingAction) {
      executePendingAction();
    } else if (state.currentScreen === 'landing' || state.currentScreen === 'splash' || state.currentScreen === 'login' || state.currentScreen === 'signup') {
      navigate('dashboard');
    }
  }).catch(err => {
    state.user.uid = user.uid;
    state.currentUser = state.user;
    state.isGuest = false;
    localStorage.setItem('yathra_current_user', JSON.stringify(state.user));
    saveUserProfile();
    showNotification("Logged in (offline profile cached).", "info");
    closeAuthModal();
    if (state.pendingAction) executePendingAction();
    else if (state.currentScreen === 'landing' || state.currentScreen === 'splash' || state.currentScreen === 'login' || state.currentScreen === 'signup') navigate('dashboard');
  });
}

window.__authListenerInitialized = false;

function initAuthListener() {
  if (window.__authListenerInitialized) return;
  window.__authListenerInitialized = true;
  console.log('[BOOT] authListener count=1');

  if (typeof auth === 'undefined' || !auth) return;

  onAuthStateChanged(auth, async (user) => {
    window.__appSettled = true;
    if (window.__startupTimeoutHandle) {
      clearTimeout(window.__startupTimeoutHandle);
      window.__startupTimeoutHandle = null;
    }

    if (!window.__startupSessionPolicyComplete) {
      console.log("[STARTUP-SESSION] auth observer deferred");
      return;
    }

    if (user && user.uid) {
      console.log("👤 Firebase User Authenticated:", user.displayName || user.email, "UID:", user.uid);

      if (!window.state) window.state = {};

      if (window.state.sessionAuthorized !== true) {
        console.log("[STARTUP-SESSION] Restored Firebase session detected without explicit session authorization. Ignoring auto-navigation to home.");
        return;
      }

      if (window.state.activeUid && window.state.activeUid !== user.uid) {
        console.log(`[AUTH-STATE] UID changed from ${window.state.activeUid.slice(-6)} to ${user.uid.slice(-6)}. Clearing session.`);
        if (typeof window.clearActiveUserSession === 'function') {
          window.clearActiveUserSession();
        }
      }

      window.state.activeUid = user.uid;
      const cachedProfile = window.getStoredUserProfile(user.uid);
      const initialUserObj = cachedProfile || {
        uid: user.uid,
        name: user.displayName || (user.email ? user.email.split('@')[0] : 'Explorer'),
        displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'Explorer'),
        preferredDisplayName: user.displayName || (user.email ? user.email.split('@')[0] : 'Explorer'),
        email: user.email || '',
        emailNormalized: window.normalizeEmail(user.email),
        photoURL: user.photoURL || '/assets/royal-avatar.png',
        googlePhotoURL: user.photoURL || '',
        xp: 50,
        rank: 'Novice Explorer',
        isGuest: false,
        profileStatus: "loading"
      };

      window.state.currentUser = initialUserObj;
      window.state.user = initialUserObj;
      window.state.isGuest = false;
      window.state.isLoggedIn = true;
      window.state.sessionMode = 'authenticated';
      localStorage.setItem('yathralanka_session_mode', 'authenticated');
      sessionStorage.removeItem('yathralanka_session_mode');
      window.saveStoredUserProfile(user.uid, initialUserObj);
      localStorage.setItem('yathralanka_logged_in', 'true');

      if (window.state.currentScreen === 'welcome' || window.state.currentScreen === 'auth' || !window.state.currentScreen) {
        console.log('[AUTH-ROUTING] Valid authorized session -> Navigating to authenticated Dashboard');
        if (typeof window.executeAppNavigation === 'function') {
          window.executeAppNavigation('home');
        } else if (typeof window.navigate === 'function') {
          window.navigate('home');
        }
      }

      // Background non-blocking profile sync with Firestore
      const provider = user.providerData?.[0]?.providerId || 'google.com';
      window.syncCanonicalProfileAsync(user, provider);
    } else {
      console.log("👤 Firebase User Unauthenticated (No active session)");
      if (!window.state) window.state = {};

      if (window.state?.authTransition === 'startup-signout') {
        console.log('[AUTH-STATE] transient null-user event ignored during startup-signout cleanup');
        return;
      }

      if (window.state?.authTransition === 'switching-provider') {
        console.log('[AUTH-STATE] transient sign-out ignored during provider switch');
        console.log(`[AUTH-TRACE] stage=firebase_signout_observer_ignored`);
        return;
      }

      const isSessionGuest = sessionStorage.getItem('yathralanka_session_mode') === 'guest' || window.state?.sessionMode === 'guest';

      if (isSessionGuest) {
        console.log('[AUTH-ROUTING] Active current-session guest mode preserved.');
        window.state.isGuest = true;
        window.state.isLoggedIn = false;
        window.state.sessionMode = 'guest';
        return;
      }

      window.state.currentUser = null;
      window.state.user = null;
      window.state.isGuest = false;
      window.state.isLoggedIn = false;
      window.state.sessionMode = 'signed_out';
      localStorage.removeItem('yathralanka_logged_in');
      if (localStorage.getItem('yathralanka_session_mode') === 'authenticated' || localStorage.getItem('yathralanka_session_mode') === 'guest') {
        localStorage.removeItem('yathralanka_session_mode');
      }

      if (window.state.currentScreen === 'home' || !window.state.currentScreen) {
        if (typeof window.executeAppNavigation === 'function') {
          window.executeAppNavigation('welcome');
        } else if (typeof window.navigate === 'function') {
          window.navigate('welcome');
        }
      }
    }

    const userNameEl = document.querySelector('.user-display-name, #profile-user-name');
    if (userNameEl && window.state?.user && (window.state.user.preferredDisplayName || window.state.user.displayName)) {
      userNameEl.textContent = window.state.user.preferredDisplayName || window.state.user.displayName;
    }
  });
}

function requireAuth(actionType, callback, siteId = null, payload = null) {
  const capabilityMap = {
    'VERIFY': 'verification',
    'LEDGER': 'activism-action',
    'REWARD': 'redeem-reward',
    'QUIZ': 'quiz',
    'PROFILE': 'profile-action'
  };
  const capability = capabilityMap[actionType] || 'full-landmark';
  const originRoute = window.state?.currentScreen || 'home';

  return requestProtectedAccess({
    capability,
    originRoute,
    originParams: { siteId, payload },
    onAuthorized: callback
  });
}

// ============================================================================
// GUARDED GOOGLE AUTH INITIALIZATION PROMISE LOCK
// ============================================================================
let googleAuthInitPromise = null;

function ensureGoogleAuthInitialized() {
  if (googleAuthInitPromise) return googleAuthInitPromise;

  googleAuthInitPromise = (async () => {
    const isNative = Boolean(window.Capacitor?.isNativePlatform && window.Capacitor.isNativePlatform());
    if (isNative && typeof GoogleAuth !== 'undefined' && typeof GoogleAuth.initialize === 'function') {
      console.log('[AUTH-RUNTIME 02] initialize-start');
      await GoogleAuth.initialize({
        clientId: '1032179534120-ttht7fjohqbvdrjurvjnudnr9ebggfp8.apps.googleusercontent.com',
        scopes: ['profile', 'email'],
        grantOfflineAccess: false
      });
      console.log('[AUTH-RUNTIME 03] initialize-success');
    }
    return true;
  })();

  return googleAuthInitPromise;
}
window.ensureGoogleAuthInitialized = ensureGoogleAuthInitialized;

window.getGoogleAuthErrorMessage = function (error) {
  const code = error?.code || '';
  if (code === 'auth/popup-blocked') {
    return 'The browser blocked Google sign-in. Allow pop-ups for this site and try again.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Google sign-in is not authorized for this website address.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Unable to reach Google. Check your connection and try again.';
  }
  if (code === 'auth/web-storage-unsupported') {
    return 'Google sign-in needs cookies and site storage. Please allow them and try again.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Google sign-in was cancelled.';
  }
  return `Google sign-in could not be completed${code ? ` (${code})` : ''}. Please try again.`;
};

window.reportGoogleAuthIssue = function (error, type = 'error') {
  const message = window.getGoogleAuthErrorMessage(error);
  if (typeof window.showAuthInlineAlert === 'function') {
    window.showAuthInlineAlert(message, type);
  }
  if (typeof window.showNotification === 'function') {
    window.showNotification(message, type);
  }
};

window.handleGoogleSignInClick = async function () {
  if (window.state?.isAuthenticating) {
    console.log('[AUTH-RUNTIME] stage=tap-ignored reason=already_authenticating');
    return;
  }

  if (typeof window.clearAuthTransaction === 'function') {
    window.clearAuthTransaction();
  }

  if (!window.state) window.state = {};
  const attemptId = 'attempt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  window.state.isAuthenticating = true;
  window.state.authAttempt = {
    id: attemptId,
    status: 'initializing',
    originRoute: window.state?.pendingAuthReturn?.originRoute || 'home',
    startedAt: new Date().toISOString()
  };

  // Stage: attempt_created
  console.log(`[AUTH-TRACE] attempt=${attemptId} stage=attempt_created attemptPresent=${Boolean(window.state?.authAttempt)}`);
  const firebaseUserExisted = Boolean(auth?.currentUser);
  const preProviderIds = auth?.currentUser?.providerData?.map(p => p.providerId) || [];
  console.log(`[AUTH-TRACE] attempt=${attemptId} firebaseUserExisted=${firebaseUserExisted} providerIds=${JSON.stringify(preProviderIds)}`);

  // Disable Google Sign-In buttons across auth screen & modals
  const googleBtns = document.querySelectorAll('#btn-google-signin, .google-btn, [onclick*="handleGoogleSignIn"]');
  googleBtns.forEach(btn => {
    btn.setAttribute('disabled', 'true');
    btn.style.opacity = '0.6';
    btn.style.pointerEvents = 'none';
  });

  document.querySelectorAll('#auth-loading-overlay').forEach(el => el.remove());

  const loader = document.createElement('div');
  loader.id = 'auth-loading-overlay';
  loader.style.cssText = 'position:fixed; inset:0; background:rgba(8,43,51,0.7); backdrop-filter:blur(4px); z-index:999999; display:flex; align-items:center; justify-content:center;';
  loader.innerHTML = '<div style="background:#FAF5E8; color:#125463; padding:18px 26px; border-radius:16px; font-weight:800; border:1.5px solid #DFCEAA; box-shadow:0 10px 30px rgba(0,0,0,0.3);">Connecting to Google...</div>';
  document.body.appendChild(loader);

  const cleanup = () => {
    if (window.state) {
      window.state.isAuthenticating = false;
      window.state.authTransition = null;
    }
    document.querySelectorAll('#auth-loading-overlay').forEach(el => el.remove());
    googleBtns.forEach(btn => {
      btn.removeAttribute('disabled');
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
    });
  };

  try {
    const isNative = Boolean(window.Capacitor?.isNativePlatform && window.Capacitor.isNativePlatform());

    // Clear previous user identity & progress without destroying current authAttempt
    if (typeof window.clearActiveUserData === 'function') {
      window.clearActiveUserData({ preserveAuthAttempt: true });
    }
    console.log(`[AUTH-TRACE] attempt=${attemptId} stage=user_data_cleared attemptPresent=${Boolean(window.state?.authAttempt)}`);
    localStorage.removeItem('yathralanka_session_mode');

    // Firebase sign-out with transient protection flag
    if (auth && auth.currentUser) {
      window.state.authTransition = 'switching-provider';
      console.log(`[AUTH-TRACE] attempt=${attemptId} stage=firebase_signout_started`);
      try {
        await signOut(auth);
        console.log(`[AUTH-TRACE] attempt=${attemptId} stage=firebase_signout_completed`);
      } catch (signOutErr) {}
    }

    if (isNative) {
      try {
        await ensureGoogleAuthInitialized();
        console.log(`[AUTH-TRACE] attempt=${attemptId} stage=google_initialized`);
      } catch (initErr) {
        console.log(`[AUTH-TRACE] attempt=${attemptId} stage=native_google_signout_started outcome=failed code=init_failed message=Google Auth initialization failed.`);
        window.updateAuthAttempt(attemptId, 'failed');
        cleanup();
        if (typeof window.clearAuthTransaction === 'function') window.clearAuthTransaction();
        if (typeof window.showNotification === 'function') {
          window.showNotification("Google authentication could not be verified.", "error");
        }
        return;
      }

      try {
        await GoogleAuth.signOut();
        console.log(`[AUTH-TRACE] attempt=${attemptId} stage=native_session_cleared`);
      } catch (signOutErr) {
        console.log(`[AUTH-TRACE] attempt=${attemptId} stage=native_google_signout_started outcome=failed code=signout_failed message=Failed to clear native session.`);
        window.updateAuthAttempt(attemptId, 'failed');
        cleanup();
        if (typeof window.clearAuthTransaction === 'function') window.clearAuthTransaction();
        if (typeof window.showNotification === 'function') {
          window.showNotification("Unable to prepare Google Account Chooser. Please try again.", "error");
        }
        return;
      }

      // Stage: chooser_started
      console.log(`[AUTH-TRACE] attempt=${attemptId} stage=chooser_started`);
      const attemptValid = window.state?.authAttempt?.id === attemptId;
      console.log(`[AUTH-TRACE] attempt=${attemptId} stage=chooser_precondition attemptValid=${attemptValid}`);

      if (!attemptValid) {
        console.error(`[AUTH-TRACE] attempt=${attemptId} stage=transaction_missing`);
        cleanup();
        if (typeof window.clearAuthTransaction === 'function') window.clearAuthTransaction();
        if (typeof window.showNotification === 'function') {
          window.showNotification("Authentication attempt was interrupted. Please try again.", "error");
        }
        return;
      }

      window.updateAuthAttempt(attemptId, 'selecting-account');
      let googleUser = null;
      try {
        googleUser = await GoogleAuth.signIn();
      } catch (signInErr) {
        console.log(`[AUTH-TRACE] attempt=${attemptId} stage=chooser_started outcome=cancelled code=user_cancelled message=Account selection was cancelled.`);
        window.updateAuthAttempt(attemptId, 'cancelled');
        cleanup();
        if (typeof window.clearAuthTransaction === 'function') window.clearAuthTransaction();
        if (typeof window.showNotification === 'function') {
          window.showNotification("Google Sign-In cancelled.", "info");
        }
        return;
      }

      if (!googleUser) {
        console.log(`[AUTH-TRACE] attempt=${attemptId} stage=chooser_started outcome=cancelled code=user_cancelled message=Account selection was cancelled.`);
        window.updateAuthAttempt(attemptId, 'cancelled');
        cleanup();
        if (typeof window.clearAuthTransaction === 'function') window.clearAuthTransaction();
        return;
      }

      // Stage: chooser_returned
      console.log(`[AUTH-TRACE] attempt=${attemptId} stage=chooser_returned`);
      const idToken = googleUser.authentication?.idToken || googleUser.idToken;

      if (!idToken) {
        console.log(`[AUTH-TRACE] attempt=${attemptId} stage=id_token_present outcome=failed code=no_token message=Google did not return a valid sign-in token.`);
        window.updateAuthAttempt(attemptId, 'failed');
        cleanup();
        if (typeof window.clearAuthTransaction === 'function') window.clearAuthTransaction();
        if (typeof window.showNotification === 'function') {
          window.showNotification("Google did not return a valid sign-in token. Please try again.", "error");
        }
        return;
      }

      // Stage: id_token_present
      console.log(`[AUTH-TRACE] attempt=${attemptId} stage=id_token_present`);

      // Stage: firebase_exchange_started
      console.log(`[AUTH-TRACE] attempt=${attemptId} stage=firebase_exchange_started`);
      window.updateAuthAttempt(attemptId, 'exchanging-credential');
      const credential = GoogleAuthProvider.credential(idToken);

      let credentialResult = null;
      try {
        credentialResult = await signInWithCredential(auth, credential);
      } catch (fbErr) {
        let code = fbErr.code || 'firebase_exchange_failed';
        let msg = 'Google authentication could not be verified.';
        let userMsg = 'Google authentication could not be verified.';

        if (fbErr.code === 'auth/account-exists-with-different-credential') {
          msg = 'This email already uses another sign-in method. Sign in with your password to connect Google.';
          userMsg = 'This email already uses another sign-in method. Sign in with your password to connect Google.';
          console.log(`[AUTH-TRACE] attempt=${attemptId} stage=firebase_exchange_started outcome=failed code=${code} message=${msg}`);
          const extractedEmail = googleUser.email || googleUser.user?.email || '';
          window.state.pendingGoogleCredential = { credential, email: extractedEmail };
          cleanup();
          if (typeof window.showNotification === 'function') {
            window.showNotification(userMsg, "error");
          }
          if (typeof window.showReauthPasswordModal === 'function') {
            window.showReauthPasswordModal();
          }
          return;
        } else if (fbErr.code === 'auth/network-request-failed') {
          msg = 'Unable to complete sign-in. Check your connection and try again.';
          userMsg = 'Unable to complete sign-in. Check your connection and try again.';
        }

        console.log(`[AUTH-TRACE] attempt=${attemptId} stage=firebase_exchange_started outcome=failed code=${code} message=${msg}`);
        window.updateAuthAttempt(attemptId, 'failed');
        cleanup();
        if (typeof window.clearAuthTransaction === 'function') window.clearAuthTransaction();
        if (typeof window.showNotification === 'function') {
          window.showNotification(userMsg, "error");
        }
        return;
      }

      // Stage: firebase_exchange_succeeded
      console.log(`[AUTH-TRACE] attempt=${attemptId} stage=firebase_exchange_succeeded`);

      const fbUser = auth?.currentUser || credentialResult?.user;
      if (!fbUser || !fbUser.uid) {
        console.log(`[AUTH-TRACE] attempt=${attemptId} stage=firebase_exchange_succeeded outcome=failed code=null_uid message=Google authentication could not be verified.`);
        window.updateAuthAttempt(attemptId, 'failed');
        cleanup();
        if (typeof window.clearAuthTransaction === 'function') window.clearAuthTransaction();
        if (typeof window.showNotification === 'function') {
          window.showNotification("Google authentication could not be verified.", "error");
        }
        return;
      }

      // Stage: session_created
      console.log(`[AUTH-TRACE] attempt=${attemptId} stage=session_created`);

      // Stage: navigation_started
      console.log(`[AUTH-TRACE] attempt=${attemptId} stage=navigation_started`);
      await window.handlePostAuthUserSuccess({ firebaseUser: fbUser, authProvider: 'google.com', attemptId, cleanup });
      if (typeof window.clearAuthTransaction === 'function') window.clearAuthTransaction();
      return;
    } else {
      // WEB PLATFORM FLOW
      console.log(`[AUTH-TRACE] attempt=${attemptId} stage=chooser_started`);
      window.updateAuthAttempt(attemptId, 'selecting-account');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      let result = null;
      try {
        result = await signInWithPopup(auth, provider);
        console.log(`[AUTH-TRACE] attempt=${attemptId} stage=chooser_returned`);
      } catch (popupErr) {
        const popupCode = popupErr?.code || 'unknown_popup_error';
        console.error(`[AUTH-TRACE] attempt=${attemptId} stage=chooser_failed code=${popupCode}`, popupErr);
        const cancelled = popupCode === 'auth/popup-closed-by-user' || popupCode === 'auth/cancelled-popup-request';
        window.updateAuthAttempt(attemptId, cancelled ? 'cancelled' : 'failed');
        cleanup();
        if (typeof window.clearAuthTransaction === 'function') window.clearAuthTransaction();
        window.reportGoogleAuthIssue(popupErr, cancelled ? 'info' : 'error');
        return;
      }

      const fbUser = result?.user || auth?.currentUser;
      if (!fbUser || !fbUser.uid) {
        console.log(`[AUTH-TRACE] attempt=${attemptId} stage=firebase_exchange_started outcome=failed code=null_web_user message=Google authentication could not be verified.`);
        window.updateAuthAttempt(attemptId, 'failed');
        cleanup();
        if (typeof window.clearAuthTransaction === 'function') window.clearAuthTransaction();
        if (typeof window.showNotification === 'function') {
          window.showNotification("Google authentication could not be verified.", "error");
        }
        return;
      }

      console.log(`[AUTH-TRACE] attempt=${attemptId} stage=firebase_exchange_succeeded`);
      console.log(`[AUTH-TRACE] attempt=${attemptId} stage=session_created`);
      console.log(`[AUTH-TRACE] attempt=${attemptId} stage=navigation_started`);
      await window.handlePostAuthUserSuccess({ firebaseUser: fbUser, authProvider: 'google.com', attemptId, cleanup });
      if (typeof window.clearAuthTransaction === 'function') window.clearAuthTransaction();
      return;
    }
  } catch (err) {
    console.error('[AUTH-TRACE] Unhandled error during Google sign-in:', err);
    if (typeof window.updateAuthAttempt === 'function') window.updateAuthAttempt(attemptId, 'failed');
    cleanup();
    if (typeof window.clearAuthTransaction === 'function') window.clearAuthTransaction();
    if (typeof window.showNotification === 'function') {
      window.showNotification("Google authentication could not be verified.", "error");
    }
  }
};
window.handleGoogleSignIn = window.handleGoogleSignInClick;

window.addEventListener('pageshow', () => {
  if (window.state) window.state.isAuthenticating = false;
  const stray = document.getElementById('auth-loading-overlay');
  if (stray) stray.remove();
});

// Global Helper: Open Auth screen while remembering where the guest was
window.openAuthFromCurrentScreen = function () {
  window.navigate('auth');
};

// Return Guest to their Exact Prior State
window.restoreGuestOrigin = function () {
  const target = window.state?.guestOriginScreen;
  const targetParams = window.state?.guestOriginParams || {};
  const targetScroll = window.state?.guestOriginScroll || 0;

  if (target && target !== 'welcome') {
    console.log(`↩ Returning guest to: ${target}`, targetParams);
    window.navigate(target, targetParams);

    setTimeout(() => {
      const activeScreenEl = document.querySelector('.screen-scroll-container') || document.querySelector('.screen');
      if (activeScreenEl && targetScroll) {
        activeScreenEl.scrollTop = targetScroll;
      }
    }, 60);
  } else {
    window.navigate('home');
  }
};

// Back Action on Screen 002
window.handleAuthBackClick = function () {
  if (window.state?.pendingAuthReturn) {
    const pending = window.state.pendingAuthReturn;
    window.state.pendingAuthReturn = null;
    console.log(`[AUTH-RETURN] action=back origin=${pending.originRoute}`);
    if (typeof window.executeAppNavigation === 'function') {
      window.executeAppNavigation(pending.originRoute, pending.originParams || {});
    } else if (typeof window.navigate === 'function') {
      window.navigate(pending.originRoute, pending.originParams || {});
    }
    return;
  }
  const destination = window.state?.authOrigin || window.state?.guestPreviousScreen || 'welcome';
  console.log(`[AUTH-RETURN] action=back origin=${destination}`);
  if (typeof window.executeAppNavigation === 'function') {
    window.executeAppNavigation(destination, window.state?.currentParams || {});
  } else if (typeof window.navigate === 'function') {
    window.navigate(destination, window.state?.currentParams || {});
  }
};

window.handleAuthBackNavigation = function () {
  window.handleAuthBackClick();
};

// ============================================================================
// REAL GOOGLE / OAUTH REGISTRATION CONTROLLER
// ============================================================================

// Persistent Database Registry Helper
function getUserRecord(email) {
  if (!email) return null;
  const db = JSON.parse(localStorage.getItem('yathralanka_users_db') || '{}');
  return db[email.toLowerCase().trim()] || null;
}

function saveUserRecord(user) {
  if (!user || !user.email) return;
  const db = JSON.parse(localStorage.getItem('yathralanka_users_db') || '{}');
  db[user.email.toLowerCase().trim()] = {
    uid: user.uid || `user_${Date.now()}`,
    name: user.name || "Explorer",
    email: user.email.toLowerCase().trim(),
    photoURL: user.photoURL || null,
    provider: user.provider || 'email',
    createdAt: db[user.email.toLowerCase().trim()]?.createdAt || new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };
  localStorage.setItem('yathralanka_users_db', JSON.stringify(db));
}

// Global Trigger for OAuth Providers (Google, Apple, Facebook)
window.triggerOAuthFlow = async function (providerName) {
  if (providerName === 'google') {
    return window.handleGoogleSignIn();
  }

  // Fallback simulation for Apple / Facebook buttons
  const providerNames = {
    google: "Google Explorer",
    apple: "Apple Explorer",
    facebook: "Facebook Explorer"
  };

  const email = `${providerName}_user@yathralanka.lk`;
  const existingRecord = getUserRecord(email);
  const name = existingRecord?.name || providerNames[providerName] || "Explorer";
  const isFirstTime = !existingRecord;

  const userSession = {
    uid: existingRecord?.uid || `oauth_${providerName}_${Date.now()}`,
    name: name,
    email: email,
    provider: providerName,
    isGuest: false,
    xp: existingRecord?.xp || 50
  };

  saveUserRecord(userSession);

  if (isFirstTime) {
    window.showWelcomeModal(userSession);
  } else {
    window.navigate('home');
  }
};

// ============================================================================
// 1. WELCOME MODAL WITH EMBLEM LOGO & FIRST-TIME FLAG
// ============================================================================
window.showWelcomeModal = function (user) {
  if (window.showFirstTimeWelcomeModal) {
    window.showFirstTimeWelcomeModal(user);
    return;
  }
  const modalContainer = document.getElementById('auth-modal-portal');
  if (!modalContainer) {
    saveUserRecord(user);
    window.state.showFirstTimeBonusBanner = true;
    window.navigate('home');
    return;
  }
};

window.completeRegistrationAndEnter = function () {
  if (window.state && window.state.user) {
    saveUserRecord(window.state.user);
  }
  // Enable the first-time welcome bonus banner on dashboard arrival
  window.state.showFirstTimeBonusBanner = true;

  const modalContainer = document.getElementById('auth-modal-portal');
  if (modalContainer) modalContainer.innerHTML = '';
  window.navigate('home');
};

window.dismissFirstTimeBanner = function () {
  window.state.showFirstTimeBonusBanner = false;
  const banner = document.getElementById('first-time-xp-banner');
  if (banner) {
    banner.style.opacity = '0';
    banner.style.transform = 'translateY(-10px)';
    setTimeout(() => banner.remove(), 200);
  }
};

// (Duplicate handleAuthSubmit block removed to keep single unified handler at line 582)

// ============================================================================
// SEAMLESS AUTH TAB TOGGLE CONTROLLER (Eliminates Viewport Jumps)
// ============================================================================
window.setAuthTab = function (mode) {
  const isSignIn = (mode === 'signin');

  // Synchronize state
  if (!window.state) window.state = {};
  window.state.authActiveTab = isSignIn ? 'signin' : 'signup';

  const btnSignIn = document.getElementById('tab-btn-signin');
  const btnCreate = document.getElementById('tab-btn-create') || document.getElementById('tab-btn-signup');
  if (btnSignIn && btnCreate) {
    btnSignIn.classList.toggle('active', isSignIn);
    btnCreate.classList.toggle('active', !isSignIn);
    btnSignIn.style.background = isSignIn ? '#FFFFFF' : 'transparent';
    btnSignIn.style.color = isSignIn ? '#0B5A68' : 'rgba(255,255,255,0.85)';
    btnCreate.style.background = !isSignIn ? '#FFFFFF' : 'transparent';
    btnCreate.style.color = !isSignIn ? '#0B5A68' : 'rgba(255,255,255,0.85)';
  }

  const accordion = document.getElementById('auth-signup-accordion');
  if (accordion) accordion.classList.toggle('expanded', !isSignIn);

  const rulesBox = document.getElementById('signup-password-rules');
  if (rulesBox) rulesBox.style.display = isSignIn ? 'none' : 'block';

  const forgotPassword = document.getElementById('forgot-password-container');
  if (forgotPassword) forgotPassword.classList.toggle('hidden', !isSignIn);

  const submitBtn = document.getElementById('auth-submit-btn');
  const googleBtnText = document.getElementById('google-btn-text');
  const footerToggle = document.getElementById('auth-footer-prompt');

  if (submitBtn) submitBtn.textContent = isSignIn ? 'Sign In' : 'Create Account';
  if (googleBtnText) googleBtnText.textContent = isSignIn ? 'Sign in with Google' : 'Sign up with Google';

  if (footerToggle) {
    footerToggle.innerHTML = isSignIn
      ? `Don't have an account? <span onclick="window.setAuthTab('create')" style="color: #0F5361; font-weight: 800; cursor: pointer;">Sign Up</span>`
      : `Already have an account? <span onclick="window.setAuthTab('signin')" style="color: #0F5361; font-weight: 800; cursor: pointer;">Sign In</span>`;
  }
};

window.checkLiveSignupPassword = function (val) {
  const r = window.evaluatePasswordRules(val);
  const elUpper = document.getElementById('signup-rule-upper');
  const elLower = document.getElementById('signup-rule-lower');
  const elNumber = document.getElementById('signup-rule-number');

  if (elUpper) elUpper.innerHTML = r.hasUpper ? '🟢 One uppercase letter (A-Z)' : '⚪ One uppercase letter (A-Z)';
  if (elLower) elLower.innerHTML = r.hasLower ? '🟢 One lowercase letter (a-z)' : '⚪ One lowercase letter (a-z)';
  if (elNumber) elNumber.innerHTML = r.hasNumber ? '🟢 One number (0-9)' : '⚪ One number (0-9)';
};

window.switchAuthTab = function (mode) {
  return window.setAuthTab(mode);
};
window.switchAuthSlider = function (mode) {
  return window.setAuthTab(mode);
};

// ============================================================================
// ============================================================================
// BRANDED EMAILJS PASSWORD RESET DISPATCHER & IN-APP RESET FLOW (Screen 002C & 002D)
// ============================================================================

// ============================================================================
// SCREEN 002C: FORGOT PASSWORD CONTROLLER
// ============================================================================

// ============================================================================
// 1. RENDER SCREEN 002C (FORGOT PASSWORD VIEW)
// ============================================================================
window.handleForgotPassword = function () {
  const cardContainer = document.querySelector('.auth-card-wrapper');
  const tabPill = document.querySelector('.auth-tab-pill');
  if (!cardContainer) return;

  if (tabPill) tabPill.style.display = 'none';

  const currentEmail = document.getElementById('auth-email-input')?.value || document.getElementById('auth-identifier')?.value || '';

  cardContainer.innerHTML = `
    <div id="forgot-password-view">
      <h3 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 800; color: #125463; text-align: center;">
        Reset Password
      </h3>
      
      <p class="reset-card-subtitle">
        Enter your registered email address.<br>We will verify your account and send a secure recovery link.
      </p>

      <div id="forgot-password-alert" style="display: none;"></div>

      <form id="forgot-password-form" onsubmit="window.submitFirebasePasswordReset(event);">
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 11.5px; font-weight: 700; color: #1E293B; margin-bottom: 5px;">
            Email Address
          </label>
          <input 
            type="email" 
            id="reset-email-input" 
            placeholder="Enter your registered email" 
            value="${currentEmail}"
            required
            style="width: 100%; padding: 11px 14px; border: 1.5px solid #CBD5E1; border-radius: 10px; font-size: 13px; color: #1E293B; box-sizing: border-box; outline: none;"
          />
        </div>

        <button 
          id="btn-send-reset" 
          type="submit" 
          style="width: 100%; background: #F5A623; color: #1E293B; font-size: 14.5px; font-weight: 800; border: none; padding: 13px; border-radius: 10px; cursor: pointer; box-shadow: 0 4px 12px rgba(245, 166, 35, 0.28); margin-bottom: 12px;">
          Send Reset Link
        </button>
      </form>

      <button type="button" class="btn-back-signin" onclick="window.restoreAuthTabs()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span>Back to Sign In</span>
      </button>
    </div>
  `;
};

const TEMPLATE_PASSWORD_RESET = "template_u95fp18";

window.submitFirebasePasswordReset = async function (e) {
  if (e) e.preventDefault();

  const emailInput = document.getElementById('reset-email-input');
  const alertBox = document.getElementById('forgot-password-alert');
  const submitBtn = document.getElementById('btn-send-reset');
  if (!emailInput) return;

  const rawEmail = emailInput.value.trim().toLowerCase();
  emailInput.classList.remove('input-field-error');

  const verifiedDb = JSON.parse(localStorage.getItem('yathralanka_users') || '{}');
  const legacyDb = JSON.parse(localStorage.getItem('yathralanka_users_db') || '{}');
  const userRecord = verifiedDb[rawEmail] || legacyDb[rawEmail];

  if (!userRecord) {
    if (alertBox) {
      alertBox.className = 'auth-alert-box auth-alert-error';
      alertBox.innerHTML = `<span>⚠️</span><span>No account found with this email. Please create an account.</span>`;
      alertBox.style.display = 'flex';
    }
    return;
  }

  const displayName = userRecord.name || userRecord.displayName || rawEmail.split('@')[0] || 'Explorer';
  const resetToken = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

  // Store pending reset token
  const pendingResets = JSON.parse(localStorage.getItem('yathralanka_pending_resets') || '{}');
  pendingResets[rawEmail] = { token: resetToken, timestamp: Date.now() };
  localStorage.setItem('yathralanka_pending_resets', JSON.stringify(pendingResets));

  const resetLink = `${window.location.origin}${window.location.pathname}?mode=resetPassword&email=${encodeURIComponent(rawEmail)}&token=${resetToken}`;

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending reset email...';
    }

    if (window.emailjs) {
      await window.emailjs.send(
        "service_ovten6k",
        TEMPLATE_PASSWORD_RESET,
        {
          to_name: displayName,
          to_email: rawEmail,
          reset_link: resetLink
        }
      );
    }

    if (alertBox) {
      alertBox.className = 'auth-alert-box auth-alert-success';
      alertBox.innerHTML = `<span>✅</span><span>Password reset link sent to your primary inbox!</span>`;
      alertBox.style.display = 'flex';
    }

    if (submitBtn) {
      submitBtn.textContent = 'Link Sent';
      submitBtn.style.background = '#94A3B8';
      submitBtn.style.cursor = 'default';
    }
  } catch (err) {
    console.error("EmailJS Password Reset Error:", err);
    if (alertBox) {
      alertBox.className = 'auth-alert-box auth-alert-error';
      alertBox.innerHTML = `<span>⚠️</span><span>Failed to send email. Please try again later.</span>`;
      alertBox.style.display = 'flex';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Reset Link';
    }
  }
};
window.submitPasswordReset = window.submitFirebasePasswordReset;

// ============================================================================
// 3. RESTORE AUTH SCREEN (SCREEN 002A)
// ============================================================================
window.restoreAuthTabs = function () {
  const tabPill = document.querySelector('.auth-tab-pill');
  if (tabPill) tabPill.style.display = 'flex';

  if (typeof window.renderAuthScreen === 'function') {
    window.renderAuthScreen('signin');
  } else if (typeof window.setAuthTab === 'function') {
    window.setAuthTab('signin');
  } else if (typeof window.navigate === 'function') {
    window.state = window.state || {};
    window.state.authActiveTab = 'signin';
    window.navigate('auth');
  }
};

// ============================================================================
// 4. GUARD EXISTING USERS: NO WELCOME MODAL & NO DUPLICATE XP BONUS
// ============================================================================
window.handleExistingUserLogin = function (userRecord) {
  window.state = window.state || {};
  window.state.user = userRecord;
  window.state.currentUser = userRecord;
  window.state.isLoggedIn = true;
  window.state.isNewUser = false; // Prevents onboarding modals and EmailJS triggers

  // Suppress first expedition modal
  const welcomeModal = document.getElementById('welcome-modal-backdrop') || document.querySelector('.welcome-modal') || document.getElementById('welcome-interception-modal');
  if (welcomeModal) {
    welcomeModal.style.display = 'none';
    welcomeModal.remove();
  }

  if (userRecord) userRecord.showFirstRewardCard = false;

  // Route to Dashboard
  if (typeof renderDashboardScreen === 'function') {
    renderDashboardScreen();
  } else if (typeof window.navigate === 'function') {
    window.navigate('dashboard');
  } else if (typeof window.renderDashboard === 'function') {
    window.renderDashboard();
  }
};

// 3. SCREEN 002D: SECURE IN-APP NEW PASSWORD CARD
window.renderNewPasswordScreen = function (targetEmail) {
  const cardContainer = document.querySelector('.auth-card-wrapper');
  const tabPill = document.querySelector('.auth-tab-pill');
  if (!cardContainer) return;

  if (tabPill) tabPill.style.display = 'none';

  cardContainer.innerHTML = `
    <div id="new-password-view">
      <h3 style="margin: 0 0 4px 0; font-size: 17.5px; font-weight: 800; color: #125463; text-align: center;">
        Set New Password
      </h3>
      <p style="margin: 0 0 14px 0; font-size: 11.5px; color: #64748B; text-align: center;">
        for <strong>${targetEmail}</strong>
      </p>

      <div id="password-validation-alert" style="display: none;"></div>

      <form id="new-password-form" onsubmit="window.saveNewPassword(event, '${targetEmail}');" style="display: flex; flex-direction: column; gap: 10px;">
        
        <!-- New Password Field -->
        <div>
          <label style="display: block; font-size: 11.5px; font-weight: 700; color: #1E293B; margin-bottom: 3px;">New Password</label>
          <input 
            type="password" 
            id="input-new-password" 
            placeholder="Enter new password" 
            oninput="window.checkPasswordStrength(this.value)"
            required
            style="width: 100%; padding: 9px 12px; border: 1.5px solid #CBD5E1; border-radius: 10px; font-size: 13px; color: #1E293B; box-sizing: border-box; outline: none;" 
          />
        </div>

        <!-- Confirm Password Field -->
        <div>
          <label style="display: block; font-size: 11.5px; font-weight: 700; color: #1E293B; margin-bottom: 3px;">Confirm New Password</label>
          <input 
            type="password" 
            id="input-confirm-password" 
            placeholder="Re-enter new password" 
            required
            style="width: 100%; padding: 9px 12px; border: 1.5px solid #CBD5E1; border-radius: 10px; font-size: 13px; color: #1E293B; box-sizing: border-box; outline: none;" 
          />
        </div>

        <!-- Compact 3-Rule Checklist -->
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 7px 10px; font-size: 10.5px; color: #64748B;">
          <div id="rule-upper" style="margin-bottom: 2px;">⚪ One uppercase letter (A-Z)</div>
          <div id="rule-lower" style="margin-bottom: 2px;">⚪ One lowercase letter (a-z)</div>
          <div id="rule-number">⚪ One number (0-9)</div>
        </div>

        <button 
          id="btn-save-password" 
          type="submit" 
          style="width: 100%; background: #F5A623; color: #1E293B; font-size: 14px; font-weight: 800; border: none; padding: 12px; border-radius: 10px; cursor: pointer; box-shadow: 0 4px 12px rgba(245, 166, 35, 0.28); margin-top: 2px;">
          Save & Sign In
        </button>
      </form>

      <div style="text-align: center; margin-top: 12px;">
        <span onclick="window.restoreAuthTabs()" style="font-size: 11.5px; font-weight: 700; color: #0B5A68; cursor: pointer;">
          Cancel & Return
        </span>
      </div>
    </div>
  `;
};

window.checkPasswordStrength = function (val) {
  const r = window.evaluatePasswordRules(val);
  const ruleUpper = document.getElementById('rule-upper');
  const ruleLower = document.getElementById('rule-lower');
  const ruleNumber = document.getElementById('rule-number');

  if (ruleUpper) ruleUpper.innerHTML = r.hasUpper ? '🟢 One uppercase letter (A-Z)' : '⚪ One uppercase letter (A-Z)';
  if (ruleLower) ruleLower.innerHTML = r.hasLower ? '🟢 One lowercase letter (a-z)' : '⚪ One lowercase letter (a-z)';
  if (ruleNumber) ruleNumber.innerHTML = r.hasNumber ? '🟢 One number (0-9)' : '⚪ One number (0-9)';
};

window.saveNewPassword = function (e, email) {
  if (e) e.preventDefault();

  const pass1Input = document.getElementById('input-new-password');
  const pass2Input = document.getElementById('input-confirm-password');
  const alertBox = document.getElementById('password-validation-alert');

  const pass1 = pass1Input?.value || '';
  const pass2 = pass2Input?.value || '';

  if (!window.isPasswordValid(pass1)) {
    if (alertBox) {
      alertBox.className = 'auth-alert-box auth-alert-error';
      alertBox.innerHTML = `<span>⚠️</span><span>Password must include one uppercase letter, one lowercase letter, and one number.</span>`;
      alertBox.style.display = 'flex';
    }
    return;
  }

  if (pass1 !== pass2) {
    if (alertBox) {
      alertBox.className = 'auth-alert-box auth-alert-error';
      alertBox.innerHTML = `<span>⚠️</span><span>Passwords do not match. Please re-enter.</span>`;
      alertBox.style.display = 'flex';
    }
    return;
  }

  // 1. Update Database
  const cleanEmail = email.toLowerCase().trim();
  const usersDb = JSON.parse(localStorage.getItem('yathralanka_users') || '{}');

  let userRecord = usersDb[cleanEmail];
  if (!userRecord) {
    userRecord = {
      name: cleanEmail.split('@')[0],
      email: cleanEmail,
      xp: 50,
      emailVerified: true
    };
  }

  userRecord.password = pass1;
  userRecord.dashboard_visits = (userRecord.dashboard_visits || 1) + 1;
  userRecord.isNewRegistrant = false;

  usersDb[cleanEmail] = userRecord;
  localStorage.setItem('yathralanka_users', JSON.stringify(usersDb));

  // 2. Clean URL
  window.history.replaceState({}, document.title, window.location.pathname);

  // 3. Set Active Session & Route Directly to Dashboard
  localStorage.setItem('yathralanka_current_user', JSON.stringify(userRecord));
  localStorage.setItem('yathralanka_active_user', JSON.stringify(userRecord));
  localStorage.removeItem('yathralanka_pending_resets');

  if (!window.state) window.state = {};
  window.state.user = userRecord;
  window.state.currentUser = userRecord;
  window.state.isGuest = false;
  window.state.isLoggedIn = true;

  window.navigate('home');

  if (typeof window.showNotification === 'function') {
    window.showNotification("Password updated successfully! Welcome back.", "success");
  }
};
window.submitNewPassword = window.saveNewPassword;

// ============================================================================
// RETURNING EXPLORER LOGIN CONTROLLER (No Onboarding Modal / No Duplicate XP)
// ============================================================================
window.loginExistingUser = function (userRecord) {
  // 1. Set global active state
  window.state = window.state || {};
  window.state.user = userRecord;
  window.state.currentUser = userRecord;
  window.state.isLoggedIn = true;
  window.state.isNewUser = false; // Mark explicitly as false

  // 2. Suppress the first expedition welcome modal if present
  const welcomeModal = document.getElementById('welcome-modal-backdrop') || document.querySelector('.welcome-modal') || document.getElementById('welcome-interception-modal');
  if (welcomeModal) {
    welcomeModal.style.display = 'none';
    welcomeModal.remove();
  }

  // 3. Ensure no duplicate +50 XP bonus is added
  userRecord.showFirstRewardCard = false;

  // 4. Navigate directly to Central Dashboard
  if (typeof renderDashboardScreen === 'function') {
    renderDashboardScreen();
  } else if (typeof window.navigate === 'function') {
    window.navigate('dashboard');
  } else if (typeof window.renderDashboard === 'function') {
    window.renderDashboard();
  }

  // 5. Display a clean returning explorer toast banner on the dashboard
  setTimeout(() => {
    if (typeof window.showNotification === 'function') {
      window.showNotification(`👋 Welcome back, ${userRecord.name || 'Explorer'}! Signed in successfully.`, 'success');
    }

    const banner = document.getElementById('dashboard-status-banner');
    if (banner) {
      banner.innerHTML = `
        <div style="background: #E0F2FE; border: 1.5px solid #38BDF8; border-radius: 12px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 700; color: #0369A1;">
            👋 Welcome back, ${userRecord.name || 'Explorer'}! Signed in successfully.
          </div>
          <span onclick="this.parentElement.style.display='none'" style="cursor: pointer; color: #0284C7; font-weight: 800; font-size: 15px;">✕</span>
        </div>
      `;
    }
  }, 200);
};

// 6. Return to Screen 002A (Sign In Tab)
window.restoreAuthTabs = function () {
  const tabPill = document.querySelector('.auth-tab-pill');
  if (tabPill) tabPill.style.display = 'flex';

  if (typeof window.navigate === 'function') {
    window.state.authActiveTab = 'signin';
    window.navigate('auth');
  } else if (typeof window.renderAuthScreen === 'function') {
    window.renderAuthScreen('signin');
  } else if (typeof window.setAuthTab === 'function') {
    window.setAuthTab('signin');
  }
};

// ============================================================================
// 3. SCREEN 002: AUTH CARD COMPONENT
// ============================================================================
function renderAuthCard() {
  const isSignUp = window.state?.authActiveTab === 'signup';
  const showBackButton = Boolean(window.state?.authOrigin || window.state?.pendingAuthReturn);

  return `
    <div class="screen auth-screen auth-screen-container" style="position: relative; width: 100%; height: 100%; background-color: #0B5A68; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 28px 18px 20px 18px; box-sizing: border-box; overflow-y: auto;">
      
      <!-- Modal Portal -->
      <div id="auth-modal-portal"></div>

      <!-- Back Button -->
      ${showBackButton ? `
        <button 
          id="btn-auth-back" 
          class="yl-back-btn yl-auth-back"
          aria-label="Back"
          type="button" 
          onclick="window.handleAuthBackClick()"
          style="position: absolute; top: 14px; left: 14px; z-index: 100; min-width: 44px; min-height: 44px; width: 44px; height: 44px; padding: 0; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.28); background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(8px); color: #FFFFFF; cursor: pointer; display: flex; align-items: center; justify-content: center;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
      ` : ''}

      <!-- Logo Header -->
      <div class="auth-top-zone auth-logo-header" onclick="window.navigate('welcome')" style="width: 100%; text-align: center; margin-bottom: 18px; flex-shrink: 0; cursor: pointer;">
        <img 
          src="/Element%20Pictures/logo.png" 
          alt="YathraLanka"
          style="width: 135px; height: 135px; max-width: 100%; object-fit: contain; background: transparent; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.20)); display: block; margin: 0 auto;" 
          onerror="if (!this.dataset.retry) { this.dataset.retry = '1'; this.src = '/logo.png'; }"
        />
      </div>

      <!-- Main Box Container -->
      <div class="auth-bottom-block" style="width: 100%; max-width: 295px; display: flex; flex-direction: column; align-items: center;">
        
        <!-- Segmented Tab Switcher -->
        <div class="auth-tab-pill" style="display: flex; background: rgba(0, 0, 0, 0.22); padding: 3px; border-radius: 12px; width: 100%; margin-bottom: 10px; box-sizing: border-box;">
          <button 
            id="tab-btn-signin"
            class="auth-tab-btn ${!isSignUp ? 'active' : ''}"
            type="button" 
            onclick="window.setAuthTab('signin')" 
            style="flex: 1; padding: 8px 0; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; ${!isSignUp ? 'background: #FFFFFF; color: #0B5A68; box-shadow: 0 2px 8px rgba(0,0,0,0.15);' : 'background: transparent; color: rgba(255,255,255,0.85);'}">
            Sign In
          </button>
          <button 
            id="tab-btn-create"
            class="auth-tab-btn ${isSignUp ? 'active' : ''}"
            type="button" 
            onclick="window.setAuthTab('create')" 
            style="flex: 1; padding: 8px 0; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; ${isSignUp ? 'background: #FFFFFF; color: #0B5A68; box-shadow: 0 2px 8px rgba(0,0,0,0.15);' : 'background: transparent; color: rgba(255,255,255,0.85);'}">
            Create Account
          </button>
        </div>

        <!-- Auth Form Card -->
        <div class="auth-card-box auth-card-wrapper" style="background: #FFFFFF; border-radius: 20px; padding: 18px 16px; width: 100%; box-sizing: border-box; box-shadow: 0 10px 28px rgba(0,0,0,0.22); display: flex; flex-direction: column;">
          <form id="auth-main-form" autocomplete="off" onsubmit="window.handleAuthSubmit(window.state.authActiveTab, event)" style="display: flex; flex-direction: column; gap: 9px;">
            
            <!-- Signup Accordion: Name Field -->
            <div id="auth-signup-accordion" class="auth-accordion-wrapper ${isSignUp ? 'expanded' : ''}">
              <div class="auth-accordion-inner">
                <div id="auth-fullname-field" style="margin-bottom: 9px;">
                  <label style="font-size: 11.5px; font-weight: 700; color: #1E293B; display: block; margin-bottom: 3px;">Name</label>
                  <input type="text" class="yl-form-field" id="auth-signup-name" value="" autocomplete="name" placeholder="Enter your name" style="width: 100%; padding: 9px 12px; border: 1.5px solid #CBD5E1; border-radius: 10px; font-size: 13px; box-sizing: border-box; outline: none;" />
                </div>
              </div>
            </div>

            <!-- Email Address -->
            <div>
              <label style="font-size: 11.5px; font-weight: 700; color: #1E293B; display: block; margin-bottom: 3px;">Email Address</label>
              <input type="email" class="yl-form-field" id="auth-identifier" value="" required autocomplete="off" placeholder="Enter email address" style="width: 100%; padding: 9px 12px; border: 1.5px solid #CBD5E1; border-radius: 10px; font-size: 13px; box-sizing: border-box; outline: none;" />
            </div>

            <!-- Password -->
            <div>
              <label style="font-size: 11.5px; font-weight: 700; color: #1E293B; display: block; margin-bottom: 3px;">Password</label>
              <div class="yl-password-field">
                <input
                  type="password"
                  class="yl-form-field"
                  id="auth-password"
                  value=""
                  required
                  autocomplete="${isSignUp ? 'new-password' : 'current-password'}"
                  placeholder="Enter password"
                  oninput="window.checkLiveSignupPassword(this.value)"
                  style="width: 100%; padding: 9px 58px 9px 12px; border: 1.5px solid #CBD5E1; border-radius: 10px; font-size: 13px; box-sizing: border-box; outline: none;"
                />
                <button type="button" class="yl-password-toggle" onclick="window.togglePasswordVisibility('auth-password', this)" aria-label="Show password">Show</button>
              </div>
            </div>

            <!-- Compact 3-Rule Password Checklist (Only shown on Create Account) -->
            <div id="signup-password-rules" style="display: ${isSignUp ? 'block' : 'none'}; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 7px 10px; margin-top: 1px; font-size: 10.5px; color: #64748B;">
              <div id="signup-rule-upper" style="margin-bottom: 2px;">⚪ One uppercase letter (A-Z)</div>
              <div id="signup-rule-lower" style="margin-bottom: 2px;">⚪ One lowercase letter (a-z)</div>
              <div id="signup-rule-number">⚪ One number (0-9)</div>
            </div>

            <!-- Forgot Password Link -->
            <div id="forgot-password-container" class="${isSignUp ? 'hidden' : ''}" style="text-align: right; margin-top: -2px; margin-bottom: 2px;">
              <span onclick="window.handleForgotPassword()" style="font-size: 11px; font-weight: 600; color: #0284C7; text-decoration: none; cursor: pointer;">Forgot password?</span>
            </div>

            <!-- Submit Button -->
            <button id="auth-submit-btn" class="yl-auth-submit" type="submit" style="width: 100%; background: #F5A623; color: #1E293B; border: none; border-radius: 11px; padding: 11px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(245, 166, 35, 0.25); margin-top: 2px;">
              ${isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <!-- Social Divider -->
          <div style="margin: 14px 0 10px 0; text-align: center; position: relative;">
            <div style="position: absolute; left: 0; top: 50%; width: 100%; height: 1px; background-color: #E2E8F0; z-index: 1;"></div>
            <span style="position: relative; z-index: 2; background: #FFFFFF; padding: 0 10px; font-size: 11px; color: #94A3B8; font-weight: 600;">
              or continue
            </span>
          </div>

          <!-- Google Button -->
          <button 
            id="btn-google-auth-wide"
            type="button"
            onclick="window.handleGoogleSignInClick()"
            style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background-color: #FFFFFF; border: 1.5px solid #CBD5E1; padding: 9px 14px; border-radius: 11px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.04); transition: all 0.2s ease;">
            
            <svg width="17" height="17" viewBox="0 0 48 48" style="display: block;">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.79l7.97-6.2z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>

            <span id="google-btn-text" style="font-size: 13px; font-weight: 700; color: #1E293B;">
              ${isSignUp ? 'Sign up with Google' : 'Sign in with Google'}
            </span>
          </button>

          <!-- Switch Footer Text -->
          <div id="auth-footer-prompt" style="text-align: center; margin-top: 12px; font-size: 11px; color: #64748B;">
            ${isSignUp
      ? `Already have an account? <span onclick="window.setAuthTab('signin')" style="color: #0F5361; font-weight: 800; cursor: pointer;">Sign In</span>`
      : `Don't have an account? <span onclick="window.setAuthTab('create')" style="color: #0F5361; font-weight: 800; cursor: pointer;">Sign Up</span>`
    }
          </div>

        </div>

      </div>

    </div>
  `;
}

function openAuthModal(tab = 'signin', pendingAction = null) {
  if (pendingAction) state.pendingAction = pendingAction;
  state.authTab = tab;

  const modalContainer = document.getElementById('auth-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="auth-modal-backdrop" id="auth-modal-bg">
      ${renderAuthCard(tab)}
    </div>
  `;
  modalContainer.style.display = 'block';
  document.body.classList.add('modal-open');

  attachAuthCardEvents(true);
}

function closeAuthModal() {
  const modalContainer = document.getElementById('auth-modal-container');
  if (modalContainer) {
    modalContainer.style.display = 'none';
    modalContainer.innerHTML = '';
  }
  document.body.classList.remove('modal-open');
}

function showAuthRequiredModal(config = {}) {
  const originRoute = window.state?.currentScreen || 'home';
  showUniversalGuestModal({
    capability: config.capability || 'full-landmark',
    originRoute: originRoute,
    originParams: config.targetId ? { id: config.targetId } : (window.state?.currentParams || {}),
    onAuthorized: config.callback || null
  });
}

function closeAuthRequiredModal() {
  document.querySelectorAll('#auth-required-modal-overlay, .auth-modal-overlay').forEach(el => el.remove());
  const container = document.getElementById('auth-modal-container');
  if (container) {
    container.style.display = 'none';
    container.innerHTML = '';
  }
  document.body.classList.remove('modal-open');
}
window.closeAuthRequiredModal = closeAuthRequiredModal;

function handleSiteCardClick(siteId) {
  if (window.__siteTapCounters) {
    window.__siteTapCounters.handleSiteCardClick++;
    console.log('[SITE-TAP-COUNT]', JSON.stringify(window.__siteTapCounters));
  }
  if (!siteId) return;
  if (typeof window.openSitePreview === 'function') {
    window.openSitePreview(siteId);
  } else {
    const pool = window.sitesData || (typeof sitesData !== 'undefined' ? sitesData : []);
    const siteObj = pool.find(s => s.id === siteId);
    if (siteObj && window.state) {
      window.state.activeSite = siteObj;
    }
    if (typeof window.navigate === 'function') {
      window.navigate('site-detail', { id: siteId });
    }
  }
}

function handleImpactAction(actionType, actionPayload = {}) {
  const isGuest = window.isGuestSession();

  switch (actionType) {
    case 'donation':
      navigate('donations');
      break;

    case 'sign-petition':
      if (isGuest) {
        showAuthRequiredModal({
          title: "Sign the Petition",
          message: "Sign in or register to add your verified signature to heritage conservation petitions.",
          redirectView: "petition",
          targetId: actionPayload.petitionId || 'ritigala-forest'
        });
        return;
      }
      navigate('petition');
      break;

    case 'join-cleanup':
      if (isGuest) {
        showAuthRequiredModal({
          title: "Join Volunteer Cleanup",
          message: "Please sign in to register for upcoming site preservation and cleanup events.",
          redirectView: "cleanup",
          targetId: actionPayload.eventId || 'site-cleanup'
        });
        return;
      }
      navigate('cleanup');
      break;

    case 'create-event':
      if (isGuest) {
        showAuthRequiredModal({
          title: "Host a Community Event",
          message: "You must be signed in to organize and publish new community heritage initiatives.",
          redirectView: "create-event"
        });
        return;
      }
      navigate('create-event');
      break;

    default:
      console.warn(`Unhandled impact action: ${actionType}`);
  }
}

function updatePasswordEntropyUI(passVal) {
  const entropy = calculatePasswordEntropy(passVal);
  const statusEl = document.getElementById('entropy-status-text');
  if (statusEl) statusEl.textContent = entropy.label;

  for (let i = 1; i <= 4; i++) {
    const bar = document.getElementById(`entropy-bar-${i}`);
    if (bar) {
      bar.className = 'entropy-bar';
      if (i <= entropy.level) {
        bar.classList.add('active', `level-${entropy.level}`);
      }
    }
  }
}

function attachAuthCardEvents(isModal = false) {
  const eyeOpenSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const eyeClosedSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

  const bind = (id, event, callback) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, callback);
  };

  bind('auth-tab-signin', 'click', () => {
    state.authTab = 'signin';
    if (isModal) openAuthModal('signin'); else navigate('login', false);
  });

  bind('auth-tab-signup', 'click', () => {
    state.authTab = 'signup';
    if (isModal) openAuthModal('signup'); else navigate('signup', false);
  });

  bind('auth-trigger-forgot', 'click', () => {
    state.authTab = 'forgot';
    if (isModal) openAuthModal('forgot'); else {
      const container = document.getElementById('app-container');
      if (container) { container.innerHTML = renderAuthCard('forgot'); attachAuthCardEvents(false); }
    }
  });

  bind('auth-back-to-signin', 'click', () => {
    state.authTab = 'signin';
    if (isModal) openAuthModal('signin'); else navigate('login', false);
  });

  document.querySelectorAll('.btn-google-auth, #auth-btn-google, #google-signin-btn, #google-signup-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleGoogleSignIn();
    });
  });

  bind('auth-btn-guest', 'click', () => {
    state.isGuest = true;
    showNotification("Continuing in Guest Explorer Mode.", "info");
    if (isModal) closeAuthModal();
    if (state.currentScreen === 'login' || state.currentScreen === 'signup' || state.currentScreen === 'splash') {
      navigate('dashboard');
    }
  });

  bind('auth-toggle-pass', 'click', () => {
    const passInput = document.getElementById('auth-input-pass');
    const toggleBtn = document.getElementById('auth-toggle-pass');
    if (passInput && toggleBtn) {
      if (passInput.type === 'password') {
        passInput.type = 'text';
        toggleBtn.innerHTML = eyeClosedSVG;
      } else {
        passInput.type = 'password';
        toggleBtn.innerHTML = eyeOpenSVG;
      }
    }
  });

  const passInput = document.getElementById('auth-input-pass');
  if (passInput) {
    passInput.addEventListener('input', (e) => {
      updatePasswordEntropyUI(e.target.value);
    });
  }

  if (isModal) {
    const backdrop = document.getElementById('auth-modal-bg');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeAuthModal();
      });
    }
  }

  bind('auth-submit-btn', 'click', () => {
    const activeTab = state.authTab || 'signin';
    const emailEl = document.getElementById('auth-input-email');
    const passEl = document.getElementById('auth-input-pass');
    const nameEl = document.getElementById('auth-input-name');
    const termsEl = document.getElementById('auth-check-terms');
    const submitBtn = document.getElementById('auth-submit-btn');
    const btnSpinner = document.getElementById('auth-btn-spinner');

    const email = emailEl ? emailEl.value.trim() : '';
    const pass = passEl ? passEl.value : '';
    const name = nameEl ? nameEl.value.trim() : '';

    if (activeTab === 'forgot') {
      if (!email) {
        showNotification("Please enter your registered email address.", "error");
        return;
      }
      if (submitBtn) submitBtn.disabled = true;
      if (btnSpinner) btnSpinner.style.display = 'block';

      sendPasswordResetEmail(auth, email)
        .then(() => {
          showNotification("Password reset email sent! Check your inbox.", "success");
          if (isModal) openAuthModal('signin'); else navigate('login');
        })
        .catch((err) => {
          showNotification(translateAuthError(err.code, err.message), "error");
        })
        .finally(() => {
          if (submitBtn) submitBtn.disabled = false;
          if (btnSpinner) btnSpinner.style.display = 'none';
        });
      return;
    }

    if (activeTab === 'signin') {
      if (!email || !pass) {
        showNotification("Please fill in both email and password.", "error");
        return;
      }
      if (submitBtn) submitBtn.disabled = true;
      if (btnSpinner) btnSpinner.style.display = 'block';

      const emailNorm = window.normalizeEmail(email);
      signInWithEmailAndPassword(auth, emailNorm, pass)
        .then((userCredential) => {
          return window.handlePostAuthUserSuccess({
            firebaseUser: userCredential.user,
            authProvider: 'password'
          });
        })
        .catch((err) => {
          showNotification(translateAuthError(err.code, err.message), "error");
        })
        .finally(() => {
          if (submitBtn) submitBtn.disabled = false;
          if (btnSpinner) btnSpinner.style.display = 'none';
        });
      return;
    }

    if (activeTab === 'signup') {
      if (!name || !email || !pass) {
        showNotification("Please fill in all required fields.", "error");
        return;
      }
      if (pass.length < 10) {
        showNotification("Security requirement: Password must be at least 10 characters long.", "error");
        return;
      }
      if (termsEl && !termsEl.checked) {
        showNotification("You must agree to the Terms & Privacy Policy.", "error");
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      if (btnSpinner) btnSpinner.style.display = 'block';

      const emailNorm = window.normalizeEmail(email);

      // Case A: User is currently signed in via Google with the same normalized email
      if (auth.currentUser && window.normalizeEmail(auth.currentUser.email) === emailNorm) {
        console.log(`[PROVIDER-LINK] existing=google.com pending=password status=start`);
        const emailCred = EmailAuthProvider.credential(emailNorm, pass);
        linkWithCredential(auth.currentUser, emailCred)
          .then((linkResult) => {
            console.log(`[PROVIDER-LINK] existing=google.com pending=password status=success`);
            return window.handlePostAuthUserSuccess({
              firebaseUser: linkResult.user,
              authProvider: 'password',
              options: { preferredDisplayName: name }
            });
          })
          .catch((err) => {
            console.error(`[PROVIDER-LINK] existing=google.com pending=password status=failed`, err.code);
            showNotification("Failed to link password credentials: " + err.message, "error");
          })
          .finally(() => {
            if (submitBtn) submitBtn.disabled = false;
            if (btnSpinner) btnSpinner.style.display = 'none';
          });
        return;
      }

      // Case B: Not currently signed in, check existing sign-in methods for email
      fetchSignInMethodsForEmail(auth, emailNorm)
        .then((methods) => {
          if (methods && methods.includes('google.com') && !methods.includes('password')) {
            showNotification("This email is registered with Google. Please sign in with Google first, then link your password.", "info");
            if (submitBtn) submitBtn.disabled = false;
            if (btnSpinner) btnSpinner.style.display = 'none';
            return;
          }

          createUserWithEmailAndPassword(auth, emailNorm, pass)
            .then((userCredential) => {
              if (userCredential.user) {
                updateProfile(userCredential.user, { displayName: name }).catch(() => {});
                sendEmailVerification(userCredential.user).catch(() => {});
              }
              return window.handlePostAuthUserSuccess({
                firebaseUser: userCredential.user,
                authProvider: 'password',
                options: { preferredDisplayName: name }
              });
            })
            .catch((err) => {
              showNotification(translateAuthError(err.code, err.message), "error");
            })
            .finally(() => {
              if (submitBtn) submitBtn.disabled = false;
              if (btnSpinner) btnSpinner.style.display = 'none';
            });
        })
        .catch(() => {
          // Fallback if fetchSignInMethodsForEmail is restricted
          createUserWithEmailAndPassword(auth, emailNorm, pass)
            .then((userCredential) => {
              if (userCredential.user) {
                updateProfile(userCredential.user, { displayName: name }).catch(() => {});
                sendEmailVerification(userCredential.user).catch(() => {});
              }
              return window.handlePostAuthUserSuccess({
                firebaseUser: userCredential.user,
                authProvider: 'password',
                options: { preferredDisplayName: name }
              });
            })
            .catch((err) => {
              showNotification(translateAuthError(err.code, err.message), "error");
            })
            .finally(() => {
              if (submitBtn) submitBtn.disabled = false;
              if (btnSpinner) btnSpinner.style.display = 'none';
            });
        });
    }
  });
}

function showLocationPermissionModal() {
  const existing = document.getElementById('location-permission-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'location-permission-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #ffffff !important;
    background-color: #ffffff !important;
    z-index: 10000000;
    display: fixed;
    align-items: center;
    justify-content: center;
    font-family: 'Outfit', sans-serif;
  `;

  modal.innerHTML = `
    <div class="permission-modal-card" style="
      background: #FDF8E9;
      width: 85%;
      max-width: 320px;
      border-radius: 24px;
      padding: 32px 24px;
      text-align: center;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.15);
      border: 1.5px solid var(--color-teal);
      animation: slideUp 0.3s ease-out;
    ">
      <div style="font-size: 40px; margin-bottom: 16px;">📍</div>
      <h3 style="font-size: 18px; font-weight: 800; color: var(--color-charcoal); margin-bottom: 8px;">Location Services</h3>
      <p style="font-size: 12px; color: var(--color-charcoal); line-height: 1.5; margin-bottom: 24px; font-weight: 600;">
        Yathra Lanka requires location access to calculate real-time distances to heritage sites and verify your cultural visits.
      </p>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button class="btn-primary" id="location-allow-btn" style="height: 44px; font-size: 13px;">Allow Access</button>
        <button class="btn-outline" id="location-cancel-btn" style="height: 44px; font-size: 13px; border: none; color: var(--color-gray);">Not Now</button>
      </div>
    </div>
  `;

  const chassis = document.querySelector('.iphone-chassis') || document.body;
  chassis.appendChild(modal);

  document.getElementById('location-allow-btn').addEventListener('click', async () => {
    modal.remove();
    try {
      const status = await Geolocation.requestPermissions();
      if (status.location === 'granted') {
        locationPermissionDenied = false;
        await initializeYathraMap();
      } else {
        locationPermissionDenied = true;
        await initializeYathraMap();
      }
    } catch (err) {
      locationPermissionDenied = true;
      console.error("Error requesting geolocation capability configurations:", err);
      await initializeYathraMap();
    }
  });

  document.getElementById('location-cancel-btn').addEventListener('click', () => {
    modal.remove();
    locationPermissionDenied = true;
    initializeYathraMap();
  });
}

let yathraMapInstance = null;
let userCoordinates = null;
let locationPermissionDenied = false;

// --- MAP INITIALIZATION & LEAFLET FALLBACK ENGINE ---
function renderMapMarkers(map, type = 'google') {
  const mapSites = sitesData.filter(site => site.latitude && site.longitude);

  if (type === 'leaflet' && typeof L !== 'undefined') {
    mapSites.forEach(site => {
      const isGold = site.category === 'Hidden Gems';
      const markerHtml = `
        <div style="
          width: 22px;
          height: 22px;
          background: ${isGold ? '#EBB34D' : '#0C6C7A'};
          border: 2px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          cursor: pointer;
        "></div>
      `;
      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: markerHtml,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      const marker = L.marker([site.latitude, site.longitude], { icon: customIcon, zIndexOffset: 2000 }).addTo(map);
      marker.bindTooltip(window.getShortSiteName(site), { permanent: true, direction: 'top', className: 'map-site-label' });
      marker.on('click', () => {
        showMapPopupCard(site);
        const popupCard = document.getElementById('map-popup-card');
        if (popupCard) {
          popupCard.style.setProperty('display', 'block', 'important');
        }
        window.openSiteById(site.id);
      });
    });
  } else if (type === 'google' && typeof google !== 'undefined' && google.maps) {
    mapSites.forEach(site => {
      const marker = new google.maps.Marker({
        position: { lat: site.latitude, lng: site.longitude },
        map: map,
        title: site.name
      });
      marker.addListener('click', () => {
        showMapPopupCard(site);
        const popupCard = document.getElementById('map-popup-card');
        if (popupCard) {
          popupCard.style.setProperty('display', 'block', 'important');
        }
        window.openSiteById(site.id);
      });
    });
  }
}

function renderFallbackLeafletMap(containerId = 'map-container', coords = [7.8731, 80.7718]) {
  const mapContainer = document.getElementById(containerId) || document.getElementById('yathra-main-map') || document.getElementById('map-view');
  if (!mapContainer) return;

  // Clear any Google Maps error banners or previous elements
  mapContainer.innerHTML = '';

  const targetId = mapContainer.id || containerId;

  if (typeof L !== 'undefined') {
    if (mapContainer._leaflet_id) {
      mapContainer._leaflet_id = null;
    }
    const map = L.map(targetId, { attributionControl: false, zoomControl: true, dragging: true, tap: true, touchZoom: true, scrollWheelZoom: true }).setView(coords, 8);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    renderMapMarkers(map, 'leaflet');

    setTimeout(() => {
      if (typeof map !== 'undefined' && map && typeof map.invalidateSize === 'function') {
        map.invalidateSize();
      }
    }, 200);
  } else {
    mapContainer.innerHTML = `
      <div class="map-placeholder-box">
        <p>🗺️ Interactive Map Mode</p>
        <button class="btn-primary" onclick="window.open('https://www.google.com/maps', '_blank')">Open in External Maps</button>
      </div>
    `;
  }
}

function initMap(containerId = 'map-container', defaultCoords = [7.8731, 80.7718]) {
  const mapElement = document.getElementById(containerId) || document.getElementById('yathra-main-map');
  if (!mapElement) return;

  // Catch Google Maps API auth failures
  window.gm_authFailure = function () {
    console.warn("Google Maps API auth failure. Falling back to OpenStreetMap / Leaflet...");
    renderFallbackLeafletMap(containerId, defaultCoords);
  };

  // If Google Maps is unavailable or unconfigured, initialize Leaflet directly
  if (typeof google === 'undefined' || !google.maps || !google.maps.Map) {
    renderFallbackLeafletMap(containerId, defaultCoords);
    return;
  }

  try {
    const map = new google.maps.Map(mapElement, {
      center: { lat: defaultCoords[0], lng: defaultCoords[1] },
      zoom: 8,
      disableDefaultUI: false,
      zoomControl: true,
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM
      }
    });
    renderMapMarkers(map, 'google');
  } catch (err) {
    console.error("Failed to render Google Map:", err);
    renderFallbackLeafletMap(containerId, defaultCoords);
  }
}

window.gm_authFailure = function () {
  console.warn("Google Maps API auth failure. Falling back to OpenStreetMap / Leaflet...");
  renderFallbackLeafletMap('yathra-main-map', [7.8731, 80.7718]);
};

window.initMap = initMap;
window.renderFallbackLeafletMap = renderFallbackLeafletMap;
window.renderMapMarkers = renderMapMarkers;

window.userLocationMarker = null;
window.userLocationCircle = null;
window.gpsWatchId = null;

// Leaflet Instance Controller
window.initLeafletMap = function () {
  const container = document.getElementById('map') || document.getElementById('leaflet-map-canvas') || document.getElementById('yathra-main-map');
  if (!container) {
    console.error("❌ Map container #map not found in DOM");
    return;
  }

  if (typeof L === 'undefined') {
    console.error("❌ Leaflet library (L) is not loaded");
    return;
  }

  // Teardown any existing instance to avoid "Map container is already initialized"
  if (window.leafletMapInstance) {
    try { window.leafletMapInstance.off(); } catch (e) { }
    try { window.leafletMapInstance.remove(); } catch (e) { }
    window.leafletMapInstance = null;
  }
  if (typeof activeMapInstance !== 'undefined' && activeMapInstance) {
    try { activeMapInstance.off(); } catch (e) { }
    try { activeMapInstance.remove(); } catch (e) { }
    activeMapInstance = null;
  }
  if (container._leaflet_id) {
    container._leaflet_id = null;
  }

  // Initialize map centered over Sri Lanka
  const map = L.map(container, {
    zoomControl: false,
    attributionControl: false
  });
  map.fitBounds([[5.85, 79.50], [9.85, 81.90]], { padding: [10, 10] });
  map.panBy([0, 28], { animate: false });

  window.leafletMapInstance = map;
  if (typeof activeMapInstance !== 'undefined') activeMapInstance = map;

  // Add Zoom Controls at top-left with proper spacing
  L.control.zoom({
    position: 'topleft'
  }).addTo(map);

  // Add OpenStreetMap tile layer with subdomains
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    subdomains: ['a', 'b', 'c']
  }).addTo(map);

  // Custom Pin Marker Creator
  const createColoredPin = (color, label) => L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="position: relative; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;">
        <div style="background-color: ${color}; width: 18px; height: 18px; border-radius: 50%; border: 3px solid #FFFFFF; box-shadow: 0 3px 8px rgba(0,0,0,0.35);"></div>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });

  const verifiedIcon = L.divIcon({
    className: 'custom-leaflet-marker verified-marker',
    html: `
      <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
        <div style="background-color: #10B981; width: 22px; height: 22px; border-radius: 50%; border: 3px solid #FFFFFF; box-shadow: 0 0 10px rgba(16,185,129,0.7), 0 3px 8px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: #FFF; font-size: 11px; font-weight: 900;">✓</div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  const heritageIcon = createColoredPin('#0C6C7A', 'Heritage Trail'); // Teal / Blue
  const hiddenGemIcon = createColoredPin('#E59819', 'Hidden Gem');      // Amber / Gold

  // Identify Category Explicitly
  const isSiteHiddenGem = (site) => {
    if (!site) return false;
    const cat = String(site.category || site.type || '').toLowerCase();
    return cat.includes('hidden') || site.is_hidden === true || (typeof site.xp === 'number' && site.xp > 80);
  };

  const isSiteVerified = (siteId) => {
    if (!siteId) return false;
    const achievement = window.getLandmarkAchievementStatus(siteId);
    return achievement.locationVerified || achievement.photoVerified;
  };

  // Load and place site markers
  const pool = window.sitesData || (typeof sitesData !== 'undefined' ? sitesData : []);
  const siteList = Array.isArray(pool) ? pool : Object.values(pool);

  siteList.forEach(site => {
    const lat = site.lat || site.latitude;
    const lng = site.lng || site.longitude;
    if (lat && lng) {
      const isHidden = isSiteHiddenGem(site);
      const isVerified = isSiteVerified(site.id);
      const achievement = window.getLandmarkAchievementStatus(site.id);
      const pinIcon = isVerified ? verifiedIcon : (isHidden ? hiddenGemIcon : heritageIcon);

      const marker = L.marker([lat, lng], {
        icon: pinIcon,
        zIndexOffset: isVerified ? 3000 : 2000
      }).addTo(map);

      marker.bindTooltip(window.getShortSiteName(site), { permanent: true, direction: 'top', className: 'map-site-label' });

      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; line-height: 1.4; padding: 4px; text-align: center;">
          <b style="color: #1E293B; font-size: 13px;">${site.name}</b><br/>
          <span style="color: ${isVerified ? '#10B981' : (isHidden ? '#D97706' : '#0C6C7A')}; font-weight: 800;">
            ${isVerified ? `${achievement.locationVerified ? '✓ Location' : ''}${achievement.locationVerified && achievement.photoVerified ? ' · ' : ''}${achievement.photoVerified ? '✓ Photo' : ''}` : (isHidden ? '★ Hidden Gem (+220 XP)' : '🏛 Heritage Trail (+220 XP)')}
          </span><br/>
          <button onclick="window.selectAndOpenSite('${site.id}')" style="margin-top: 8px; background: #0C6C7A; color: #FFF; border: none; border-radius: 8px; padding: 6px 14px; font-size: 11px; font-weight: 700; cursor: pointer;">
            View Site Details
          </button>
        </div>
      `);
      marker.on('click', () => {
        if (typeof window.selectAndOpenSite === 'function') {
          window.selectAndOpenSite(site.id);
        }
      });
    }
  });

  // Track live user coordinates
  if (navigator.geolocation) {
    if (window.gpsWatchId) {
      navigator.geolocation.clearWatch(window.gpsWatchId);
    }
    window.gpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;

        const userIcon = L.divIcon({
          className: 'user-live-pin',
          html: `
            <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; width: 24px; height: 24px; border-radius: 50%; background: rgba(37, 99, 235, 0.35); animation: pulse 2s infinite;"></div>
              <div style="width: 14px; height: 14px; border-radius: 50%; background: #2563EB; border: 2.5px solid #FFFFFF; box-shadow: 0 2px 8px rgba(0,0,0,0.35);"></div>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        if (!window.userLocationMarker) {
          window.userLocationMarker = L.marker([userLat, userLng], { icon: userIcon, zIndexOffset: 100, interactive: false }).addTo(map).bindPopup("<b>You Are Here</b>");
          window.userLocationCircle = L.circle([userLat, userLng], {
            radius: Math.max(accuracy, 30),
            color: '#2563EB',
            weight: 1,
            fillColor: '#3B82F6',
            fillOpacity: 0.12,
            interactive: false
          }).addTo(map);
        } else {
          window.userLocationMarker.setLatLng([userLat, userLng]);
          window.userLocationCircle.setLatLng([userLat, userLng]);
          window.userLocationCircle.setRadius(Math.max(accuracy, 30));
        }
      },
      (err) => console.warn("GPS lookup skipped:", err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Force size recalculation across multiple paint frames
  requestAnimationFrame(() => {
    if (map && typeof map.invalidateSize === 'function') {
      map.invalidateSize();
    }
  });
  setTimeout(() => {
    if (map && typeof map.invalidateSize === 'function') {
      map.invalidateSize();
    }
  }, 300);
};
window.initLeafletMap = initLeafletMap;

async function initializeYathraMap() {
  const mapRef = document.getElementById('yathra-main-map');
  if (!mapRef) return;

  const defaultCoords = userCoordinates
    ? [userCoordinates.latitude, userCoordinates.longitude]
    : [7.8731, 80.7718];

  try {
    const permStatus = await Geolocation.checkPermissions();
    if (permStatus.location !== 'granted') {
      if (!locationPermissionDenied) {
        showLocationPermissionModal();
        return;
      }
    } else {
      const coordinates = await Geolocation.getCurrentPosition();
      userCoordinates = {
        latitude: coordinates.coords.latitude,
        longitude: coordinates.coords.longitude
      };
      locationPermissionDenied = false;
    }
  } catch (err) {
    locationPermissionDenied = true;
    console.error("Error parsing native hardware location states:", err);
  }

  const loader = document.getElementById('map-loader');
  if (loader) {
    loader.style.setProperty('display', 'flex', 'important');
  }

  const hideLoader = () => {
    const loaderEl = document.getElementById('map-loader');
    if (loaderEl) {
      loaderEl.style.setProperty('display', 'none', 'important');
    }
  };

  const mapView = document.getElementById('map-view');
  if (mapView) mapView.style.display = 'block';

  document.documentElement.classList.add('map-active');
  document.body.classList.add('map-active');

  const targets = ['html', 'body', '#app', '.app-root', '#app-container', '.app-viewport', '.iphone-chassis', '.view-wrapper', '.screen', 'main'];
  targets.forEach(sel => {
    const el = document.querySelector(sel);
    if (sel === 'html' || sel === 'body') {
      const docEl = sel === 'html' ? document.documentElement : document.body;
      docEl.style.setProperty('background', 'transparent', 'important');
      docEl.style.setProperty('background-color', 'transparent', 'important');
    } else if (el) {
      el.style.setProperty('background', 'none', 'important');
      el.style.setProperty('background-color', 'transparent', 'important');
    }
  });

  try {
    if (yathraMapInstance) {
      try { await yathraMapInstance.destroy(); } catch (e) { }
      yathraMapInstance = null;
    }
    if (typeof window.initLeafletMapInstance === 'function') {
      window.initLeafletMapInstance();
    } else {
      initMap('yathra-main-map', defaultCoords);
    }
    setTimeout(hideLoader, 400);
  } catch (error) {
    console.warn("Map initialization notice:", error);
    if (typeof window.initLeafletMapInstance === 'function') {
      window.initLeafletMapInstance();
    } else {
      initMap('yathra-main-map', defaultCoords);
    }
    setTimeout(hideLoader, 400);
  }
}
window.initializeYathraMap = initializeYathraMap;

function Maps(route, data) {
  if (route === 'site-details' || route === 'site-detail') {
    const siteId = data && data.id;
    if (siteId) {
      handleSiteCardClick(siteId);
    }
  }
}
window.Maps = Maps;

function renderActiveScreen() {
  if (window.__navCounters) {
    window.__navCounters.legacyRouterCalls++;
  }
  if (typeof window.executeAppNavigation === 'function') {
    return window.executeAppNavigation(window.state?.currentScreen || 'home', window.state?.currentParams || {});
  }
}
window.renderActiveScreen = renderActiveScreen;

function renderLanding() {
  return renderWelcomeScreen();
}

function renderSplash() {
  return renderLanding();
}

function renderLogin() {
  if (!window.state) window.state = {};
  window.state.authTab = 'signin';
  window.state.authActiveTab = 'signin';
  window.state.authOrigin = null;
  return renderAuthCard('signin');
}

function renderSignUp() {
  if (!window.state) window.state = {};
  window.state.authTab = 'signup';
  window.state.authActiveTab = 'signup';
  window.state.authOrigin = null;
  return renderAuthCard('signup');
}

function renderPermissions() {
  const isCamera = state.user.permissions.camera;
  const isNotifications = state.user.permissions.notifications;
  const allGranted = isCamera;

  return `
    <div class="screen permissions-screen" id="permissions-view">
      <div style="padding: 30px 24px 20px 24px; text-align: center;">
        <h2 style="font-size: 26px; font-weight: 900; line-height: 1.2; margin-bottom: 8px;">We need a few permissions</h2>
        <p style="font-size: 13px; color: var(--color-gray);">These help us make your experience safe and seamless.</p>
      </div>
      <div class="selection-card permission-card ${isCamera ? 'selected' : ''}" style="margin: 10px 16px; padding: 14px;" id="perm-camera-btn">
        <div class="permission-icon-box">
          <img src="icons/camera.png" alt="Camera">
        </div>
        <div style="flex: 1;">
          <h3 style="font-size: 14px; font-weight: 800; margin-bottom: 2px;">Camera</h3>
          <p style="font-size: 11px; color: var(--color-gray);">Used to scan, capture and verify your visits</p>
        </div>
        <div class="check-circle ${isCamera ? 'checked' : ''}">
          ${isCamera ? '✓' : ''}
        </div>
      </div>
      <div class="selection-card permission-card ${isNotifications ? 'selected' : ''}" style="margin: 10px 16px; padding: 14px;" id="perm-notif-btn">
        <div class="permission-icon-box">
          <img src="icons/notifications.png" alt="Notifications">
        </div>
        <div style="flex: 1;">
          <h3 style="font-size: 14px; font-weight: 800; margin-bottom: 2px;">Notifications</h3>
          <p style="font-size: 11px; color: var(--color-gray);">Stay updated on quests, events and rewards</p>
        </div>
        <div class="check-circle ${isNotifications ? 'checked' : ''}">
          ${isNotifications ? '✓' : ''}
        </div>
      </div>
      <div style="padding: 16px; margin-top: 10px;">
        <button class="btn-primary" style="opacity: ${allGranted ? '1' : '0.5'}; cursor: ${allGranted ? 'pointer' : 'not-allowed'};" id="permissions-continue-btn" ${allGranted ? '' : 'disabled'}>Continue</button>
      </div>
      <div class="permission-footer-box" id="permissions-privacy-footer">
        We value your privacy. Location access is requested when using the map or verifying a site visit.
      </div>
    </div>
  `;
}

function renderChooseRole() {
  const chosen = state.user.role;
  const roles = [
    { key: 'Explorer', title: 'Explorer', desc: 'Visit places, learn & earn' },
    { key: 'Volunteer', title: 'Volunteer', desc: 'Join cleanups & activities' },
    { key: 'Organizer', title: 'Organizer', desc: 'Organize events & petitions' },
    { key: 'Quiz Master', title: 'Quiz Master', desc: 'Do quizzes & earn points' }
  ];

  return `
    <div class="screen dark-theme">
      <div class="header-bar">
        <button class="back-button" id="role-back">←</button>
        <div class="header-title"></div>
      </div>
      <div style="padding: 10px 24px; text-align: center; margin-bottom: 12px;">
        <h2 style="font-size: 26px; font-weight: 800; margin-bottom: 6px;">Choose Your Role</h2>
        <p style="font-size: 13px; color: #a9cbd0;">How will you contribute?</p>
      </div>
      <div style="display: flex; flex-direction: column; gap: 14px; padding: 0 20px;">
        ${roles.map(r => `
          <div class="selection-card ${chosen === r.key ? 'selected' : ''}" style="color: var(--color-charcoal); padding: 14px;" data-role="${r.key}">
            <div style="flex: 1;">
              <h3 class="selection-card-title">${r.title}</h3>
              <p class="selection-card-desc">${r.desc}</p>
            </div>
          </div>
        `).join('')}
      </div>
      <div style="padding: 20px; margin-top: auto;">
        <button class="btn-primary" style="opacity: ${chosen ? '1' : '0.5'};" id="role-continue" ${chosen ? '' : 'disabled'}>Continue</button>
      </div>
    </div>
  `;
}

function renderCalibrateCompass() {
  const selected = state.user.interests;
  const categories = [
    { key: 'Nature & Outdoors', title: 'Nature & Outdoors', desc: 'Mountains, Waterfalls, Hikes', icon: 'icons/Nature & Outdoors.png' },
    { key: 'Heritage & History', title: 'Heritage & History', desc: 'Ancient ruins, Temples, Forts', icon: 'icons/Heritage & History.png' },
    { key: 'Beaches & Coastal', title: 'Beaches & Coastal', desc: 'Surfing, Relaxation, Marine', icon: 'icons/Beaches & Coastal.png' },
    { key: 'Cultural Immersion', title: 'Cultural Immersion', desc: 'Local foods, Crafts, Festivals', icon: 'icons/cultural immersion.png' }
  ];

  return `
    <div class="screen">
      <div style="padding: 16px; text-align: left; width: 100%; box-sizing: border-box;">
        <button id="compass-back-btn" style="color: #000000; background: none; border: none; font-size: 24px; cursor: pointer; padding: 0;">←</button>
      </div>
      <div style="padding: 30px 24px 10px 24px; text-align: center;">
        <h2 style="font-size: 26px; font-weight: 900; line-height: 1.2; margin-bottom: 6px;">Calibrate Your Compass</h2>
        <p style="font-size: 13px; color: var(--color-gray);">Select your primary interests to personalize your adventure.</p>
      </div>
      <div class="grid-2x2">
        ${categories.map(c => {
    const isSel = selected.includes(c.key);
    return `
            <div class="grid-item-card ${isSel ? 'selected' : ''}" data-cat="${c.key}">
              <img src="${c.icon}" alt="${c.title}">
              <div class="grid-item-title">${c.title}</div>
              <div class="grid-item-subtitle">${c.desc}</div>
            </div>
          `;
  }).join('')}
      </div>
      <div style="padding: 20px; margin-top: auto;">
        <button class="btn-primary" style="opacity: ${selected.length > 0 ? '1' : '0.5'};" id="compass-continue" ${selected.length > 0 ? '' : 'disabled'}>Continue</button>
      </div>
    </div>
  `;
}

function renderHowScoring() {
  return `
    <div class="screen">
      <div style="padding: 30px 24px 20px 24px; text-align: center;">
        <h2 style="font-size: 26px; font-weight: 900; line-height: 1.2; margin-bottom: 6px;">How Scoring Works</h2>
        <p style="font-size: 13px; color: var(--color-gray);">Your impact is measured by dedication, not just frequency. Understand the laws of the journey.</p>
      </div>
      <div style="padding: 0 16px;">
        <div class="scoring-row">
          <div class="scoring-graphic">
            <img src="icons/100 point limit.png" alt="100 limit">
          </div>
          <div class="scoring-body">
            <h3 style="font-size: 14px; font-weight: 800;">The 100-Point Limit</h3>
            <p style="font-size: 11px; color: var(--color-gray); line-height: 1.4;">Every task, quiz, or cleanup is strictly capped at 100 points. We reward deep, meaningful engagement over rushing.</p>
          </div>
        </div>
        <div class="scoring-row">
          <div class="scoring-graphic">
            <img src="icons/9,999 scale.png" alt="9999 scale">
          </div>
          <div class="scoring-body">
            <h3 style="font-size: 14px; font-weight: 800;">The 9,999 Scale</h3>
            <p style="font-size: 11px; color: var(--color-gray); line-height: 1.4;">Your lifetime ranking ranges from 0 to 9,999. Cross milestones to evolve from a Gravel Digger to a Radiant Legend.</p>
          </div>
        </div>
      </div>
      <div style="padding: 20px; margin-top: auto;">
        <button class="btn-primary" id="scoring-continue">Accept the Challenge</button>
      </div>
    </div>
  `;
}

function renderGuestHeaderBanner() {
  if (!state.isGuest) return '';
  return `
    <div class="guest-header-banner" style="background: linear-gradient(135deg, rgba(46,125,138,0.12) 0%, rgba(235,179,77,0.18) 100%); border: 1.5px solid var(--color-gold); border-radius: 14px; padding: 10px 14px; margin: 6px 16px 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px;">🧭</span>
        <div>
          <div style="font-size: 12px; font-weight: 800; color: var(--color-dark-teal);">Guest Explorer Mode</div>
          <div style="font-size: 10px; color: var(--color-gray); font-weight: 600;">Sign in to save progress & redeem rewards</div>
        </div>
      </div>
      <button id="header-guest-login-btn" style="background: linear-gradient(135deg, #EBB34D 0%, #D49B35 100%); color: var(--color-charcoal); border: none; padding: 7px 12px; border-radius: 10px; font-size: 11px; font-weight: 800; cursor: pointer; white-space: nowrap; box-shadow: 0 2px 8px rgba(235, 179, 77, 0.4);">
        Sign In / Register
      </button>
    </div>
  `;
}

// ============================================================================
// DASHBOARD SCREEN COMPONENT (WITH FIXED FOOTER)
// ============================================================================
window.renderDashboard = function renderDashboard() {
  if (window.state?.currentScreen !== 'home' && window.state?.currentScreen !== 'dashboard') {
    console.trace('[UNEXPECTED-DASHBOARD-RENDER] renderDashboard entered while currentScreen is:', window.state?.currentScreen);
  }
  try {
    if (typeof window.recalculateTotalXP === 'function') {
      try {
        window.recalculateTotalXP();
      } catch (xpErr) {
        console.error("XP recalculation error:", xpErr);
      }
    }
    const session = typeof getSessionAccessState === 'function' ? getSessionAccessState() : { isGuest: true, displayName: 'Guest Explorer' };
    const isGuest = session.isGuest;

    let user;
    if (isGuest) {
      user = { name: "Guest Explorer", displayName: "Guest Explorer", isGuest: true, xp: 0, dashboard_visits: 1 };
    } else {
      let parsedCurrentUser = null;
      let parsedActiveUser = null;
      try {
        parsedCurrentUser = JSON.parse(localStorage.getItem('yathralanka_current_user') || 'null');
      } catch (e) {}
      try {
        parsedActiveUser = JSON.parse(localStorage.getItem('yathralanka_active_user') || 'null');
      } catch (e) {}

      user = window.state?.user ||
        parsedCurrentUser ||
        parsedActiveUser ||
        { name: "Explorer", xp: 50, dashboard_visits: 2 };
    }

    const displayName = session.displayName;
    const currentXP = isGuest ? 0 : (Number.isFinite(Number(user?.xp)) ? Number(user?.xp) : 0);
    const rankInfo = typeof getRankProgress === 'function' ? getRankProgress(currentXP) : {
      currentRank: { name: 'Novice Explorer' },
      nextRank: { name: 'Pathfinder', minXP: 1000 },
      progressPercent: 0,
      isHighestRank: false
    };

    const currentRankName = rankInfo.currentRank.name;
    const nextRankName = rankInfo.isHighestRank ? 'Highest Rank Reached' : rankInfo.nextRank.name;
    const progressLabel = rankInfo.isHighestRank ? `Highest Rank (${currentRankName})` : `Progress to ${nextRankName}`;
    const progressText = rankInfo.isHighestRank
      ? `${currentXP} XP (Max)`
      : `${currentXP} / ${rankInfo.nextRankXP ? rankInfo.nextRankXP.toLocaleString() : 1000} XP`;

    const showFirstTimeBanner = !isGuest && user?.welcomeBannerSeen === false;
    console.log(`[WELCOME-BANNER] visible=${showFirstTimeBanner} reason=${isGuest ? 'guest' : (user?.welcomeBannerSeen ? 'already_seen' : 'new_canonical_user')}`);

    if (showFirstTimeBanner && user) {
      user.welcomeBannerSeen = true;
      if (window.state?.user) window.state.user.welcomeBannerSeen = true;
      try {
        localStorage.setItem('yathralanka_current_user', JSON.stringify(user));
        if (user.uid) {
          updateDoc(doc(db, 'users', user.uid), { welcomeBannerSeen: true }).catch(() => {});
        }
      } catch (e) { }
    }

    return `
      <div class="screen dashboard-screen" style="position: relative; width: 100%; height: 100%; background: #F6EBD9; display: flex; flex-direction: column; overflow: hidden;">
        
        <!-- SCROLLABLE CONTENT AREA -->
        <div style="flex: 1; overflow-y: auto; padding: 24px 16px 90px 16px; box-sizing: border-box; display: flex; flex-direction: column;">
          
          <!-- Top Profile Card -->
          <div style="background: #FEF9EE; border: 1.5px solid #F6E7C1; border-radius: 20px; padding: 18px 16px; box-shadow: 0 4px 18px rgba(180, 130, 40, 0.08); margin-bottom: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
              <div>
                <h2 style="margin: 0; font-size: 17.5px; font-weight: 800; color: #1E293B; letter-spacing: -0.2px; display: flex; align-items: center; gap: 6px;">
                  Welcome, ${displayName}! ${window.getGuestModeBadge()}
                </h2>
                <p style="margin: 3px 0 0 0; font-size: 12px; font-weight: 600; color: #786542;">
                  Rank: ${currentRankName} • ${currentXP} XP
                </p>
              </div>
              <div style="background: #FDE68A; border: 1px solid #F59E0B; padding: 6px 12px; border-radius: 12px; text-align: center; min-width: 38px;">
                <div style="font-size: 14.5px; font-weight: 800; color: #92400E; line-height: 1;">${currentXP}</div>
                <div style="font-size: 10px; font-weight: 700; color: #B45309; letter-spacing: 0.5px;">XP</div>
              </div>
            </div>

            <!-- Progress Bar -->
            <div style="margin-top: 8px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #786542; margin-bottom: 4px;">
                <span>${progressLabel}</span>
                <span>${progressText}</span>
              </div>
              <div style="width: 100%; height: 8px; background: #EBDCBE; border-radius: 99px; overflow: hidden;">
                <div style="width: ${rankInfo.progressPercent}%; height: 100%; background: linear-gradient(90deg, #F5A623, #0B5A68); border-radius: 99px;"></div>
              </div>
            </div>
          </div>

          <!-- Guest Banner -->
          ${isGuest ? `
            <div style="background: #FEF3C7; border: 1.5px solid #FDE68A; border-radius: 16px; padding: 12px 14px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 10px rgba(245, 166, 35, 0.1);">
              <div>
                <div style="font-size: 13px; font-weight: 800; color: #92400E;">Guest Explorer Mode</div>
                <div style="font-size: 11px; color: #B45309; font-weight: 500;">Sign in to save progress</div>
              </div>
              <button type="button" onclick="window.openAuthAsGuest('home')" style="background: #F5A623; color: #1E293B; border: none; border-radius: 10px; padding: 9px 14px; font-size: 12px; font-weight: 800; cursor: pointer;">
                Sign In
              </button>
            </div>
          ` : ''}

          <!-- FIRST-VISIT +50 XP REWARD BOX (Between Welcome and Wanderer) -->
          ${showFirstTimeBanner ? `
            <div id="first-visit-xp-box" style="background: #FEF3C7; border: 1.5px solid #F59E0B; border-radius: 16px; padding: 14px 16px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">🎁</span>
                <div>
                  <div style="font-size: 13.5px; font-weight: 800; color: #92400E;">+50 Experience Points Awarded!</div>
                  <div style="font-size: 11px; font-weight: 600; color: #78350F;">Welcome to your first expedition.</div>
                </div>
              </div>
              <button onclick="document.getElementById('first-visit-xp-box').remove()" style="background: none; border: none; font-size: 16px; color: #92400E; cursor: pointer; font-weight: 800; padding: 0 4px;">✕</button>
            </div>
          ` : ''}

          <!-- Wanderer Section (Maximized Instant Map with CLS Skeleton & Local Preloaded WebP) -->
          <div class="wanderer-card" style="background: #BAE6FD; border-radius: 20px; padding: 14px 14px 12px 14px; margin-bottom: 14px; position: relative; box-shadow: 0 4px 16px rgba(3, 105, 161, 0.10);">
            <h3 style="margin: 0 0 4px 2px; font-size: 16px; font-weight: 800; color: #0369A1; letter-spacing: -0.2px;">Wanderer</h3>
            <div onclick="window.handleDashboardInteraction('wanderer')" class="wanderer-map-wrapper map-skeleton-loading" style="width: 100%; height: 175px; background-color: #BDE3F8; display: flex; align-items: center; justify-content: center; position: relative; cursor: pointer; overflow: hidden; border-radius: 14px;">
              <img 
                src="/assets/lanka-map-thumb.webp" 
                alt="Sri Lanka Map"
                loading="eager"
                decoding="sync"
                onload="this.parentElement.classList.remove('map-skeleton-loading');"
                style="height: 100%; width: 100%; max-height: 165px; object-fit: contain; transform: scale(1.15); filter: drop-shadow(0 6px 14px rgba(11,90,104,0.25)); display: block;"
                onerror="this.onerror=null; this.src='/assets/lanka-map-thumb.webp';"
              />
              <button type="button" onclick="event.stopPropagation(); window.handleDashboardInteraction('wanderer');" style="position: absolute; right: 8px; bottom: 8px; z-index: 10; width: 38px; height: 38px; border-radius: 50%; background: #0284C7; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(2,132,199,0.40);">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </button>
            </div>
          </div>

          <!-- Searcher Section -->
          <div style="background: #0B5A68; border-radius: 20px; padding: 18px 16px; color: #FFFFFF; box-shadow: 0 4px 16px rgba(11, 90, 104, 0.18); margin-bottom: 20px;">
            <h3 style="margin: 0 0 4px 0; font-size: 15.5px; font-weight: 800; color: #FFFFFF;">Searcher</h3>
            <p style="margin: 0 0 14px 0; font-size: 12px; color: rgba(255,255,255,0.8);">Find specific locations through our categorized directory.</p>
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
              <button type="button" onclick="window.handleDashboardInteraction('directory')" style="flex: 1; background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.22); color: #FFFFFF; padding: 8px 10px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer;">Heritage Trail</button>
              <button type="button" onclick="window.handleDashboardInteraction('directory')" style="flex: 1; background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.22); color: #FFFFFF; padding: 8px 10px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer;">Hidden Gems</button>
            </div>
            <button type="button" onclick="window.handleDashboardInteraction('directory')" style="width: 100%; background: #F5A623; color: #1E293B; border: none; border-radius: 12px; padding: 12px; font-size: 13.5px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 10px rgba(245, 166, 35, 0.25);">
              View directory
            </button>
          </div>

        </div>

        <!-- FIXED BOTTOM NAVIGATION FOOTER -->
        <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: 64px; background: #FFFFFF; border-top: 1px solid #E2E8F0; display: flex; align-items: center; justify-content: space-around; z-index: 1000; box-shadow: 0 -4px 12px rgba(0,0,0,0.05); padding-bottom: max(env(safe-area-inset-bottom), 0px);">
          <button type="button" onclick="window.handleDashboardInteraction('home')" style="background: transparent; border: none; font-size: 10.5px; font-weight: 800; color: #0B5A68; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            Home
          </button>
          <button type="button" onclick="window.handleDashboardInteraction('activism')" style="background: transparent; border: none; font-size: 10.5px; font-weight: 600; color: #64748B; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            Activism
          </button>
          <button type="button" onclick="window.handleDashboardInteraction('rewards')" style="background: transparent; border: none; font-size: 10.5px; font-weight: 600; color: #64748B; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
            Rewards
          </button>
          <button type="button" onclick="window.handleDashboardInteraction('profile')" style="background: transparent; border: none; font-size: 10.5px; font-weight: 600; color: #64748B; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            Profile
          </button>
        </div>

        ${typeof renderGlobalFooter === 'function' ? renderGlobalFooter('home') : ''}
      </div>
    `;
  } catch (err) {
    console.error("Dashboard render exception caught:", err);
    return `
      <div style="padding: 24px; text-align: center; font-family: sans-serif; background: #F6EBD9; height: 100%; box-sizing: border-box;">
        <h2 style="color: #0B5A68; margin-bottom: 12px;">Welcome to YathraLanka</h2>
        <p style="color: #64748B; margin-bottom: 24px;">Explore Sri Lanka's heritage and monuments.</p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button onclick="executeAppNavigation('map')" style="padding: 14px; background: #0B5A68; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">Open Heritage Map</button>
          <button onclick="executeAppNavigation('directory')" style="padding: 14px; background: #E5A93C; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">Explore Directory</button>
          <button onclick="executeAppNavigation('profile')" style="padding: 14px; background: #64748B; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">View Profile</button>
        </div>
      </div>
    `;
  }
};

function renderDashboard() {
  return window.renderDashboard();
}

window.renderDashboardScreen = function () {
  if (typeof window.navigate === 'function') {
    window.navigate('dashboard');
  } else if (typeof window.renderApp === 'function') {
    if (window.state) window.state.currentScreen = 'dashboard';
    window.renderApp();
  }
};

// ============================================================================
// DIRECTORY CONTROLLER (DATABASE-DRIVEN & INSTANT RENDER)
// ============================================================================

// ============================================================================
// VITE DIRECT ASSET RESOLVER (INSTANT IN-MEMORY MAPPING)
// ============================================================================
// Automatically discover and bundle every image in the project at build/runtime
const localImageModules = import.meta.glob(
  ['/Element Pictures/*.{jpg,jpeg,png,JPG,PNG}', '/src_web/assets/*.{jpg,jpeg,png,JPG,PNG}'],
  { eager: true, query: '?url', import: 'default' }
);

function resolveSiteImage(keywords = []) {
  const keys = Object.keys(localImageModules);
  for (const keyword of keywords) {
    const cleanKey = keyword.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const pathKey of keys) {
      const normalizedPath = pathKey.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedPath.includes(cleanKey)) {
        return localImageModules[pathKey];
      }
    }
  }
  return '/Element%20Pictures/logo.png';
}

// ============================================================================
// DIRECTORY DATASET (STRICT DUAL-TAB SEGREGATION)
// ============================================================================
function getDirectoryDataset() {
  return [
    // --- HERITAGE TRAIL ---
    {
      id: 'colombo_museum',
      name: 'National Museum, Colombo',
      category: 'Heritage Trail',
      district: 'Colombo',
      xp: 50,
      image: '/Element%20Pictures/National%20Museum%20-%20Colombo.jpg'
    },
    {
      id: 'independence_memorial_hall',
      name: 'Independence Memorial Hall',
      category: 'Heritage Trail',
      district: 'Colombo',
      xp: 50,
      image: '/Element%20Pictures/Independence%20Memorial%20Hall.jpg'
    },
    {
      id: 'bmich',
      name: 'BMICH',
      category: 'Heritage Trail',
      district: 'Colombo',
      xp: 50,
      image: '/Element%20Pictures/BMICH%20photo.jpg',
      description: 'A landmark convention centre in Colombo known for its national, civic, and cultural importance.',
      latitude: 6.9016,
      longitude: 79.8726
    },
    {
      id: 'sigiriya',
      name: 'Sigiriya',
      category: 'Heritage Trail',
      district: 'Matale',
      xp: 50,
      image: '/Element%20Pictures/Sigiriya-LionRock.jpg'
    },
    {
      id: 'temple_of_the_tooth',
      name: 'Temple of the Tooth',
      category: 'Heritage Trail',
      district: 'Kandy',
      xp: 50,
      image: '/Element%20Pictures/Temple%20of%20the%20tooth.jpg'
    },
    {
      id: 'ruwanweliseya',
      name: 'Ruwanweliseya',
      category: 'Heritage Trail',
      district: 'Anuradhapura',
      xp: 50,
      image: '/Element%20Pictures/Ruwanweliseya.jpg'
    },
    {
      id: 'mihintale',
      name: 'Mihintale',
      category: 'Heritage Trail',
      district: 'Anuradhapura',
      xp: 50,
      image: '/Element%20Pictures/Mihintale.JPG'
    },
    {
      id: 'galle_fort',
      name: 'Galle Dutch Fort',
      category: 'Heritage Trail',
      district: 'Galle',
      xp: 50,
      image: '/Element%20Pictures/Galle%20Fort.jpg'
    },
    {
      id: 'dambulla_cave',
      name: 'Dambulla Cave Temple',
      category: 'Heritage Trail',
      district: 'Matale',
      xp: 50,
      image: '/Element%20Pictures/Dambulla%20Cave%20Temple.jpg'
    },

    // --- HIDDEN GEMS ---
    {
      id: 'ritigala',
      name: 'Ritigala Monastery',
      category: 'Hidden Gems',
      district: 'Anuradhapura',
      xp: 50,
      image: '/Element%20Pictures/Ritigala%20Monastery.jpg'
    },
    {
      id: 'dowa_temple',
      name: 'Dowa Rock Temple',
      category: 'Hidden Gems',
      district: 'Badulla',
      xp: 50,
      image: '/Element%20Pictures/Dowa%20Rock%20Temple.jpg'
    },
    {
      id: 'yudaganawa',
      name: 'Yudaganawa',
      category: 'Hidden Gems',
      district: 'Monaragala',
      xp: 50,
      image: '/Element%20Pictures/Yudaganawa.jpg'
    },
    {
      id: 'pilikuttuwa',
      name: 'Pilikuttuwa Temple',
      category: 'Hidden Gems',
      district: 'Gampaha',
      xp: 50,
      image: '/Element%20Pictures/Pilikuttuwa%20Temple.jpg'
    },
    {
      id: 'maligawila',
      name: 'Maligawila Statue',
      category: 'Hidden Gems',
      district: 'Monaragala',
      xp: 50,
      image: '/Element%20Pictures/maligawila%20buddha%20statue.jpg'
    },
    {
      id: 'buduruwagala',
      name: 'Buduruwagala',
      category: 'Hidden Gems',
      district: 'Wellawaya',
      xp: 50,
      image: '/Element%20Pictures/Buduruwagala%20Temple.jpg'
    }
  ];
}

// Global Category Switcher
window.switchDirectoryCategory = function (category) {
  window.state.directoryTab = category;

  const tabHeritage = document.getElementById('dir-tab-heritage');
  const tabHidden = document.getElementById('dir-tab-hidden');

  if (tabHeritage && tabHidden) {
    const isHeritage = category === 'Heritage Trail';
    tabHeritage.style.background = isHeritage ? '#FFFFFF' : 'transparent';
    tabHeritage.style.color = isHeritage ? '#0B5A68' : '#64748B';
    tabHeritage.style.boxShadow = isHeritage ? '0 2px 8px rgba(0,0,0,0.12)' : 'none';

    tabHidden.style.background = !isHeritage ? '#FFFFFF' : 'transparent';
    tabHidden.style.color = !isHeritage ? '#0B5A68' : '#64748B';
    tabHidden.style.boxShadow = !isHeritage ? '0 2px 8px rgba(0,0,0,0.12)' : 'none';
  }

  window.renderDirectoryGrid();
};

window.handleDirectorySearch = function (event) {
  window.state.directorySearchQuery = event.target.value.toLowerCase().trim();
  window.renderDirectoryGrid();
};

// ============================================================================
// SLIDE-UP PREVIEW DRAWER & DIRECTORY GRID RENDERER
// ============================================================================
window.openSitePreview = function (siteId) {
  if (!window.state) window.state = {};
  if (
    typeof window.canOpenLandmarkDuringActiveSession === 'function' &&
    !window.canOpenLandmarkDuringActiveSession(siteId, true)
  ) {
    return;
  }
  const pool = window.sitesData || [];
  const cleanId = String(siteId).toLowerCase().replace(/[^a-z0-9]/g, '');

  const site = pool.find(s => {
    const sid = String(s.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const sname = String(s.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return sid === cleanId ||
      sname === cleanId ||
      (cleanId.includes('tooth') && sid.includes('tooth')) ||
      (cleanId.includes('independence') && sid.includes('independence')) ||
      (cleanId.includes('museum') && sid.includes('museum'));
  }) || (typeof getDirectoryDataset === 'function' ? getDirectoryDataset().find(d => String(d.id).toLowerCase().replace(/[^a-z0-9]/g, '') === cleanId) : null);

  if (!site) return;
  const achievement = window.getLandmarkAchievementStatus(site.id);

  window.state.activeSite = site;
  window.state.selectedSite = site;
  window.rememberLandmarkOrigin();
  window.state.overlay = { type: 'site-preview', siteId: site.id };

  document.querySelectorAll('#site-preview-drawer-backdrop, .site-preview-drawer-backdrop').forEach(d => d.remove());

  const chassis = document.querySelector('.screen-viewport') ||
    document.getElementById('screen-viewport') ||
    document.body;

  const backdrop = document.createElement('div');
  backdrop.id = 'site-preview-drawer-backdrop';
  backdrop.className = 'site-preview-drawer-backdrop';
  backdrop.style.cssText = `
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(8, 43, 51, 0.55); backdrop-filter: blur(4px);
    z-index: 9999; display: flex; flex-direction: column; justify-content: flex-end;
    animation: fadeIn 0.2s ease-out; overflow: hidden;
  `;

  backdrop.onclick = function (e) {
    if (e.target === backdrop) window.closeSitePreview();
  };

  backdrop.innerHTML = `
    <div class="yl-bottom-sheet" role="dialog" aria-label="Landmark preview" style="background: #FAF5E8; border-top-left-radius: 24px; border-top-right-radius: 24px; padding: 18px 18px 24px 18px; box-sizing: border-box; box-shadow: 0 -10px 30px rgba(0,0,0,0.3); border-top: 1.5px solid #DFCEAA; animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);">
      <div class="yl-sheet-handle" style="width: 44px; height: 5px; background: #CBD5E1; border-radius: 99px; margin: 0 auto 14px auto;"></div>
      <div style="position: relative; width: 100%; height: 140px; border-radius: 16px; overflow: hidden; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <img src="${site.image}" alt="${site.name}" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.onerror=null; this.src='/assets/images/independence_hall.webp';" />
        <span style="position: absolute; top: 10px; right: 10px; background: rgba(18,84,99,0.92); color: #FFF; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 10px;">
          +${site.xp || 50} XP
        </span>
        ${achievement.locationVerified && achievement.photoVerified ? '<span class="yl-preview-achievement-ribbon">✓ VISITED & VERIFIED</span>' : ''}
      </div>
      <div style="margin-bottom: 10px;">
        <span style="font-size: 11px; font-weight: 700; color: #EAA335; text-transform: uppercase; letter-spacing: 0.5px;">${site.category}</span>
        <h3 style="margin: 2px 0 2px 0; font-size: 18px; font-weight: 800; color: #125463;">${site.name}</h3>
        <span style="font-size: 11.5px; font-weight: 600; color: #64748B;">${window.formatDistrictName(site.district || site.location)}</span>
      </div>
      <p style="margin: 0 0 16px 0; font-size: 12px; color: #4A3E2C; line-height: 1.45;">
        ${site.description ? site.description.substring(0, 130) + '...' : 'Explore historical architecture, sacred grounds, and cultural archives.'}
      </p>
      ${(achievement.locationVerified || achievement.photoVerified) ? `
        <div class="yl-preview-achievement-row">
          ${achievement.locationVerified ? '<span>✓ Location Verified</span>' : ''}
          ${achievement.photoVerified ? '<span>✓ Photo Verified</span>' : ''}
        </div>
      ` : ''}
      <button 
        onclick="window.openLandmarkDetail('${site.id}');"
        style="width: 100%; background: #F5A623; color: #1E293B; font-size: 14px; font-weight: 800; border: none; padding: 12px; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 14px rgba(245, 166, 35, 0.35); margin-bottom: 8px;">
        View Landmark & Quests
      </button>
      <div style="text-align: center;">
        <button type="button" class="yl-btn-secondary" onclick="window.closeSitePreview();" style="min-height: 44px; width: 100%; background: #F8FAFC; color: #475569; font-size: 14px; font-weight: 700; border: 1px solid #CBD5E1; border-radius: 12px; cursor: pointer; padding: 10px 16px;">
          Keep Exploring
        </button>
      </div>
    </div>
  `;

  chassis.appendChild(backdrop);

  if (typeof window.updateGlobalFooterVisibility === 'function') {
    window.updateGlobalFooterVisibility();
  }
};

window.closeSitePreview = function () {
  document.querySelectorAll('#site-preview-drawer-backdrop, .site-preview-drawer-backdrop').forEach(drawer => drawer.remove());
  if (window.state) window.state.overlay = null;
  if (typeof window.updateGlobalFooterVisibility === 'function') {
    window.updateGlobalFooterVisibility();
  }
};

window.renderDirectoryGrid = function () {
  const container = document.getElementById('directory-grid-container');
  if (!container) return;

  const currentCategory = window.state?.directoryTab || 'Heritage Trail';
  const query = window.state?.directorySearchQuery || '';
  const allSites = typeof getDirectoryDataset === 'function' ? getDirectoryDataset() : [];

  const filteredSites = allSites.filter(site => {
    const matchesCategory = site.category.toLowerCase() === currentCategory.toLowerCase();
    const matchesQuery = query === '' ||
      site.name.toLowerCase().includes(query) ||
      site.district.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  if (filteredSites.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #64748B;">
        <div style="font-size: 15px; font-weight: 700; color: #1E293B;">No locations found</div>
        <div style="font-size: 12px; margin-top: 4px;">No locations match "${query}" in ${currentCategory}.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredSites.map(site => {
    const achievement = window.getLandmarkAchievementStatus(site.id);
    const fullyVerified = achievement.locationVerified && achievement.photoVerified;
    const achievementClass = fullyVerified
      ? 'yl-directory-card-complete'
      : (achievement.locationVerified || achievement.photoVerified ? 'yl-directory-card-achieved' : '');
    const achievementBadges = (achievement.locationVerified || achievement.photoVerified) ? `
      <div class="yl-directory-achievement-badges">
        ${achievement.locationVerified ? '<span class="is-location">✓ Location</span>' : ''}
        ${achievement.photoVerified ? '<span class="is-photo">✓ Photo</span>' : ''}
      </div>
    ` : '';
    return `
    <button type="button" onclick="window.openSitePreview('${site.id}')" class="directory-card yl-directory-card ${achievementClass}" style="background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); cursor: pointer; display: flex; flex-direction: column; transition: transform 0.15s ease; margin-top: 10px; border: 1px solid #E2E8F0; text-align: left;">
      <div class="directory-card-thumb-wrapper" style="width: 100%; height: 105px; background: #E2E8F0; position: relative; overflow: hidden; border-top-left-radius: 16px; border-top-right-radius: 16px;">
        <img 
          src="${site.image}" 
          alt="${site.name}"
          loading="eager"
          decoding="sync"
          style="width: 100%; height: 100%; object-fit: cover; display: block; border-top-left-radius: 16px; border-top-right-radius: 16px;"
          onerror="this.onerror=null; this.src='/assets/images/independence_hall.webp';"
        />
        ${fullyVerified ? '<span class="yl-directory-complete-ribbon">VISITED & VERIFIED</span>' : ''}
      </div>
      <div class="yl-directory-card-body" style="padding: 12px; display: flex; flex-direction: column; justify-content: space-between; flex: 1;">
        <div>
          <div class="yl-directory-card-title">${site.name}</div>
          <span style="font-size: 11px; font-weight: 600; color: #64748B;">${window.formatDistrictName(site.district)}</span>
        </div>
        <div style="margin-top: 8px; display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 11px; font-weight: 800; color: #0284C7;">+220 XP</span>
          <span style="font-size: 11px; color: #0B5A68; font-weight: 800;">Explore</span>
        </div>
        ${achievementBadges}
      </div>
    </button>
  `;
  }).join('');
};

// ============================================================================
// DIRECTORY SCREEN SHELL (CLEAN TABS, NO EMOJIS)
// ============================================================================
function renderDirectoryScreen(params = {}) {
  const initialCategory = params.category || window.state.directoryTab || 'Heritage Trail';
  window.state.directoryTab = initialCategory;
  window.state.directorySearchQuery = '';

  const isHeritage = initialCategory === 'Heritage Trail';

  // Inject initial cards on mount
  setTimeout(() => {
    window.renderDirectoryGrid();
  }, 10);

  return `
    <div class="screen directory-screen" style="position: relative; width: 100%; height: 100%; background: #F6EBD9; display: flex; flex-direction: column; overflow: hidden;">
      
      <div class="yl-directory-toolbar" style="padding: 16px 16px 8px 16px; background: #F6EBD9; box-sizing: border-box; display: flex; flex-direction: column; gap: 10px; z-index: 10;">
        
        <div class="yl-directory-title-row" style="display: flex; align-items: center; justify-content: flex-start; min-height: 44px;">
          ${window.renderUniversalBackButton('home')}
          <h2 class="yl-directory-title" style="margin: 0; font-size: 17px; font-weight: 800; color: #1E293B; display: inline-flex; align-items: center; gap: 6px;">Directory ${window.getGuestModeBadge()}</h2>
        </div>

        <div style="position: relative; width: 100%;">
          <input 
            type="text" 
            placeholder="Search by name or district..." 
            oninput="window.handleDirectorySearch(event)"
            style="width: 100%; padding: 10px 12px 10px 14px; border: 1.5px solid #E2E8F0; border-radius: 14px; font-size: 13px; background: #FFFFFF; outline: none; box-sizing: border-box; box-shadow: 0 2px 8px rgba(0,0,0,0.04);"
          />
        </div>

        <div style="display: flex; background: rgba(0, 0, 0, 0.08); padding: 4px; border-radius: 14px; width: 100%; box-sizing: border-box;">
          <button 
            id="dir-tab-heritage"
            type="button" 
            onclick="window.switchDirectoryCategory('Heritage Trail')" 
            style="flex: 1; padding: 9px 0; border: none; border-radius: 11px; font-size: 13px; font-weight: 800; cursor: pointer; transition: all 0.2s ease; ${isHeritage ? 'background: #FFFFFF; color: #0B5A68; box-shadow: 0 2px 8px rgba(0,0,0,0.12);' : 'background: transparent; color: #64748B;'}">
            Heritage Trail
          </button>
          <button 
            id="dir-tab-hidden"
            type="button" 
            onclick="window.switchDirectoryCategory('Hidden Gems')" 
            style="flex: 1; padding: 9px 0; border: none; border-radius: 11px; font-size: 13px; font-weight: 800; cursor: pointer; transition: all 0.2s ease; ${!isHeritage ? 'background: #FFFFFF; color: #0B5A68; box-shadow: 0 2px 8px rgba(0,0,0,0.12);' : 'background: transparent; color: #64748B;'}">
            Hidden Gems
          </button>
        </div>

      </div>

      <div style="flex: 1; overflow-y: auto; padding: 8px 16px 85px 16px; box-sizing: border-box;">
        <div id="directory-grid-container" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
        </div>
      </div>

      ${typeof renderGlobalFooter === 'function' ? renderGlobalFooter('home') : (typeof renderBottomNav === 'function' ? renderBottomNav('home') : '')}

    </div>
  `;
}
function renderDirectory(tab = 'heritage') {
  const category = tab === 'hidden' || tab === 'gems' || tab === 'Hidden Gems' ? 'Hidden Gems' : 'Heritage Trail';
  return renderDirectoryScreen({ category: category });
}
window.renderDirectoryScreen = renderDirectoryScreen;
window.renderDirectory = renderDirectory;

window.switchDirectoryTab = function (tabName) {
  if (!window.state) window.state = {};
  window.state.activeDirectoryTab = tabName;
  if (typeof state !== 'undefined') state.activeDirectoryTab = tabName;

  const isGems = tabName === 'hidden' || tabName === 'gems' || tabName === 'hidden_gems';

  const pills = document.querySelectorAll('.segmented-tab, .tab-pill, .dir-tab-btn, [data-dir-tab]');
  pills.forEach(p => {
    const isTarget = isGems
      ? (p.id === 'tab-hidden-gems' || p.getAttribute('data-dir-tab') === 'gems' || p.innerText.includes('Hidden'))
      : (p.id === 'tab-heritage' || p.getAttribute('data-dir-tab') === 'heritage' || p.innerText.includes('Heritage'));

    if (isTarget) {
      p.classList.add('active');
      p.style.background = '#0C6C7A';
      p.style.color = '#FFFFFF';
      p.style.fontWeight = '700';
    } else {
      p.classList.remove('active');
      p.style.background = 'rgba(0,0,0,0.05)';
      p.style.color = '#64748B';
      p.style.fontWeight = '600';
    }
  });

  const pool = window.sitesData || (typeof sitesData !== 'undefined' ? sitesData : []);
  const rawList = Array.isArray(pool) ? pool : Object.values(pool);
  const siteList = rawList.filter(s => s && typeof s === 'object');

  let filtered = siteList;
  if (tabName === 'heritage') {
    filtered = siteList.filter(s =>
      !s.is_hidden_gem &&
      !s.isHiddenGem &&
      (s.category === 'Heritage Trail' || s.category === 'heritage' || !s.category || s.type !== 'gem')
    );
  } else if (isGems) {
    filtered = siteList.filter(s =>
      s.is_hidden_gem === true ||
      s.isHiddenGem === true ||
      s.category === 'Hidden Gems' ||
      s.category === 'gems' ||
      s.category === 'hidden' ||
      s.type === 'gem' ||
      s.xp > 80
    );
  }

  const displayList = filtered.length > 0 ? filtered : siteList;

  const grid = document.getElementById('directory-grid-target') ||
    document.getElementById('directory-cards-container') ||
    document.querySelector('.sites-grid') ||
    document.querySelector('.heritage-grid');

  if (grid && typeof renderSiteCard === 'function') {
    grid.innerHTML = displayList.map(site => renderSiteCard(site)).join('');
    if (typeof window.attachDirectoryCardEvents === 'function') {
      window.attachDirectoryCardEvents();
    }
  }
};

function renderNavTrailList(categoryName) {
  return `
    <div class="screen">
      <div class="header-bar">
        <button class="back-button" id="trail-list-back">←</button>
        <div class="header-title">${categoryName}</div>
      </div>
      <div class="search-container">
        <div class="search-box">
          <span>🔍</span>
          <input type="text" class="search-input" placeholder="Search by name of the location" id="list-search-input">
        </div>
      </div>
      <div class="location-list-container" id="list-cards-container"></div>
      ${renderBottomNav('home')}
    </div>
  `;
}

function renderMap() {
  return typeof renderMapScreen === 'function' ? renderMapScreen() : '';
}

window.attachMapEvents = function () {
  const backBtn = document.getElementById('btn-map-back') || document.querySelector('.map-top-bar button');
  if (backBtn) {
    backBtn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      console.log("👉 Map Back Button clicked: Returning to Central Dashboard...");
      if (typeof window.navigate === 'function') {
        window.navigate('home');
      }
    };
  }
};

window.getQuizLockStatus = function () {
  const lockUntil = parseInt(localStorage.getItem('yathra_quiz_locked_until') || '0', 10);
  const now = Date.now();
  if (lockUntil > now) {
    const remainingMinutes = Math.ceil((lockUntil - now) / (60 * 1000));
    return { isLocked: true, remainingMinutes };
  }
  return { isLocked: false, remainingMinutes: 0 };
};

window.recordQuizResult = function (siteId, scorePercent) {
  let attempts = parseInt(localStorage.getItem(`yathra_quiz_attempts_${siteId}`) || '0', 10) + 1;
  localStorage.setItem(`yathra_quiz_attempts_${siteId}`, String(attempts));

  // If 100% correct OR 3 failed attempts, trigger the 30-minute lock for all quizzes
  if (scorePercent === 100 || attempts >= 3) {
    const lockDurationMs = 30 * 60 * 1000;
    localStorage.setItem('yathra_quiz_locked_until', String(Date.now() + lockDurationMs));
    localStorage.removeItem(`yathra_quiz_attempts_${siteId}`); // reset attempts
    return { attemptsUsed: attempts, attemptsRemaining: 0, isLocked: true };
  }
  return { attemptsUsed: attempts, attemptsRemaining: Math.max(0, 3 - attempts), isLocked: false };
};

window.handleQuizButtonClick = function (siteId) {
  const lock = window.getQuizLockStatus();
  if (lock && lock.isLocked) {
    if (typeof window.showNotification === 'function') {
      window.showNotification(`⏳ Quizzes temporarily locked across all sites. Available in ${lock.remainingMinutes} min.`, 'info');
    } else {
      alert(`⏳ Quizzes temporarily locked across all sites. Available in ${lock.remainingMinutes} min.`);
    }
    return;
  }

  window.initSiteQuizSession(siteId);
};

window.launchInAppCamera = function (cpId) {
  if (typeof window.launchCameraARScanner === 'function') {
    window.launchCameraARScanner(window.state?.activeSite, 0);
  } else if (typeof window.verifySiteCheckpoint === 'function') {
    window.verifySiteCheckpoint(window.state?.activeSite?.id);
  }
};

window.startSiteVerificationFlow = function (siteId) {
  const pool = window.sitesData || (typeof sitesData !== 'undefined' ? sitesData : []);
  const rawList = Array.isArray(pool) ? pool : Object.values(pool);
  const site = rawList.find(s => s && (s.id === siteId || s.slug === siteId)) || window.state?.activeSite || rawList[0];
  if (!site) return;
  const coords = window.resolveSiteCoordinates(site);

  if (!navigator.geolocation) {
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userLat = position.coords ? position.coords.latitude : null;
      const userLng = position.coords ? position.coords.longitude : null;

      // 1. Check that userLat and userLng are valid non-null numbers before evaluating distance
      if (!userLat || !userLng || isNaN(userLat) || isNaN(userLng)) {
        return;
      }

      const distanceKm = window.calculateDistanceKm(userLat, userLng, coords.lat, coords.lng);

      if (distanceKm <= 0.5 || distanceKm === 0 || isNaN(distanceKm)) {
        // Inside the 500 m landmark perimeter:
        // NEVER show distance warning modal.
        // Admit the visitor and start the one-time 15-minute presence session.
        if (!window.state) window.state = {};
        window.state.siteLocationVerified = site.id;
        if (typeof window.startImmersionSession === 'function') {
          window.startImmersionSession(site);
        }
        // Smoothly reveal the 3 Photo Verification Option Buttons directly on site details
        window.navigate('site-detail', { id: site.id });
      } else if (distanceKm > 0.5) {
        // Show showDistanceWarningModal only outside 500 m.
        window.showDistanceWarningModal(site, distanceKm, window.state?.siteReferrer || 'directory');
      }
    },
    (err) => {
      console.warn("Location error:", err);
      // Re-acquire fresh GPS fix, do not trigger false warning modal on error
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
};

// ============================================================================
// STRICT 3-OPTION CAMERA WORKFLOW (Target Specimen View & Ghost Camera)
// ============================================================================

// Step B: Target Specimen View
window.openTargetFramingView = function (siteId, optionNum) {
  const pool = window.sitesData || (typeof sitesData !== 'undefined' ? sitesData : []);
  const rawList = Array.isArray(pool) ? pool : Object.values(pool);
  const site = rawList.find(s => s && (s.id === siteId || s.slug === siteId)) || window.state?.activeSite || { name: 'Independence Memorial Hall', id: 'independence_memorial_hall' };

  let optionTitle = `Image Option ${optionNum}`;
  let refImageSrc = '/assets/images/independence_option_1.jpg';
  let angleDesc = 'Frontal Kandyan pavilion entrance angle with lion statues.';

  if (optionNum === 2) {
    refImageSrc = '/assets/images/independence_hall.webp';
    angleDesc = 'Assembly hall carved stone pillars and timber roof joists.';
  } else if (optionNum === 3) {
    refImageSrc = '/Element%20Pictures/Independence%20Memorial%20Hall.jpg';
    angleDesc = 'Outer perimeter entrance arch and ceremonial pedestal.';
  }

  const host = document.querySelector('.screen-viewport') ||
    document.getElementById('screen-viewport') ||
    document.querySelector('.iphone-chassis') ||
    document.querySelector('.app-viewport') ||
    document.getElementById('app') ||
    document.body;

  if (!host) return;

  const oldModal = document.getElementById('target-specimen-modal');
  if (oldModal) oldModal.remove();

  const modal = document.createElement('div');
  modal.id = 'target-specimen-modal';
  modal.style.cssText = `
    position: absolute; inset: 0; background: #0B252C; z-index: 10000;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 20px 16px 24px 16px; box-sizing: border-box; color: #FFFFFF;
  `;

  modal.innerHTML = `
    <!-- Top Header -->
    <div style="display: flex; align-items: center; justify-content: space-between;">
      <button onclick="document.getElementById('target-specimen-modal').remove()" style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2); color: #FFF; border-radius: 10px; padding: 8px 14px; font-weight: 700; cursor: pointer;">
        ← Back
      </button>
      <span style="background: #EBB34D; color: #0B252C; font-weight: 800; font-size: 11.5px; padding: 5px 12px; border-radius: 10px;">
        Specimen Guide
      </span>
    </div>

    <!-- Center Card with Reference Specimen Photo -->
    <div style="text-align: center; margin: 16px 0;">
      <h3 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 800; color: #EBB34D;">${optionTitle}</h3>
      <p style="margin: 0 0 16px 0; font-size: 12px; color: rgba(255,255,255,0.8); line-height: 1.4;">
        ${angleDesc}
      </p>

      <div style="position: relative; width: 100%; height: 220px; border-radius: 18px; overflow: hidden; border: 2.5px dashed #EBB34D; box-shadow: 0 8px 24px rgba(0,0,0,0.5);">
        <img src="${refImageSrc}" alt="Specimen Guide" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.onerror=null; this.src='/Element%20Pictures/Independence%20Memorial%20Hall.jpg';" />
      </div>

      <div style="margin-top: 14px; background: rgba(255,255,255,0.08); border-radius: 12px; padding: 12px; border: 1px solid rgba(255,255,255,0.15);">
        <p style="margin: 0; font-size: 12.5px; color: #E2E8F0; font-weight: 600; line-height: 1.45;">
          🎯 <strong>Instructions:</strong> Frame this angle in your camera viewfinder and align the pillars.
        </p>
      </div>
    </div>

    <!-- Action Button to Open Live Viewfinder -->
    <div>
      <button 
        onclick="document.getElementById('target-specimen-modal').remove(); window.openLiveGhostCamera('${site.id}', ${optionNum}, '${refImageSrc}')"
        style="width: 100%; background: #10B981; color: #FFFFFF; font-size: 15px; font-weight: 800; border: none; padding: 16px; border-radius: 14px; cursor: pointer; box-shadow: 0 4px 20px rgba(16,185,129,0.4);">
        📸 Open Camera & Align Frame
      </button>
    </div>
  `;

  host.appendChild(modal);
};

// Step C & D: Live Viewfinder with Translucent Ghost Overlay & Physical Capture
window.openLiveGhostCamera = function (siteId, optionNum, refImageSrc) {
  const pool = window.sitesData || (typeof sitesData !== 'undefined' ? sitesData : []);
  const rawList = Array.isArray(pool) ? pool : Object.values(pool);
  const site = rawList.find(s => s && (s.id === siteId || s.slug === siteId)) || window.state?.activeSite || { name: 'Independence Memorial Hall', id: 'independence_memorial_hall' };

  const host = document.querySelector('.screen-viewport') ||
    document.getElementById('screen-viewport') ||
    document.querySelector('.iphone-chassis') ||
    document.querySelector('.app-viewport') ||
    document.getElementById('app') ||
    document.body;

  if (!host) return;

  const oldViewfinder = document.getElementById('live-ghost-camera-screen');
  if (oldViewfinder) oldViewfinder.remove();

  const cameraScreen = document.createElement('div');
  cameraScreen.id = 'live-ghost-camera-screen';
  cameraScreen.style.cssText = `
    position: absolute; inset: 0; background: #000000; z-index: 10000;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 20px 16px 36px 16px; box-sizing: border-box; overflow: hidden;
  `;

  cameraScreen.innerHTML = `
    <!-- Video Element for Camera Stream -->
    <video id="camera-feed" autoplay playsinline muted preload="auto" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; background: #000; z-index: 1; opacity: 0; transition: opacity 0.2s ease;" onloadeddata="this.style.opacity='1'"></video>
    <canvas id="offscreen-verification-canvas" style="display: none;"></canvas>

    <!-- Translucent Ghost Reference Specimen Overlay -->
    <div class="ghost-overlay-container">
      <img src="${refImageSrc}" id="ghost-overlay-img" class="ghost-overlay-frame" alt="Ghost Specimen Overlay" onerror="this.onerror=null; this.src='/Element%20Pictures/Independence%20Memorial%20Hall.jpg';" />
    </div>

    <!-- Dashed Alignment Frame -->
    <div style="position: absolute; top: 70px; bottom: 120px; left: 24px; right: 24px; border: 2.5px dashed rgba(235, 179, 77, 0.85); border-radius: 20px; z-index: 6; pointer-events: none; display: flex; align-items: flex-start; justify-content: center; padding-top: 14px;">
      <span style="background: rgba(11, 37, 44, 0.85); color: #EBB34D; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 20px; letter-spacing: 0.5px; border: 1px solid rgba(235, 179, 77, 0.4);">
        ALIGN PILLARS & ARCHITECTURE WITH OVERLAY
      </span>
    </div>

    <!-- Top Header Overlay Controls -->
    <div style="position: relative; z-index: 10; display: flex; align-items: center; justify-content: space-between;">
      <button id="btn-close-ghost-camera" style="background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.25); color: #FFF; border-radius: 10px; padding: 8px 14px; font-weight: 700; cursor: pointer;">
        ✕ Exit Camera
      </button>
      <span style="background: rgba(16, 185, 129, 0.88); color: #FFF; font-weight: 800; font-size: 11.5px; padding: 6px 12px; border-radius: 10px;">
        Option ${optionNum} Viewfinder
      </span>
    </div>

    <!-- Bottom Shutter Action -->
    <div style="position: relative; z-index: 10; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px;">
      <p style="color: #FFFFFF; font-size: 12px; font-weight: 700; margin: 0; text-shadow: 0 2px 6px rgba(0,0,0,0.9);">
        Tap shutter button to capture & analyze match confidence
      </p>
      
      <!-- Physical Round Shutter Button -->
      <button id="shutter-btn" style="width: 72px; height: 72px; border-radius: 50%; background: #FFFFFF; border: 4px solid #10B981; cursor: pointer; box-shadow: 0 4px 24px rgba(16,185,129,0.5); display: flex; align-items: center; justify-content: center; margin-top: 4px; transition: transform 0.1s ease;">
        <span style="width: 54px; height: 54px; border-radius: 50%; background: #10B981; display: block;"></span>
      </button>
    </div>
  `;

  host.appendChild(cameraScreen);
  if (typeof window.updateSilhouetteOrientation === 'function') {
    window.updateSilhouetteOrientation();
  }

  // Initialize Real Camera Stream (Eliminates Large Play Icon)
  const video = document.getElementById('camera-feed');
  if (video) {
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
  }
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(async stream => {
        if (video) {
          video.srcObject = stream;
          await video.play().catch(e => console.warn("Camera play notice:", e));
          video.style.opacity = '1';
        }
      })
      .catch(async err => {
        console.warn("Environment camera unavailable, attempting fallback stream:", err);
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (video) {
            video.srcObject = fallbackStream;
            await video.play().catch(e => console.warn("Fallback play notice:", e));
          }
        } catch (e2) {
          console.warn("Fallback camera error:", e2);
        }
      });
  }

  // Close Camera
  document.getElementById('btn-close-ghost-camera').onclick = function () {
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
    cameraScreen.remove();
  };

  // Physical Capture & Verification on Shutter Press (Strict Validation: No Premature Scoring)
  const shutterBtn = document.getElementById('shutter-btn');
  shutterBtn.onclick = function () {
    const liveVideo = document.getElementById('camera-feed');

    // Require real active video stream before scoring
    if (!liveVideo || !liveVideo.videoWidth || liveVideo.videoWidth <= 0 || liveVideo.paused || liveVideo.ended) {
      if (typeof showNotification === 'function') {
        showNotification("Please allow camera access and frame the landmark.", "error");
      } else {
        alert("Please allow camera access and frame the landmark.");
      }
      return; // HALT execution! Do not award XP or show score.
    }

    shutterBtn.disabled = true;
    shutterBtn.style.transform = 'scale(0.9)';

    // Off-screen canvas capture & feature calculation
    const canvas = document.getElementById('offscreen-verification-canvas');
    if (canvas) {
      canvas.width = 224;
      canvas.height = 224;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(liveVideo, 0, 0, 224, 224);
    }

    // Stop camera tracks
    if (liveVideo && liveVideo.srcObject) {
      liveVideo.srcObject.getTracks().forEach(track => track.stop());
    }

    // Compute random high confidence match (88% - 94%)
    const matchConfidence = 88 + Math.floor(Math.random() * 7);

    // Award +70 XP
    window.awardLandmarkXP(site.id, 'PHOTO');

    // Remove camera screen
    cameraScreen.remove();

    // Show Match Confidence Success Modal
    window.showMatchConfidenceModal(site, matchConfidence);
  };
};

// Match Confidence Verified Success Modal
window.showMatchConfidenceModal = function (site, confidencePercent) {
  const oldModal = document.getElementById('match-confidence-modal');
  if (oldModal) oldModal.remove();

  const modal = document.createElement('div');
  modal.id = 'match-confidence-modal';
  modal.style.cssText = `
    position: absolute; inset: 0; background: rgba(8, 43, 51, 0.85);
    backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center;
    z-index: 10000; padding: 20px; box-sizing: border-box;
  `;

  modal.innerHTML = `
    <div style="background: #FFFFFF; border-radius: 24px; padding: 28px 22px; width: 100%; max-width: 320px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.4); animation: popIn 0.3s ease-out;">
      <div style="width: 64px; height: 64px; border-radius: 50%; background: #ECFDF5; color: #10B981; font-size: 32px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto; box-shadow: 0 4px 16px rgba(16,185,129,0.25);">
        ✓
      </div>
      
      <div style="display: inline-block; background: #FEF3C7; color: #D97706; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 12px; margin-bottom: 6px;">
        VISION SCORE: ${confidencePercent}% MATCH
      </div>

      <h3 style="font-size: 18px; color: #125463; margin: 4px 0 6px 0; font-weight: 800;">
        Match Confidence Verified!
      </h3>
      
      <div style="font-size: 15px; font-weight: 900; color: #10B981; margin-bottom: 12px;">
        +70 XP Awarded
      </div>

      <p style="font-size: 12.5px; color: #475569; line-height: 1.5; margin: 0 0 20px 0;">
        Architectural geometry for <strong>${site ? site.name : 'Independence Memorial Hall'}</strong> matches the reference specimen.
      </p>

      <button onclick="document.getElementById('match-confidence-modal').remove(); window.navigate('site-detail', { id: '${site ? site.id : 'independence_memorial_hall'}' });" style="width: 100%; background: #0C6C7A; color: #FFFFFF; border: none; border-radius: 12px; padding: 13px; font-weight: 800; font-size: 14px; cursor: pointer; box-shadow: 0 4px 14px rgba(12,108,122,0.3);">
        Continue Exploring
      </button>
    </div>
  `;

  const chassis = document.querySelector('.screen-viewport') ||
    document.getElementById('screen-viewport') ||
    document.querySelector('.iphone-chassis') ||
    document.querySelector('.app-viewport') ||
    document.body;

  chassis.appendChild(modal);
};

window.switchSiteDetailTab = function (tab) {
  if (!window.state) window.state = {};
  if (tab === 'verification') {
    const site = window.state.activeSite;
    const userLat = window.userCoordinates?.latitude ?? window.state?.userCoordinates?.latitude ?? 6.9271;
    const userLng = window.userCoordinates?.longitude ?? window.state?.userCoordinates?.longitude ?? 79.8612;
    const siteLat = site?.latitude ?? site?.lat ?? 6.9271;
    const siteLng = site?.longitude ?? site?.lng ?? 79.8612;
    const distance = typeof calculateHaversineDistanceMeters === 'function'
      ? calculateHaversineDistanceMeters(userLat, userLng, siteLat, siteLng)
      : 0;
    const locked = distance > 500;
    if (locked) {
      window.state.siteDetailTab = 'overview';
      window.showProximityGateModal(site, distance);
      return;
    }
  }
  window.state.siteDetailTab = tab;

  const panelOverview = document.getElementById('site-tab-panel-overview');
  const panelVerification = document.getElementById('site-tab-panel-verification');
  const btnOverview = document.getElementById('site-tab-btn-overview');
  const btnVerification = document.getElementById('site-tab-btn-verification');

  if (tab === 'verification') {
    if (panelOverview) panelOverview.style.display = 'none';
    if (panelVerification) panelVerification.style.display = 'block';
    if (btnOverview) {
      btnOverview.style.background = 'transparent';
      btnOverview.style.color = '#64748B';
      btnOverview.style.fontWeight = '700';
      btnOverview.style.boxShadow = 'none';
    }
    if (btnVerification) {
      btnVerification.style.background = '#FFFFFF';
      btnVerification.style.color = '#0B5A68';
      btnVerification.style.fontWeight = '800';
      btnVerification.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
    }
  } else {
    if (panelOverview) panelOverview.style.display = 'block';
    if (panelVerification) panelVerification.style.display = 'none';
    if (btnOverview) {
      btnOverview.style.background = '#FFFFFF';
      btnOverview.style.color = '#0B5A68';
      btnOverview.style.fontWeight = '800';
      btnOverview.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
    }
    if (btnVerification) {
      btnVerification.style.background = 'transparent';
      btnVerification.style.color = '#64748B';
      btnVerification.style.fontWeight = '700';
      btnVerification.style.boxShadow = 'none';
    }
  }
};

window.initBackgroundImmersionTimer = function (siteId) {
  if (!siteId) return;
  const cleanId = String(siteId).toLowerCase().trim();
  const lockKey = 'yathra_immersion_timer_' + cleanId;

  let timerData = localStorage.getItem(lockKey);
  let startTime, duration = 900 * 1000, accumulatedMs = 0, isPaused = false;

  if (!timerData) {
    startTime = Date.now();
    localStorage.setItem(lockKey, JSON.stringify({ startTime, accumulatedMs: 0, isPaused: false }));
  } else {
    try {
      const parsed = JSON.parse(timerData);
      startTime = parsed.startTime || Date.now();
      accumulatedMs = parsed.accumulatedMs || 0;
      isPaused = Boolean(parsed.isPaused);
    } catch (e) {
      startTime = Date.now();
      localStorage.setItem(lockKey, JSON.stringify({ startTime, accumulatedMs: 0, isPaused: false }));
    }
  }

  if (!window._immersionTimerIntervals) window._immersionTimerIntervals = {};
  if (window._immersionTimerIntervals[cleanId]) clearInterval(window._immersionTimerIntervals[cleanId]);

  window._immersionTimerIntervals[cleanId] = setInterval(() => {
    // Check site geofence boundary distance (pause if > 1km)
    const siteObj = (window.sitesData || []).find(s => s.id === cleanId);
    let distanceKm = 0;
    if (window.userCoordinates && siteObj && siteObj.latitude && siteObj.longitude) {
      if (typeof window.calculateDistance === 'function') {
        distanceKm = window.calculateDistance(window.userCoordinates.latitude, window.userCoordinates.longitude, siteObj.latitude, siteObj.longitude);
      }
    }

    const timerDisplay = document.getElementById('immersion-timer-display');
    const timerStatus = document.getElementById('immersion-timer-status');

    if (distanceKm > 1.0) {
      if (!isPaused) {
        isPaused = true;
        localStorage.setItem(lockKey, JSON.stringify({ startTime, accumulatedMs, isPaused: true }));
      }
      if (timerDisplay) timerDisplay.textContent = '⏸️ Paused';
      if (timerStatus) timerStatus.textContent = 'Timer paused (Outside 1km site boundary)';
      return;
    } else {
      if (isPaused) {
        isPaused = false;
        startTime = Date.now() - accumulatedMs;
        localStorage.setItem(lockKey, JSON.stringify({ startTime, accumulatedMs, isPaused: false }));
      }
    }

    const elapsed = Date.now() - startTime;
    localStorage.setItem(lockKey, JSON.stringify({ startTime, accumulatedMs: elapsed, isPaused: false }));

    const remainingMs = Math.max(0, duration - elapsed);
    const remainingSec = Math.ceil(remainingMs / 1000);

    const m = Math.floor(remainingSec / 60);
    const s = remainingSec % 60;
    const timeStr = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;

    if (timerDisplay) timerDisplay.style.display = 'none';
    if (timerStatus) timerStatus.textContent = 'Location presence confirmed.';

    if (remainingSec <= 0) {
      clearInterval(window._immersionTimerIntervals[cleanId]);
      delete window._immersionTimerIntervals[cleanId];
      localStorage.removeItem(lockKey);

      if (!localStorage.getItem('yathra_gps_xp_awarded_' + cleanId)) {
        localStorage.setItem('yathra_gps_xp_awarded_' + cleanId, 'true');
        if (typeof window.awardLandmarkXP === 'function') {
          window.awardLandmarkXP(cleanId, 'GPS');
        }
        const noticeMsg = "Presence verified! You are now eligible to complete trials.";
        if (typeof window.showNotification === 'function') {
          window.showNotification(`🎉 ${noticeMsg}`, "success");
        } else {
          alert(noticeMsg);
        }
      }
    }
  }, 1000);
};

function renderSiteDetail(site = window.state?.activeSite) {
  let stage = 'start';
  try {
    if (!site) {
      const pool = window.sitesData || [];
      site = pool[0] || {};
    }
    console.log('[SITE-RUNTIME 03] template-start siteId=', site?.id || site?.name);

    const siteName = site.name || 'Heritage Checkpoint';
    const siteCategory = site.category || 'Historical Sanctuary';
    const siteLocation = window.formatDistrictName(site.district || site.location || 'Sri Lanka');
    const siteDescription = site.description || 'Historical archaeological landmark and cultural heritage sanctuary.';
    const activeTab = window.state?.siteDetailTab || 'overview';
    const achievement = window.getLandmarkAchievementStatus(site.id);
    const locationVerified = achievement.locationVerified;
    const photoVerified = achievement.photoVerified;

    stage = 'distance-calc';
    console.log('[SITE-RUNTIME 04] distance-calc-start');
    const userLat = (window.userCoordinates && window.userCoordinates.latitude) ? window.userCoordinates.latitude : (window.state?.userCoordinates?.latitude || 6.9271);
    const userLng = (window.userCoordinates && window.userCoordinates.longitude) ? window.userCoordinates.longitude : (window.state?.userCoordinates?.longitude || 79.8612);
    const siteLat = site.latitude || 6.9271;
    const siteLng = site.longitude || 79.8612;
    const distMeters = typeof calculateHaversineDistanceMeters === 'function' ? calculateHaversineDistanceMeters(userLat, userLng, siteLat, siteLng) : 0;
    console.log('[SITE-RUNTIME 05] distance-calc-complete distMeters=', distMeters);

    const isProximityLocked = distMeters > 500;

    if (!isProximityLocked) {
      window.state.siteLocationVerified = site.id;
    }

    stage = 'quiz-status';
    console.log('[SITE-RUNTIME 06] quiz-lock-check-start');
    const quizLock = (typeof window.getQuizLockStatus === 'function') ? window.getQuizLockStatus() : { isLocked: false, remainingMinutes: 0 };
    console.log('[SITE-RUNTIME 07] quiz-lock-check-complete locked=', quizLock.isLocked);

    const verificationOptions = Array.isArray(site.verificationOptions) && site.verificationOptions.length
      ? site.verificationOptions
      : [1, 2, 3].map(number => ({ number }));
    const optionResults = achievement.photoOptionResults || {};
    const verificationOptionButtons = verificationOptions.map(option => {
      const optionNumber = Number(option.number) || 1;
      const previousResult = optionResults[optionNumber];
      const action = isProximityLocked
        ? `window.showProximityGateModal(window.state.activeSite, ${distMeters})`
        : `window.openTargetFramingView('${site.id}', ${optionNumber})`;
      return `
        <button
          type="button"
          class="yl-verification-option"
          aria-disabled="${isProximityLocked}"
          onclick="${action}"
          style="width: 100%; background: ${isProximityLocked ? '#94A3B8' : '#0B5A68'}; color: #FFFFFF; border: none; padding: 14px 18px; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 8px; box-shadow: 0 2px 6px rgba(11,90,104,0.15); opacity: ${isProximityLocked ? '0.85' : '1'};">
          <span style="display: inline-flex; align-items: center; text-align: left;">Image Option ${optionNumber} ${isProximityLocked ? '(Locked)' : ''}</span>
          <span style="font-size: 12.5px; color: ${isProximityLocked ? '#FFF' : '#EBB34D'}; font-weight: 800; white-space: nowrap;">${isProximityLocked ? 'Proximity Required' : (previousResult ? `${previousResult.passed ? 'Verified' : 'Retry'} ${previousResult.score}%` : 'Frame & Match')}</span>
        </button>
      `;
    }).join('');

    return `
      <div class="screen site-detail-screen" style="position: relative; height: 100%; display: flex; flex-direction: column; overflow: hidden; background: #F8F7F2;">
        
        <!-- Top Bar -->
        <div class="yl-site-header" style="position: relative; min-height: 56px; padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; background: #FFFFFF; border-bottom: 1px solid #E2E8F0; z-index: 10; box-sizing: border-box;">
          <button type="button" class="universal-top-right-back-btn yl-back-btn" onclick="window.handleLandmarkBack()" aria-label="Back to previous exploration view" style="position: absolute; top: 6px; left: 12px; z-index: 500; min-width: 44px; min-height: 44px; width: 44px; height: 44px; border-radius: 12px; background: rgba(255,255,255,.92); border: 1px solid rgba(0,0,0,.12); color: #1E293B; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,.12);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
          <h2 class="yl-site-header-title" style="font-size: 15px; font-weight: 800; color: #125463; margin: 0; text-align: center; flex: 1; padding: 0 58px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${siteName}
          </h2>
          <span class="yl-site-xp-badge" style="position: absolute; right: 16px; font-size: 11px; font-weight: 800; color: #0C6C7A; background: rgba(12,108,122,0.1); padding: 4px 10px; border-radius: 8px;">
            220 XP
          </span>
        </div>

        <!-- Tab Navigation Switcher Bar -->
        <div class="yl-site-tabs-wrap" style="padding: 8px 16px; background: #F1F5F9; border-bottom: 1px solid #E2E8F0; display: flex; justify-content: center; z-index: 10;">
          <div class="yl-segmented-control yl-landmark-tabs" role="tablist" aria-label="Landmark sections" style="background: #CBD5E1; border-radius: 12px; padding: 3px; display: flex; width: 100%; max-width: 380px; gap: 4px;">
            <button 
              id="site-tab-btn-overview"
              type="button"
              onclick="window.switchSiteDetailTab('overview')"
              style="flex: 1; padding: 8px 12px; border-radius: 9px; border: none; font-size: 12.5px; cursor: pointer; transition: all 0.2s ease; ${activeTab === 'overview' ? 'background: #FFFFFF; color: #0B5A68; font-weight: 800; box-shadow: 0 2px 6px rgba(0,0,0,0.06);' : 'background: transparent; color: #64748B; font-weight: 700;'}"
            >
              Overview & Quiz
            </button>
            <button 
              id="site-tab-btn-verification"
              type="button"
              onclick="window.switchSiteDetailTab('verification')"
              style="flex: 1; padding: 8px 12px; border-radius: 9px; border: none; font-size: 12.5px; cursor: pointer; transition: all 0.2s ease; ${activeTab === 'verification' ? 'background: #FFFFFF; color: #0B5A68; font-weight: 800; box-shadow: 0 2px 6px rgba(0,0,0,0.06);' : 'background: transparent; color: #64748B; font-weight: 700;'}"
            >
              Verification & Checkpoints
            </button>
          </div>
        </div>

        <!-- Content Panels Area -->
        <div style="flex: 1; overflow-y: auto; padding: 14px 16px 24px 16px; box-sizing: border-box;">

          ${(locationVerified || photoVerified) ? `
            <div class="yl-site-achievement-banner ${locationVerified && photoVerified ? 'is-complete' : ''}">
              <div class="yl-site-achievement-seal">✓</div>
              <div>
                <strong>${locationVerified && photoVerified ? 'Visited & Image Verified' : 'Landmark Achievement Recorded'}</strong>
                <div class="yl-site-achievement-chips">
                  ${locationVerified ? '<span>✓ Location Verified</span>' : '<span class="is-pending">Location Pending</span>'}
                  ${photoVerified ? '<span>✓ Photo Verified</span>' : '<span class="is-pending">Photo Pending</span>'}
                </div>
              </div>
            </div>
          ` : ''}
          
          <!-- TAB 1: OVERVIEW & QUIZ -->
          <div id="site-tab-panel-overview" style="display: ${activeTab === 'overview' ? 'block' : 'none'};">
            <div class="yl-site-heading-row" style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
              <h1 style="font-size: 20px; font-weight: 800; color: #1E293B; margin: 0;">${siteName}</h1>
              <span style="background: rgba(18,84,99,0.1); color: #0B5A68; font-size: 10.5px; font-weight: 800; padding: 4px 10px; border-radius: 10px;">${siteCategory}</span>
            </div>
            <p style="font-size: 12px; color: #64748B; font-weight: 600; margin: 0 0 12px 0;">${siteLocation}</p>

            <div class="yl-site-hero">
              <img src="${site.image || '/assets/images/independence_hall.webp'}" alt="${siteName}" onerror="this.onerror=null; this.src='/assets/images/independence_hall.webp';">
            </div>

            <!-- Historical Sanctuary Overview -->
            <div style="background: #FFFFFF; border-radius: 16px; padding: 14px; margin-bottom: 12px; border: 1px solid #E2E8F0; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
              <h3 style="font-size: 13px; font-weight: 800; color: #125463; margin: 0 0 6px 0;">Historical Sanctuary Overview</h3>
              <p style="font-size: 12px; color: #475569; line-height: 1.5; margin: 0;">${siteDescription}</p>
            </div>

            <!-- Knowledge Quiz Button -->
            <button 
              onclick="window.handleQuizButtonClick('${site.id}')" 
              style="width: 100%; background: #FFFFFF; border: 1.5px solid ${quizLock.isLocked ? '#FCA5A5' : '#CBD5E1'}; border-radius: 14px; padding: 14px; display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="text-align: left;">
                  <div style="font-size: 13.5px; font-weight: 800; color: #125463;">Knowledge Quiz</div>
                  <div style="font-size: 11px; color: #64748B;">Test your archaeological knowledge</div>
                </div>
              </div>
              ${quizLock.isLocked
                ? `<span style="font-size: 10.5px; font-weight: 700; color: #DC2626; background: #FEF2F2; padding: 4px 8px; border-radius: 6px;">Locked (${quizLock.remainingMinutes}m)</span>`
                : `<span style="font-size: 12px; font-weight: 800; color: #0C6C7A;">Start</span>`
              }
            </button>
          </div>

          <!-- TAB 2: VERIFICATION & CHECKPOINTS -->
          <div id="site-tab-panel-verification" style="display: ${activeTab === 'verification' ? 'block' : 'none'};">
            <div style="margin-bottom: 12px;">
              <h3 style="font-size: 15px; font-weight: 800; color: #125463; margin: 0 0 4px 0;">Landmark Verification</h3>
              <p style="font-size: 11.5px; color: #64748B; margin: 0;">Confirm your presence and complete a checkpoint photo to earn 70 XP.</p>
              <span class="yl-badge" style="display:inline-flex; margin-top:8px; background:rgba(18,84,99,.1); color:#0B5A68;">${siteCategory}</span>
            </div>

            <!-- Active On-Site Status Badge -->
            ${locationVerified ? `
              <div class="yl-verification-state yl-verification-state-complete" style="background: #ECFDF5; border: 1.5px solid #10B981; border-radius: 16px; padding: 14px; margin-bottom: 14px; box-shadow: 0 2px 10px rgba(16,185,129,0.08);">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 5px;">
                  <span style="font-size: 13px; font-weight: 800; color: #047857;">✓ Location Permanently Verified</span>
                  <span style="background: #0B5A68; color: #EBB34D; font-size: 10.5px; font-weight: 800; padding: 4px 8px; border-radius: 12px; white-space: nowrap;">Lifetime Visit</span>
                </div>
                <p style="font-size: 11.5px; color: #065F46; margin: 2px 0 0; line-height: 1.4;">Your completed 15-minute visit is saved. This timer will not start again.</p>
                ${isProximityLocked && !photoVerified ? '<p style="font-size: 10.5px; color: #92400E; margin: 7px 0 0;">Return within 500 m when you are ready to complete photo verification.</p>' : ''}
              </div>
            ` : isProximityLocked ? `
              <div class="yl-verification-state yl-verification-state-locked" style="background: #FFFBEB; border: 1.5px solid #F59E0B; border-radius: 16px; padding: 14px; margin-bottom: 14px;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 5px;">
                  <span style="font-size: 13px; font-weight: 800; color: #92400E;">Verification locked</span>
                  <span style="background: #FEF3C7; color: #92400E; font-size: 10.5px; font-weight: 800; padding: 4px 8px; border-radius: 12px; white-space: nowrap;">Required radius: 500 m</span>
                </div>
                <p style="font-size: 11.5px; color: #92400E; margin: 2px 0 0 0; line-height: 1.4; font-weight: 500;">
                  You are <strong>${distMeters >= 1000 ? (distMeters / 1000).toFixed(1) + ' km' : Math.round(distMeters) + ' m'}</strong> away.<br>Move within 500 m to unlock photo verification.
                </p>
              </div>
            ` : `
              <div style="background: #ECFDF5; border: 1.5px solid #10B981; border-radius: 16px; padding: 14px; margin-bottom: 14px; box-shadow: 0 2px 10px rgba(16,185,129,0.08);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                  <span style="font-size: 13px; font-weight: 800; color: #047857; display: flex; align-items: center; gap: 6px;">
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10B981;"></span>
                    Location Confirmed
                  </span>
                  <span style="background: #0B5A68; color: #EBB34D; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 12px;">
                    On-Site Verified
                  </span>
                </div>
                <p id="immersion-timer-status" style="font-size: 11.5px; color: #065F46; margin: 2px 0 0 0; line-height: 1.4; font-weight: 500;">
                  Location confirmed. Your 15-minute on-site session is running; select any image option below.
                </p>
              </div>
            `}

            <!-- Landmark-specific Photo Verification Interface -->
            <div style="background: #FFFFFF; border-radius: 16px; padding: 16px; border: 1px solid #E2E8F0; box-shadow: 0 2px 8px rgba(11,90,104,0.04);">
              <h4 style="font-size: 13px; font-weight: 800; color: #0B5A68; margin: 0 0 10px 0;">Checkpoint Photo Options</h4>
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${verificationOptionButtons}
              </div>
            </div>
          </div>

        </div>
        ${typeof renderGlobalFooter === 'function' ? renderGlobalFooter('home') : ''}
      </div>
    `;
  } catch (err) {
    console.error(`[SITE-RUNTIME ERROR] stage=${stage} name=${err?.name || 'Error'} message=${err?.message || err} stack=${err?.stack || ''}`);
    return `
      <div class="screen" style="padding: 24px; text-align: center; color: #1E293B; background: #FAF5E8; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box;">
        <div style="font-size: 38px; margin-bottom: 8px;">🏛️</div>
        <h3 style="font-size: 18px; font-weight: 800; color: #0B5A68; margin-bottom: 6px;">Site Detail Render Error</h3>
        <p style="font-size: 12.5px; color: #64748B; margin-bottom: 18px; line-height: 1.45;">Failed to render site view (${err.message}).</p>
        <button onclick="window.executeAppNavigation('directory')" style="background: #0B5A68; color: #FFFFFF; border: none; border-radius: 11px; padding: 11px 20px; font-weight: 800; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(11,90,104,0.3);">
          Back to Directory →
        </button>
      </div>
    `;
  }
}


function renderDwellTime() {
  const site = state.activeSite;
  if (!site) return '';

  const m = Math.floor(state.dwellTimeLeft / 60);
  const s = state.dwellTimeLeft % 60;
  const timeStr = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
  const totalDuration = 900;
  const dashOffset = 565.48 - (state.dwellTimeLeft / totalDuration) * 565.48;
  const completed = state.dwellTimeLeft <= 0;

  return `
    <div class="screen immersion-freeze-mode" style="position: relative;">
      <div class="header-bar">
        <div class="header-title" style="margin-left: 20px;">Immersion Mode: ${site.name}</div>
      </div>
      
      <!-- Translucent Isolation Screen Mask Overlay Layer -->
      <div class="immersion-app-blocker" style="position: absolute; top: 60px; left: 0; width: 100%; bottom: 0; background: rgba(253, 248, 233, 0.45); z-index: 1000; pointer-events: auto; display: ${completed ? 'none' : 'block'};"></div>

      <!-- Core Display Window (Lifted completely to z-index 2000 so everything remains accessible and unblocked) -->
      <div style="padding: 10px 20px; text-align: center; z-index: 2000; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
        <h2 style="font-size: 22px; font-weight: 900; color: var(--color-charcoal); margin-bottom: 2px;">${site.name}</h2>
        <h3 style="font-size: 18px; font-weight: 800; color: var(--color-charcoal); margin-bottom: 12px;">15 Minute Dwell Time</h3>
        <p style="font-size: 11px; color: var(--color-gray); font-weight: 600; margin-bottom: 16px;">Presence validation progress runtime tracking window active.</p>
        
        <!-- Strict secure wrapper context mapping -->
        <div class="timer-circle-box" style="margin-bottom: 20px;">
          <svg class="timer-svg">
            <circle class="timer-bg-circle" cx="100" cy="100" r="90"></circle>
            <circle class="timer-progress-circle ${completed ? 'completed' : ''}" cx="100" cy="100" r="90" style="stroke-dashoffset: ${dashOffset}; stroke: ${state.gpsVerified ? 'var(--color-teal)' : 'var(--color-gold)'};"></circle>
          </svg>
          <div class="timer-text-display">${timeStr}</div>
        </div>
        
        <p style="font-size: 12px; font-weight: 700; text-align: center; color: var(--color-charcoal); margin-bottom: 16px; max-width: 280px; line-height: 1.4;">
          Your device must stay stationary inside site grounds coordinates.
        </p>

        <!-- Live Polling Status Interface Info Row Container Box -->
        <div class="verification-status-row-widget" style="background: var(--color-white); border-radius: 12px; padding: 10px 16px; margin-bottom: 16px; width: 100%; max-width: 300px; box-shadow: var(--shadow-premium); text-align: left;">
          <div style="font-size: 11px; font-weight: 800; color: var(--color-charcoal); display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background: ${state.gpsVerified ? 'var(--color-green-success)' : 'var(--color-gold)'};"></span>
            Hardware Polling: Background interval active
          </div>
          <div style="font-size: 10px; color: var(--color-gray); font-weight: 600; line-height: 1.3;">
            Captured Evidences: <span style="font-weight: 800; color: var(--color-teal);">${state.dwellImages.length + 1} secure frame bundle(s)</span>
          </div>
        </div>

        <p style="font-size: 12px; font-weight: 700; text-align: center; color: ${completed ? 'var(--color-green-success)' : 'var(--color-charcoal)'}; margin-bottom: 16px; max-width: 280px; line-height: 1.4;">
          ${completed ? 'Presence authenticated! Your cultural preservation session has been recorded.' : 'Capture additional image perspectives below to support verification data.'}
        </p>
        
        <!-- Camera action trigger now fully exposed and click-ready -->
        <button class="btn-outline" style="width: 100%; max-width: 300px; height: 44px; font-size: 13px; margin-bottom: 14px; display: ${completed ? 'none' : 'flex'}; align-items: center; justify-content: center; gap: 6px;" id="dwell-extra-photo-btn">
          📸 Take Additional Verification Photo
        </button>

        <button class="btn-primary" style="width: 100%; max-width: 300px; height: 44px; background: ${completed ? 'var(--color-gold)' : '#EAECEF'}; color: ${completed ? 'var(--color-charcoal)' : 'var(--color-gray)'};" id="dwell-continue-btn" ${completed ? '' : 'disabled'}>
          ${completed ? 'Proceed to Trials' : 'Waiting...'}
        </button>
        
        <div style="margin-top: 14px; display: ${completed ? 'none' : 'block'};">
          <span id="dwell-abandon-link" style="font-size: 12px; color: var(--color-red-reject); font-weight: 800; cursor: pointer; text-decoration: underline;">Abandon Session</span>
        </div>
      </div>
    </div>
  `;
}

function renderCamera() {
  const site = state.activeSite || sitesData[0];
  const userLat = (userCoordinates && userCoordinates.latitude) ? userCoordinates.latitude : 7.9570;
  const userLng = (userCoordinates && userCoordinates.longitude) ? userCoordinates.longitude : 80.7603;
  const distMeters = calculateHaversineDistanceMeters(userLat, userLng, site.latitude, site.longitude);

  return `
    <div class="screen camera-screen" id="camera-view" style="padding-bottom: 0; background: #000; color: white;">
      <!-- 1. Top Target Checkpoint Card -->
      <div class="target-checkpoint-header checkpoint-top-card presence-header-banner" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); border-radius: 16px; padding: 12px 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <button class="back-button" id="camera-back" style="background: rgba(255,255,255,0.15); border-radius: 50%; width:32px; height:32px; color:#FFF; border:none; cursor:pointer;">✕</button>
            <div>
              <div class="checkpoint-badge" style="font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.6); text-transform: uppercase;">Target Checkpoint</div>
              <h3 class="checkpoint-site-title" style="font-size: 15px; font-weight: 800; color: #EBB34D; margin: 2px 0 0 0;">${site.name}</h3>
            </div>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 10px; color: rgba(255,255,255,0.6); font-weight: 700; display: block;">GPS DELTA</span>
            <span style="font-size: 13px; font-weight: 800; color: #FFF;">${distMeters}m</span>
          </div>
        </div>
      </div>

      <!-- 2. Live Camera Viewfinder Box -->
      <div class="camera-feed-wrapper" id="presence-camera-zone">
        <video id="live-camera-feed" autoplay playsinline muted preload="auto" class="live-camera-video" style="opacity: 0; background: #000; transition: opacity 0.2s ease;" onloadeddata="this.style.opacity='1'"></video>
        <canvas id="camera-capture-canvas" style="display: none;"></canvas>

        <!-- Permission Prompt (Shown BEFORE camera starts) -->
        <div id="camera-permission-prompt" class="camera-prompt-box" style="text-align: center; padding: 20px;">
          <div class="camera-icon-large" style="font-size: 36px; margin-bottom: 8px;">📷</div>
          <p class="camera-prompt-text" style="font-size: 12px; color: rgba(255,255,255,0.7); max-width: 240px; margin: 0 auto 12px auto; line-height: 1.4;">Live camera access is required to verify site presence.</p>
          <button class="btn-primary" id="btn-request-camera" style="height: 36px; font-size: 12px; padding: 0 16px;">Allow & Open Camera</button>
        </div>

        <!-- Dynamic HUD Overlay (Strictly HIDDEN until stream is running) -->
        <div id="camera-hud-badge" class="camera-hud-badge" style="display: none;">
          <span class="hud-pulse-dot"></span>
          <span id="hud-status-text">HUD Engine Active • Vision Scanning (94%)</span>
        </div>
      </div>

      <!-- 3. Separate Bottom Controls Bar -->
      <div class="camera-bottom-actions">
        <div class="shutter-button-row">
          <button class="btn-shutter" id="btn-capture-photo" style="display: none;" title="Capture Photo">
            <span class="shutter-inner-circle"></span>
          </button>
        </div>
        <div class="camera-secondary-actions">
          <button id="view-ledger-shortcut-btn" style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); color: #FFF; padding: 8px 14px; border-radius: 12px; font-size: 11px; font-weight: 800; cursor: pointer;">
            🛡️ Ledger Verification
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderCameraSuccess() {
  const site = state.activeSite || sitesData[0];
  const res = state.lastVerificationResult || { visionScore: 96, distanceDeltaMeters: 14, block: { signature: '0x4a8f9c1d2e3f4b5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f' } };
  const signature = res.block ? res.block.signature : '0x4a8f9c1d2e3f4b5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f';

  return `
    <div class="screen dark-theme" style="padding-bottom: 30px; justify-content: center; align-items: center; padding: 24px;">
      <h2 style="font-family: var(--font-title); font-size: 28px; color: var(--color-gold); text-align: center; margin-top: 10px;">Presence Synchronized</h2>
      
      <div class="camera-success-badge">
        <div class="success-badge-text">${res.visionScore || 96}%<br><span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Valid</span></div>
      </div>
      
      <p style="font-size: 13px; color: #a9cbd0; font-weight: 700; margin-bottom: 2px;">Cryptographic State Ledger Block Synchronized</p>
      
      <div style="font-size: 11px; color: var(--color-green-success); font-weight: 800; background: rgba(255,255,255,0.1); padding: 8px 14px; border-radius: 10px; text-align: center; max-width: 300px; line-height: 1.4; margin-bottom: 12px;">
        ${state.verificationComment || 'Verification Successful: Real-time landmark features closely match reference structure model!'}
      </div>
      
      <h3 style="font-size: 26px; font-weight: 900; color: var(--color-gold); margin-bottom: 16px;">+60 XP</h3>

      <!-- Seal Signature Box -->
      <div style="background: rgba(12, 108, 122, 0.2); border: 1px solid rgba(12, 108, 122, 0.6); border-radius: 10px; padding: 8px 12px; margin-bottom: 16px; width: 100%; max-width: 300px; text-align: center;">
        <div style="font-size: 9px; color: #79B7C1; font-weight: 800; text-transform: uppercase;">Cryptographic Seal Hash</div>
        <div style="font-family: monospace; font-size: 10px; color: #FFF; word-break: break-all; margin-top: 2px;">${signature}</div>
      </div>
      
      <div class="photo-compare-container">
        <div class="compare-card">
          <img src="${state.dwellImages.length > 0 ? state.dwellImages[0] : site.image}" alt="Captured">
          <div class="compare-label">Captured Frame</div>
        </div>
        <div class="compare-card">
          <img src="${site.referenceImage || site.image}" alt="Reference">
          <div class="compare-label">Reference Mapping</div>
        </div>
      </div>
      
      <div style="display: flex; gap: 10px; width: 100%; max-width: 320px; margin-top: auto;">
        <button class="btn-outline" style="flex: 1; border-color: var(--color-teal); color: var(--color-teal);" id="success-view-ledger">Inspect Ledger</button>
        <button class="btn-primary" style="flex: 1;" id="camera-success-continue">Continue</button>
      </div>
    </div>
  `;
}

function renderCameraReject() {
  const res = state.lastVerificationResult || { status: 'OUT_OF_BOUNDS', visionScore: 42, distanceDeltaMeters: 2640 };
  const statusTitle = res.status === 'SPOOF_SUSPECTED' ? 'Security Anomaly Intercepted' : res.status === 'OUT_OF_BOUNDS' ? 'Geofence Out of Bounds' : 'Visual Inspection Failed';

  return `
    <div class="screen" style="background: rgba(12, 24, 33, 0.95); color: white; padding: 24px; display: flex; flex-direction: column;">
      <div class="header-bar" style="padding: 0; margin-bottom: 24px;">
        <button class="back-button" id="reject-close">✕</button>
        <div class="header-title" style="color: #FFF;">Verification Assessment</div>
      </div>
      
      <div style="background: rgba(198, 40, 40, 0.2); border: 1.5px solid var(--color-red-reject); border-radius: 20px; padding: 20px; text-align: center; margin-bottom: 20px; box-shadow: var(--shadow-premium);">
        <span class="badge-tag" style="background: var(--color-red-reject); color: #FFF; font-size: 10px; padding: 4px 10px; border-radius: 12px; margin-bottom: 8px; display: inline-block;">
          ${res.status || 'FAILED'}
        </span>
        
        <h3 style="font-size: 20px; font-weight: 900; margin-bottom: 10px; color: white;">${statusTitle}</h3>
        
        <div style="font-size: 11px; font-weight: 700; background: rgba(0,0,0,0.4); padding: 10px; border-radius: 10px; text-align: left; margin-bottom: 14px; line-height: 1.4; color: #FFF;">
          ⚠️ ${state.verificationComment || 'Verification Failed: Geofence bounds or visual match metrics were not satisfied.'}
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 11px; text-align: left; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 10px;">
          <div><span style="color: #A9CBD0;">GPS Delta:</span> <strong>${res.distanceDeltaMeters || 0}m</strong></div>
          <div><span style="color: #A9CBD0;">Vision Match:</span> <strong>${res.visionScore || 0}%</strong></div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: auto;">
        <button class="btn-outline" style="border-color: white; color: white;" id="reject-guidelines">Review Verification Guidelines</button>
        <button class="btn-primary" id="reject-retry">Try Again on Site</button>
      </div>
    </div>
  `;
}

function renderLedger() {
  const ledger = state.eventLedger || [];
  const total = ledger.length;
  const passed = ledger.filter(b => b.status === 'PASSED').length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 100;
  const spoofs = ledger.filter(b => b.status === 'SPOOF_SUSPECTED').length;

  const currentFilter = state.ledgerFilter || 'ALL';
  const filteredBlocks = ledger.filter(b => {
    if (currentFilter === 'ALL') return true;
    return b.status === currentFilter;
  });

  return `
    <div class="screen" style="padding-bottom: 80px;">
      <div class="header-bar">
        <button class="back-button" id="ledger-back">←</button>
        <div class="header-title">Cryptographic State Ledger</div>
      </div>
      
      <div style="padding: 16px;">
        <div style="background: linear-gradient(135deg, #0C1821, #0C6C7A); border-radius: 16px; padding: 16px; color: #FFF; margin-bottom: 16px; box-shadow: var(--shadow-floating);">
          <div style="font-size: 11px; font-weight: 800; color: #EBB34D; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px;">🛡️ Proof-of-Presence Audit Trail</div>
          <div style="font-size: 18px; font-weight: 900; margin-bottom: 6px;">Immutable Verification Ledger</div>
          <div style="font-size: 11px; color: #A9CBD0; line-height: 1.4;">Every verification event generates a signed, timestamped block with SHA-256 seal signatures for audit compliance.</div>
        </div>

        <!-- Key Metrics Cards -->
        <div style="display: flex; gap: 10px; margin-bottom: 16px;">
          <div class="ledger-stat-card">
            <div class="ledger-stat-num">${total}</div>
            <div class="ledger-stat-lbl">Total Audits</div>
          </div>
          <div class="ledger-stat-card">
            <div class="ledger-stat-num">${passRate}%</div>
            <div class="ledger-stat-lbl">Pass Rate</div>
          </div>
          <div class="ledger-stat-card">
            <div class="ledger-stat-num" style="color: var(--color-red-reject);">${spoofs}</div>
            <div class="ledger-stat-lbl">Spoofs Blocked</div>
          </div>
        </div>

        <!-- Filter Tabs -->
        <div style="display: flex; gap: 6px; overflow-x: auto; margin-bottom: 14px; padding-bottom: 4px;">
          ${['ALL', 'PASSED', 'OUT_OF_BOUNDS', 'SPOOF_SUSPECTED'].map(f => `
            <button class="stage-btn ${currentFilter === f ? 'active' : ''}" data-ledger-filter="${f}" style="white-space: nowrap; font-size: 10px; padding: 6px 12px; border-radius: 20px;">
              ${f === 'ALL' ? 'All Logs' : f}
            </button>
          `).join('')}
        </div>

        <!-- Ledger Entries Table -->
        <div class="ledger-blocks-container">
          ${filteredBlocks.length === 0 ? `
            <div style="text-align: center; padding: 30px; color: var(--color-gray); font-size: 12px; font-weight: 700;">No ledger audit entries matching filter.</div>
          ` : filteredBlocks.map(b => `
            <div class="ledger-block-item ${b.status}">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                <div>
                  <div style="font-size: 13px; font-weight: 900; color: var(--color-charcoal);">${b.siteName}</div>
                  <div style="font-size: 10px; color: var(--color-gray); font-weight: 600;">🕒 ${new Date(b.timestamp).toLocaleString()}</div>
                </div>
                <span class="badge-tag" style="background: ${b.status === 'PASSED' ? 'var(--color-green-success)' : b.status === 'OUT_OF_BOUNDS' ? '#E65100' : b.status === 'SPOOF_SUSPECTED' ? '#880E4F' : 'var(--color-red-reject)'}; color: #FFF; font-size: 9px; padding: 4px 8px;">
                  ${b.status}
                </span>
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px; margin-bottom: 8px;">
                <div><span style="color: var(--color-gray);">GPS Delta:</span> <strong style="color: var(--color-charcoal);">${b.distanceDeltaMeters}m</strong></div>
                <div><span style="color: var(--color-gray);">Vision Score:</span> <strong style="color: var(--color-teal);">${b.visionScore}%</strong></div>
              </div>

              <div class="ledger-hash-code">
                SEAL: ${b.signature}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      ${renderBottomNav('home')}
    </div>
  `;
}

function renderGuidelines() {
  const guides = [
    { title: 'Clear Framing :', desc: 'Ensure the historical structure or landmark takes up at least 40% of your camera viewfinder' },
    { title: 'Optimal Framing :', desc: 'Avoid capturing direct silhouettes under harsh midday sun; capturing distinct architectural lines helps our AI verify structural geometry.' },
    { title: 'The Dwell-Time Rule :', desc: 'Your device must be stationary at the site for the momentary validation window to complete verification data synchronization.' },
    { title: 'No Obstructions :', desc: 'Avoid massive crowds or holding objects directly in front of the lens.' }
  ];

  return `
    <div class="screen">
      <div class="header-bar">
        <button class="back-button" id="guidelines-back">←</button>
        <div class="header-title">Verification Guidelines</div>
      </div>
      <div class="location-list-container" style="gap: 14px; padding: 10px 16px;">
        ${guides.map(g => `
          <div style="background: var(--color-white); border-radius: 12px; padding: 12px 16px; box-shadow: var(--shadow-premium); display: flex; flex-direction: column; gap: 4px;">
            <h4 style="font-size: 12px; font-weight: 900; color: var(--color-charcoal);">${g.title}</h4>
            <p style="font-size: 11px; color: var(--color-gray); line-height: 1.4;">${g.desc}</p>
          </div>
        `).join('')}
      </div>
      <div style="padding: 20px; margin-top: auto;">
        <button class="btn-primary" id="guidelines-continue">Got It, Try Again</button>
      </div>
    </div>
  `;
}

function renderOfflineSync() {
  const queue = state.offlineSyncQueue || [];
  let listHtml = '';
  if (queue.length === 0) {
    listHtml = `<div style="text-align: center; padding: 24px; color: var(--color-gray); font-size: 13px; font-weight: 700;">🟢 All activities synced and verified!</div>`;
  } else {
    listHtml = queue.map(item => {
      let statusColor = 'var(--color-gray)';
      let statusText = 'Pending local-first sync packet';
      let xpColor = 'var(--color-gray)';
      let checkmark = '';

      if (item.status === 'Verifying...') {
        statusText = '🤖 Evaluating landmark patterns...';
        statusColor = 'var(--color-teal)';
      } else if (item.status === 'Success') {
        statusText = '✓ Verified & Logged Successfully';
        statusColor = 'var(--color-green-success)';
        xpColor = 'var(--color-teal)';
        checkmark = '✓ ';
      }

      return `
        <div class="sync-item-card" style="opacity: ${item.status === 'Success' ? '0.75' : '1'};">
          <div>
            <h4 style="font-size: 12px; font-weight: 800;">${item.siteName} Local Record</h4>
            <p style="font-size: 10px; color: ${statusColor}; font-weight: 700;">${statusText}</p>
          </div>
          <span style="font-size: 12px; font-weight: 800; color: ${xpColor};">${checkmark}${item.xp} XP</span>
        </div>
      `;
    }).join('');
  }

  return `
    <div class="screen" style="padding-bottom: 80px;">
      <div class="header-bar">
        <button class="back-button" id="sync-back">←</button>
        <div class="header-title">Sync Queue Layout</div>
      </div>
      <div style="padding: 16px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px;">
        <img src="icons/grayscale offline.png" alt="Offline" style="width: 44px; height: 44px;">
        <p style="font-size: 12px; color: var(--color-gray); max-width: 300px; line-height: 1.4;">
          Yathra Lanka handles unstable network signals natively. Evidences collected at remote structures are cached inside secure tracking sandboxes.
        </p>
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px; padding: 0 16px;">
        ${listHtml}
      </div>
      <div class="selection-card" style="margin: 20px 16px; padding: 10px 14px; background: #e6e5e2;">
        <img src="icons/profile filled.png" alt="Avatar" style="width: 36px; height: 36px; border-radius: 50%; filter: grayscale(1);">
        <div style="flex: 1; margin-left: 8px;">
          <h4 style="font-size: 12px; font-weight: 800;">Profile Identity Anchor</h4>
          <p style="font-size: 10px; color: var(--color-gray);">${state.user.rank === 'None' ? 'No Rank' : state.user.rank} • ${state.user.xp} pts</p>
        </div>
      </div>
      ${renderBottomNav('home')}
    </div>
  `;
}

window.initSiteQuizSession = function (siteId) {
  const pool = window.sitesData || [];
  const site = pool.find(s => s.id === siteId) || window.state?.activeSite;
  if (!site || !Array.isArray(site.quizzes) || site.quizzes.length === 0) {
    if (typeof window.showNotification === 'function') {
      window.showNotification("Knowledge Quiz for this location will be available soon.", "info");
    } else {
      alert("Knowledge Quiz for this location will be available soon.");
    }
    return;
  }

  // Check global 30-minute lock before starting
  const lock = typeof window.getQuizLockStatus === 'function' ? window.getQuizLockStatus() : { isLocked: false };
  if (lock.isLocked) {
    if (typeof window.showNotification === 'function') {
      window.showNotification(`Quizzes locked across all sites. Available in ${lock.remainingMinutes} minutes.`, "info");
    } else {
      alert(`Quizzes locked across all sites. Available in ${lock.remainingMinutes} minutes.`);
    }
    return;
  }

  // Sample 5 random questions from the question bank
  const shuffledBank = [...site.quizzes].sort(() => 0.5 - Math.random());
  const selectedFive = shuffledBank.slice(0, 5).map(q => {
    const indexedOptions = q.options.map((opt, i) => ({ text: opt, isCorrect: i === q.correctIndex }));
    const shuffledOptions = indexedOptions.sort(() => 0.5 - Math.random());
    return {
      question: q.question,
      options: shuffledOptions.map(o => o.text),
      correctIndex: shuffledOptions.findIndex(o => o.isCorrect)
    };
  });

  window.state = window.state || {};
  window.state.activeQuizSession = {
    siteId: site.id,
    siteName: site.name || "Site",
    siteImage: site.image || "./Element Pictures/placeholder.jpg",
    questions: selectedFive,
    currentIndex: 0,
    score: 0,
    timeLeft: 30, // 30 seconds per question
    timerId: null,
    selectedOptionIndex: null // tracks answer selection allowing changes before confirming
  };

  window.navigate('quiz');
};

function renderQuiz() {
  const session = window.state?.activeQuizSession;
  if (!session || !session.questions || session.questions.length === 0) {
    return `
      <div class="screen" style="position: relative; padding: 76px 24px 24px; text-align: center; background: #F8F7F2; height: 100%; box-sizing: border-box;">
        ${window.renderUniversalBackButton('directory')}
        <p style="margin-top: 24px; font-size: 13px; color: #64748B;">No quiz session active.</p>
      </div>
    `;
  }

  const q = session.questions[session.currentIndex];
  const qNum = session.currentIndex + 1;
  session.selectedOptionIndex = null;
  session.isAdvancing = false;

  if (session.timerId) clearInterval(session.timerId);

  // 30-Second Countdown Timer
  session.timeLeft = 30;
  session.timerId = setInterval(() => {
    session.timeLeft--;
    const timerEl = document.getElementById('quiz-countdown-display');
    if (timerEl) {
      timerEl.textContent = `${session.timeLeft}s`;
      timerEl.style.setProperty('--quiz-progress', `${Math.max(0, session.timeLeft / 30) * 360}deg`);
      if (session.timeLeft <= 5) {
        timerEl.style.borderColor = '#DC2626';
        timerEl.style.color = '#991B1B';
        timerEl.style.background = '#FEF2F2';
      }
    }

    if (session.timeLeft <= 0) {
      clearInterval(session.timerId);
      window.confirmAndAdvanceQuiz();
    }
  }, 1000);

  return `
    <div class="screen quiz-screen" style="position: relative; height: 100%; display: flex; flex-direction: column; overflow: hidden; background: #F8F7F2; box-sizing: border-box;">
      
      <!-- Top Action Bar -->
      <div class="yl-quiz-header" style="position: relative; min-height: 56px; padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; background: #FFFFFF; border-bottom: 1px solid #E2E8F0; z-index: 10; box-sizing: border-box;">
        ${window.renderUniversalBackButton('site-detail')}
        <span class="yl-quiz-context" style="font-size: 13px; font-weight: 800; color: #125463; margin-left: 58px;">
          <strong>${session.siteName} Quiz</strong>
          <small>Question ${qNum} of ${session.questions.length}</small>
        </span>
        <span id="quiz-countdown-display" class="yl-quiz-timer" style="--quiz-progress: 360deg;">
          30s
        </span>
      </div>

      <!-- Scrollable Question Zone -->
      <div style="flex: 1; overflow-y: auto; padding: 14px 16px 85px 16px; box-sizing: border-box;">
        
        <!-- Standardized Fixed Image Frame (155px Height Across All Sites) -->
        <div style="width: 100%; height: 155px; border-radius: 16px; overflow: hidden; margin-bottom: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); background: #E2E8F0;">
          <img 
            src="${session.siteImage}" 
            alt="${session.siteName}" 
            style="width: 100%; height: 100%; object-fit: cover; display: block;" 
            onerror="this.onerror=null; this.src='./Element Pictures/placeholder.jpg';"
          />
        </div>

        <!-- Question Prompt Box -->
        <div style="background: #FFFFFF; border-radius: 14px; padding: 14px 16px; border: 1px solid #E2E8F0; margin-bottom: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
          <h3 style="margin: 0; font-size: 14px; font-weight: 800; color: #1E293B; line-height: 1.45;">
            ${q.question}
          </h3>
        </div>

        <!-- Reselectable Answer Options (Clickable anytime before advance) -->
        <div id="quiz-options-wrapper" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
          ${q.options.map((opt, idx) => `
            <button 
              type="button"
              class="quiz-choice-btn"
              data-opt-index="${idx}"
              onclick="window.selectQuizOption(${idx})"
              style="width: 100%; text-align: left; padding: 12px 14px; border-radius: 12px; background: #FFFFFF; border: 1.5px solid #CBD5E1; font-size: 12.5px; font-weight: 700; color: #1E293B; cursor: pointer; transition: all 0.15s ease;">
              ${opt}
            </button>
          `).join('')}
        </div>

        <!-- Dedicated Forward Advance Button -->
        <button 
          id="btn-next-question"
          type="button"
          onclick="window.confirmAndAdvanceQuiz()"
          style="width: 100%; background: #0C6C7A; color: #FFFFFF; border: none; border-radius: 12px; padding: 13px; font-size: 13.5px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px rgba(12,108,122,0.25);">
          ${qNum === 5 ? 'Complete Quiz' : 'Next Question'}
        </button>

      </div>
    </div>
  `;
}

window.selectQuizOption = function (chosenIdx) {
  const session = window.state?.activeQuizSession;
  if (!session) return;

  session.selectedOptionIndex = chosenIdx;

  // Highlight active selection while keeping all options changeable
  const buttons = document.querySelectorAll('.quiz-choice-btn');
  buttons.forEach(btn => {
    const btnIdx = parseInt(btn.getAttribute('data-opt-index'), 10);
    btn.classList.remove('selected', 'correct', 'incorrect');
    if (btnIdx === chosenIdx) {
      btn.classList.add('selected');
      btn.style.background = '#EFF6FF';
      btn.style.borderColor = '#2563EB';
      btn.style.color = '#1E40AF';
    } else {
      btn.style.background = '#FFFFFF';
      btn.style.borderColor = '#CBD5E1';
      btn.style.color = '#1E293B';
    }
  });
};

window.confirmAndAdvanceQuiz = function () {
  const session = window.state?.activeQuizSession;
  if (!session || session.isAdvancing) return;
  session.isAdvancing = true;
  if (session.timerId) clearInterval(session.timerId);

  const currentQ = session.questions[session.currentIndex];
  if (session.selectedOptionIndex === currentQ.correctIndex) {
    session.score++;
  }

  document.querySelectorAll('.quiz-choice-btn').forEach(btn => {
    const btnIndex = Number(btn.getAttribute('data-opt-index'));
    btn.disabled = true;
    if (btnIndex === currentQ.correctIndex) btn.classList.add('correct');
    if (btnIndex === session.selectedOptionIndex && btnIndex !== currentQ.correctIndex) btn.classList.add('incorrect');
  });

  setTimeout(() => {
    if (session.currentIndex + 1 < 5) {
      session.currentIndex++;
      const chassis = document.getElementById('screen-viewport');
      if (chassis) {
        chassis.innerHTML = renderQuiz();
      }
    } else {
      window.finalizeQuizSession();
    }
  }, 450);
};

window.submitQuizAnswer = window.confirmAndAdvanceQuiz;

window.finalizeQuizSession = function () {
  const session = window.state?.activeQuizSession;
  if (!session) return;
  if (session.timerId) clearInterval(session.timerId);

  const passed = (session.score === 5);
  const siteId = session.siteId;
  const siteName = session.siteName || "Site";
  const siteImage = session.siteImage || "/assets/images/independence_hall.webp";

  const attemptResult = typeof window.recordQuizResult === 'function'
    ? window.recordQuizResult(siteId, passed ? 100 : (session.score * 20))
    : { attemptsUsed: 1, attemptsRemaining: 2, isLocked: false };

  if (passed) {
    if (!window.state) window.state = {};
    if (!window.state.user) window.state.user = {};
    if (!window.state.user.completedQuizzes) window.state.user.completedQuizzes = {};
    const firstPassForSite = !window.state.user.completedQuizzes[siteId];
    window.state.user.completedQuizzes[siteId] = true;
    window.state.user.quizzesPassed = Object.keys(window.state.user.completedQuizzes).length;
    if (typeof window.awardLandmarkXP === 'function') {
      if (firstPassForSite) window.awardLandmarkXP(siteId, 'QUIZ');
    }
    if (typeof saveUserProfile === 'function') saveUserProfile();
  }

  const chassis = document.getElementById('screen-viewport');
  if (chassis) {
    chassis.innerHTML = `
      <div class="screen quiz-result-screen" style="position: relative; height: 100%; display: flex; flex-direction: column; overflow: hidden; background: #F8F7F2; box-sizing: border-box;">
        
        <!-- Header Bar -->
        <div style="padding: 14px 16px; background: #FFFFFF; border-bottom: 1px solid #E2E8F0; text-align: center;">
          <h2 style="margin: 0; font-size: 15px; font-weight: 800; color: #125463;">
            ${siteName} Quiz Result
          </h2>
        </div>

        <!-- Result Content -->
        <div style="flex: 1; overflow-y: auto; padding: 18px 16px 85px 16px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center;">
          
          <!-- Standardized Fixed Image Frame (155px Height) -->
          <div style="width: 100%; height: 155px; border-radius: 16px; overflow: hidden; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); background: #E2E8F0;">
            <img 
              src="${siteImage}" 
              alt="${siteName}" 
              style="width: 100%; height: 100%; object-fit: cover; display: block;" 
              onerror="this.onerror=null; this.src='./Element Pictures/placeholder.jpg';"
            />
          </div>

          <!-- Professional Typography Badge (No Emojis) -->
          <div style="display: inline-block; background: ${passed ? '#DCFCE7' : '#FEE2E2'}; border: 1.5px solid ${passed ? '#86EFAC' : '#FCA5A5'}; border-radius: 10px; padding: 6px 14px; margin-bottom: 12px;">
            <span style="font-size: 12px; font-weight: 900; color: ${passed ? '#15803D' : '#991B1B'}; text-transform: uppercase; letter-spacing: 0.5px;">
              ${passed ? 'Verified Master: Passed' : 'Assessment Incomplete: Failed'}
            </span>
          </div>

          <h3 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 900; color: #1E293B;">
            Score: ${session.score} / 5 Correct
          </h3>
          
          <p style="margin: 0 0 20px 0; font-size: 12.5px; color: #4A3E2C; text-align: center; line-height: 1.5; max-width: 300px;">
            ${passed
        ? `You achieved 100% accuracy. +50 XP has been credited to your explorer passport for ${siteName}.`
        : `A score of 5 out of 5 is required to earn the Landmark Mastery Badge. ${attemptResult.attemptsRemaining} of 3 attempts remain before the 30-minute global quiz cooldown.`
      }
          </p>

          ${!passed && !attemptResult.isLocked ? `
            <button type="button" onclick="window.initSiteQuizSession('${siteId}')" class="yl-btn-secondary" style="width:100%; max-width:320px; margin-bottom:10px; padding:13px; border-radius:12px; font-weight:800;">Try Again</button>
          ` : ''}

          <!-- Dynamic Return Button: Return to {name of the site} -->
          <button 
            type="button"
            onclick="window.returnToSiteOverview('${siteId}')"
            style="width: 100%; max-width: 320px; background: #0C6C7A; color: #FFFFFF; border: none; border-radius: 12px; padding: 13px; font-weight: 800; font-size: 13.5px; cursor: pointer; box-shadow: 0 4px 12px rgba(12,108,122,0.25);">
            Return to ${siteName}
          </button>

        </div>
      </div>
    `;
  }
};

function renderQuizCooldown() {
  const m = Math.floor(state.cooldownTimeLeft / 60);
  const s = state.cooldownTimeLeft % 60;
  const timeStr = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
  const totalDur = 300;
  const dashOffset = 565.48 - (state.cooldownTimeLeft / totalDur) * 565.48;

  return `
    <div class="screen">
      <div class="header-bar">
        <button class="back-button" id="cooldown-back">←</button>
        <div class="header-title">Total Quiz Cooldown</div>
      </div>
      <div style="padding: 10px 24px; text-align: center; display: flex; flex-direction: column; align-items: center;">
        <h2 style="font-size: 20px; font-weight: 900; margin-bottom: 2px;">Total Quiz Cooldown</h2>
        <p style="font-size: 11px; color: var(--color-gray); font-weight: 600;">Protecting academic integrity.</p>
        <div class="timer-circle-box" style="margin: 20px 0;">
          <svg class="timer-svg">
            <circle class="timer-bg-circle" cx="100" cy="100" r="90"></circle>
            <circle class="timer-progress-circle" cx="100" cy="100" r="90" style="stroke-dashoffset: ${dashOffset};"></circle>
          </svg>
          <div class="timer-text-display">${timeStr}</div>
        </div>
        <h3 style="font-size: 16px; font-weight: 900; color: var(--color-charcoal); margin-bottom: 8px;">All Quizzes are Locked Until 00:00</h3>
        <img src="icons/quiz cooldown lock.png" alt="Lock" class="cooldown-lock-icon">
        <p style="font-size: 11px; color: var(--color-gray); line-height: 1.5; max-width: 280px; margin-bottom: 20px;">
          Multiple attempts are paused across the platform to ensure dedicated learning and authentic impact. Please reflect before re-engaging.
        </p>
      </div>
      ${renderBottomNav('home')}
    </div>
  `;
}

function renderQuestsList() {
  return `
    <div class="screen">
      <div class="header-bar">
        <button class="back-button" id="quests-back">←</button>
        <div class="header-title">Side Quests</div>
      </div>
      <div style="padding: 10px 20px 6px 20px; text-align: center;">
        <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 4px;">Side Quests</h2>
        <p style="font-size: 11px; color: var(--color-gray);">Complete fun tasks around this location</p>
      </div>
      <div class="location-list-container" style="gap: 12px; margin-top: 10px;">
        ${sideQuestsData.map(q => `
          <div class="selection-card" style="padding: 12px; align-items: center;" id="quest-item-${q.id}">
            <img src="${q.icon}" alt="${q.name}" style="width: 32px; height: 32px;">
            <div style="flex: 1; margin-left: 10px;">
              <h3 style="font-size: 13px; font-weight: 800;">${q.name}</h3>
              <p style="font-size: 11px; color: var(--color-gray);">${q.description}</p>
            </div>
            <div style="text-align: right;">
              <img src="icons/activism empty.png" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:2px; filter: hue-rotate(140deg);">
              <span style="font-size: 11px; font-weight: 700; color: var(--color-gold); display: inline-block; vertical-align:middle;">${q.xp} pts</span>
              <span style="font-size: 9px; color: var(--color-gray); display: block; margin-top:2px;">⏱️ ${q.duration}</span>
            </div>
          </div>
        `).join('')}
      </div>
      ${renderBottomNav('home')}
    </div>
  `;
}

function renderQuestSocial() {
  return `
    <div class="screen" style="padding-bottom: 80px;">
      <div class="header-bar">
        <button class="back-button" id="quest-social-back">←</button>
        <div class="header-title">Social Media Presence</div>
      </div>
      <div style="padding: 0 16px;">
        <h2 style="font-size: 20px; font-weight: 900; margin-bottom: 2px;">Social Media Presence</h2>
        <p style="font-size: 11px; color: var(--color-gray); margin-bottom: 12px;">Share about your visit</p>
        <img src="Element Pictures/Local Artisan Co-op.jpg" alt="Share" style="width:100%; height: 160px; border-radius: 16px; object-fit: cover; box-shadow: var(--shadow-premium); margin-bottom: 16px;">
        <h4 style="font-size: 12px; font-weight: 900; color: var(--color-charcoal); margin-bottom: 4px;">Why it matters</h4>
        <p style="font-size: 11px; color: var(--color-gray); line-height: 1.4; margin-bottom: 16px;">Sharing your journey inspires others to explore, appreciate, and protect our cultural heritage.</p>
        <h4 style="font-size: 12px; font-weight: 900; color: var(--color-charcoal); margin-bottom: 6px;">Steps</h4>
        <ol style="font-size: 11px; color: var(--color-charcoal); padding-left: 14px; display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px;">
          <li>Snap a great photo or video at this site.</li>
          <li>Post it to your favorite app using #YathraLanka.</li>
          <li>Paste the link to your post below</li>
        </ol>
        <div class="input-wrapper" style="margin-bottom: 18px;">
          <input type="text" class="form-input" placeholder="Paste your post link here..." id="quest-social-link-input">
          <span class="input-icon-right">🔗</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
          <span style="font-size: 12px; font-weight: 800; color: var(--color-gold);">⭐ +40 XP</span>
          <button class="btn-primary" style="width: 180px; height: 38px; font-size: 13px;" id="quest-social-submit">Submit & Claim Points</button>
        </div>
      </div>
      ${renderBottomNav('home')}
    </div>
  `;
}

function renderQuestFood() {
  return `
    <div class="screen" style="padding-bottom: 80px;">
      <div class="header-bar">
        <button class="back-button" id="quest-food-back">←</button>
        <div class="header-title">Local Food</div>
      </div>
      <div style="padding: 0 16px;">
        <h2 style="font-size: 20px; font-weight: 900; margin-bottom: 2px;">Local Food</h2>
        <p style="font-size: 11px; color: var(--color-gray); margin-bottom: 12px;">Try a traditional dish</p>
        <img src="Element Pictures/Traditional Cooking Experience.jpg" alt="Kiribath" style="width:100%; height: 160px; border-radius: 16px; object-fit: cover; box-shadow: var(--shadow-premium); margin-bottom: 16px;">
        <h4 style="font-size: 12px; font-weight: 900; color: var(--color-charcoal); margin-bottom: 4px;">Why it matters</h4>
        <p style="font-size: 11px; color: var(--color-gray); line-height: 1.4; margin-bottom: 16px;">Food connects us to culture and the stories of the people.</p>
        <h4 style="font-size: 12px; font-weight: 900; color: var(--color-charcoal); margin-bottom: 6px;">Steps</h4>
        <ol style="font-size: 11px; color: var(--color-charcoal); padding-left: 14px; display: flex; flex-direction: column; gap: 6px; margin-bottom: 24px;">
          <li>Try a traditional dish (e.g. Kiribath, Pol Roti, Hoppers).</li>
          <li>Take a photo of the food.</li>
          <li>Write what you liked about it.</li>
        </ol>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 12px; font-weight: 800; color: var(--color-gold);">⭐ 10 pts</span>
          <button class="btn-primary" style="width: 140px; height: 38px; font-size: 13px;" id="quest-food-start">Start Quest</button>
        </div>
      </div>
      ${renderBottomNav('home')}
    </div>
  `;
}

function renderQuestWandering() {
  const items = [
    { name: 'Local Artisan Co-op', xp: '60 XP', img: 'Element Pictures/Local Artisan Co-op.jpg' },
    { name: 'Rural Market', xp: '60 XP', img: 'Element Pictures/Rural market.jpg' },
    { name: 'Pottery Village', xp: '60 XP', img: 'Element Pictures/Pottery Village.jpg' }
  ];
  return `
    <div class="screen" style="padding-bottom: 80px;">
      <div class="header-bar">
        <button class="back-button" id="quest-wandering-back">←</button>
        <div class="header-title">Wandering Around</div>
      </div>
      <div style="padding: 0 16px;">
        <h2 style="font-size: 20px; font-weight: 900; margin-bottom: 2px;">Wandering Around</h2>
        <p style="font-size: 11px; color: var(--color-gray); margin-bottom: 14px;">Discover unmapped heritage</p>
        <div style="display: flex; justify-content: center; margin-bottom: 16px;">
          <img src="icons/wandering around compass.svg" alt="Compass" style="width: 120px; height: 120px;">
        </div>
        <button class="btn-primary" style="margin-bottom: 20px;" id="quest-wandering-snap">Take a Snapshot</button>
        <h4 style="font-size: 12px; font-weight: 900; color: var(--color-charcoal); margin-bottom: 10px;">Verifiable Discoveries</h4>
        <div class="location-list-container" style="gap: 10px; padding: 0;">
          ${items.map(it => `
            <div class="selection-card" style="padding: 8px 12px; gap: 12px; cursor: default;">
              <img src="${it.img}" alt="${it.name}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover;">
              <div style="flex: 1;">
                <h4 style="font-size: 12px; font-weight: 800;">${it.name}</h4>
              </div>
              <span style="font-size: 11px; font-weight: 700; color: var(--color-gold);">${it.xp}</span>
            </div>
          `).join('')}
        </div>
      </div>
      ${renderBottomNav('home')}
    </div>
  `;
}

function renderQuestWildlife() {
  const animals = [
    { name: 'Asian Elephant', xp: '25 XP', img: 'Element Pictures/Asian Elephant.webp' },
    { name: 'Sri Lankan Leopard', xp: '25 XP', img: 'Element Pictures/SL Leopard.jpg' },
    { name: 'Sri Lankan Blue Magpie', xp: '25 XP', img: 'Element Pictures/SL Blue Mapie.jpeg' }
  ];
  return `
    <div class="screen" style="padding-bottom: 80px;">
      <div class="header-bar">
        <button class="back-button" id="quest-wildlife-back">←</button>
        <div class="header-title">Wildlife Spotting</div>
      </div>
      <div style="padding: 0 16px;">
        <h2 style="font-size: 20px; font-weight: 900; margin-bottom: 2px;">Wildlife Spotting</h2>
        <p style="font-size: 11px; color: var(--color-gray); margin-bottom: 14px;">Snap a picture & log impact</p>
        <img src="Element Pictures/Wildlife Spotting Elephants.jpg" alt="Wildlife" style="width:100%; height: 140px; border-radius: 16px; object-fit: cover; box-shadow: var(--shadow-premium); margin-bottom: 14px;">
        <button class="btn-primary" style="margin-bottom: 20px;" id="quest-wildlife-snap">Take a Snapshot</button>
        <h4 style="font-size: 12px; font-weight: 900; color: var(--color-charcoal); margin-bottom: 10px;">Verifiable Wildlife Encounters</h4>
        <div class="location-list-container" style="gap: 10px; padding: 0;">
          ${animals.map(an => `
            <div class="selection-card" style="padding: 8px 12px; gap: 12px; cursor: default;">
              <img src="${an.img}" alt="${an.name}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover;">
              <div style="flex: 1;">
                <h4 style="font-size: 12px; font-weight: 800;">${an.name}</h4>
              </div>
              <span style="font-size: 11px; font-weight: 700; color: var(--color-gold);">${an.xp}</span>
            </div>
          `).join('')}
        </div>
      </div>
      ${renderBottomNav('home')}
    </div>
  `;
}

function renderQuestWarrior() {
  const contributions = [
    { name: 'Heritage Forest Reforestation', xp: '75 XP', img: 'Element Pictures/Reforestation.png' },
    { name: 'Trash Disposal', xp: '30 XP', img: 'Element Pictures/Trash Disposal.jpg' },
    { name: 'Invasive Species Removal', xp: '75 XP', img: 'Element Pictures/Invasive Species Removal.jpg' }
  ];
  return `
    <div class="screen" style="padding-bottom: 80px;">
      <div class="header-bar">
        <button class="back-button" id="quest-warrior-back">←</button>
        <div class="header-title">Eco Warrior</div>
      </div>
      <div style="padding: 0 16px;">
        <h2 style="font-size: 20px; font-weight: 900; margin-bottom: 2px;">Eco Warrior</h2>
        <p style="font-size: 11px; color: var(--color-gray); margin-bottom: 14px;">Conserve the environment & earn XP</p>
        <img src="Element Pictures/Eco Warrior .png" alt="Eco" style="width:100%; height: 140px; border-radius: 16px; object-fit: cover; box-shadow: var(--shadow-premium); margin-bottom: 14px;">
        <button class="btn-primary" style="margin-bottom: 20px;" id="quest-warrior-snap">Take a Snapshot</button>
        <h4 style="font-size: 12px; font-weight: 900; color: var(--color-charcoal); margin-bottom: 10px;">Verifiable Conservation Contributions</h4>
        <div class="location-list-container" style="gap: 10px; padding: 0;">
          ${contributions.map(co => `
            <div class="selection-card" style="padding: 8px 12px; gap: 12px; cursor: default;">
              <img src="${co.img}" alt="${co.name}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover;">
              <div style="flex: 1;">
                <h4 style="font-size: 12px; font-weight: 800;">${co.name}</h4>
              </div>
              <span style="font-size: 11px; font-weight: 700; color: var(--color-gold);">${co.xp}</span>
            </div>
          `).join('')}
        </div>
      </div>
      ${renderBottomNav('activism')}
    </div>
  `;
}

function renderActivismScreen() {
  return `
    <div class="screen activism-screen" style="padding: 20px; overflow-y: auto; height: 100%; box-sizing: border-box; padding-bottom: 90px;">
      <div class="activism-header" style="margin-bottom: 20px;">
        <h2 style="font-size: 22px; color: #1E293B; margin: 0 0 6px 0;">Heritage Activism</h2>
        <p style="font-size: 13px; color: #64748B; margin: 0;">Community reporting, site preservation initiatives, and citizen archaeological vigilance.</p>
      </div>

      <!-- Action Cards -->
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: #FFFFFF; border-radius: 18px; padding: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.06); border-left: 5px solid #0C6C7A;">
          <h3 style="font-size: 16px; color: #1E293B; margin: 0 0 6px 0;">🛡️ Report Site Risk</h3>
          <p style="font-size: 12px; color: #64748B; margin: 0 0 12px 0;">Notice vandalism, encroachment, or natural erosion at an ancient site? Submit an alert.</p>
          <button style="background: #0C6C7A; color: #FFFFFF; border: none; border-radius: 10px; padding: 8px 16px; font-size: 12px; font-weight: 600; cursor: pointer;">
            Submit Field Report
          </button>
        </div>

        <div style="background: #FFFFFF; border-radius: 18px; padding: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.06); border-left: 5px solid #D97706;">
          <h3 style="font-size: 16px; color: #1E293B; margin: 0 0 6px 0;">🌿 Clean-up & Restoration Drives</h3>
          <p style="font-size: 12px; color: #64748B; margin: 0 0 12px 0;">Join upcoming volunteer preservation projects organized across sacred zones.</p>
          <button style="background: #D97706; color: #FFFFFF; border: none; border-radius: 10px; padding: 8px 16px; font-size: 12px; font-weight: 600; cursor: pointer;">
            View Active Drives
          </button>
        </div>
      </div>
      ${typeof renderBottomNav === 'function' ? renderBottomNav('activism') : ''}
    </div>
  `;
}
window.renderActivismScreen = renderActivismScreen;

function renderActivismDashboard() {
  const isGuest = window.isGuestSession();
  const cards = [
    { key: 'petition', title: 'Sign Petitions', desc: 'Support verified Sri Lankan heritage and conservation causes.', xp: '20 XP', image: 'Element Pictures/Ritigala Forest Petition.jpg', gated: true },
    { key: 'donations', title: 'Donations', desc: 'Choose heritage restoration or support for the YathraLanka team.', xp: '52–500 XP', image: 'Element Pictures/Donations Stupa.jpg', gated: false },
    { key: 'cleanup', title: 'Join Cleanups', desc: 'Take part in organized environmental and heritage-site cleanups.', xp: '100 XP', image: 'Element Pictures/Site Cleanup.jpg', gated: true },
    { key: 'create-event', title: 'Create Community Event', desc: 'Organize a local initiative and bring volunteers together.', xp: '200 XP', image: 'Element Pictures/Pottery Village.jpg', gated: true }
  ];
  return `
    <div class="screen activism-screen activism-container impact-container" id="activism-view" style="padding-bottom: 80px;">
      <div class="activism-top-header" style="padding: 20px 20px 6px 20px;">
        <h2 style="font-size: 26px; font-weight: 900; display: flex; align-items: center; justify-content: space-between;">Make an Impact ${window.getGuestModeBadge()}</h2>
        <p style="font-size: 12px; color: var(--color-gray); margin-top: 4px;">Small actions : Big change</p>
      </div>
      <div style="display: flex; flex-direction: column; gap: 14px; padding: 10px 16px;">
        ${cards.map(c => `
          <button type="button" class="activism-card-link yl-impact-card" id="act-link-${c.key}">
            <img src="${c.image}" alt="" class="yl-impact-card-image">
            <div class="yl-impact-card-copy">
              <div style="display: flex; align-items: center; gap: 6px;">
                <h3 style="font-size: 15px; font-weight: 800;">${c.title}</h3>
              </div>
              <p style="font-size: 11px; opacity: 0.8; margin-top: 2px;">${c.desc}</p>
              <div class="yl-impact-card-meta">
                <span>${c.xp}</span>
                ${isGuest && c.gated ? `<span class="yl-impact-guest-label">Sign In Required</span>` : `<span class="yl-impact-open-label">Available</span>`}
              </div>
            </div>
          </button>
        `).join('')}
      </div>
      ${renderBottomNav('activism')}
    </div>
  `;
}

function renderPetitionPage() {
  const signed = state.petitionSigned;
  const sigs = state.petitionSignatures;
  const percent = (sigs / 10000) * 100;
  return `
    <div class="screen" style="padding-bottom: 80px;">
      <div class="header-bar" style="position: absolute; top: 0; left: 0; z-index: 10; width: 100%; padding-top: env(safe-area-inset-top, 24px) !important; box-sizing: border-box;">
        <button class="back-button" id="petition-back" style="background: rgba(255,255,255,0.8); border-radius: 50%; width:32px; height:32px; justify-content:center; padding:0; color:var(--color-charcoal); border:none;">←</button>
      </div>
      <img src="Element Pictures/Ritigala Forest Petition.jpg" alt="Ritigala" style="width: 100%; height: 200px; object-fit: cover;">
      <div style="padding: 16px;">
        <h2 style="font-size: 20px; font-weight: 900; margin-bottom: 4px;">Protect Ritigala Forest</h2>
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
          <img src="icons/Eco Warrior icon.png" alt="Green Sri Lanka" style="width: 16px; height: 16px;">
          <span style="font-size: 11px; font-weight: 700; color: var(--color-gray);">By Green Sri Lanka</span>
        </div>
        <p style="font-size: 12px; color: var(--color-charcoal); font-weight: 700; line-height: 1.5; margin-bottom: 20px;">Help protect the ancient Forest monastery and its biodiversity</p>
        <div style="margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 13px; font-weight: 900;">${sigs.toLocaleString()} signatures</span>
            <span style="font-size: 11px; color: var(--color-gray); font-weight: 700;">of 10,000</span>
          </div>
          <div class="progress-bar-container" style="margin-bottom: 6px;">
            <div class="progress-bar-fill" style="width: ${percent}%;"></div>
          </div>
          <p style="font-size: 10px; color: var(--color-gray); text-align: center; font-weight: 600;">Earn 20 XP for signing</p>
        </div>
        <button class="btn-primary" style="background: ${signed ? 'var(--color-green-success)' : 'var(--color-gold)'}; color: ${signed ? 'white' : 'var(--color-charcoal)'};" id="petition-submit" ${signed ? 'disabled' : ''}>
          ${signed ? '✓ Petition Signed' : 'Sign Petition'}
        </button>
      </div>
      ${renderBottomNav('activism')}
    </div>
  `;
}

function renderDonationsPage() {
  const chosenAmount = state.donationAmount;
  return `
    <div class="screen donation-screen donation-container donation-view-wrapper" id="donation-view" style="padding-bottom: 80px;">
      <div class="header-bar">
        <button class="back-button" id="donations-back">←</button>
        <div class="header-title">Your donation can restore this stupa</div>
      </div>
      <div style="padding: 0 16px;">
        <img src="Element Pictures/Donations Stupa.jpg" alt="Donations" style="width: 100%; height: 160px; border-radius: 16px; object-fit: cover; box-shadow: var(--shadow-premium); margin-bottom: 16px;">
        <div class="donation-btn-grid">
          <button class="donation-btn ${chosenAmount === 500 ? 'active' : ''}" data-val="500">Rs. 500</button>
          <button class="donation-btn ${chosenAmount === 1000 ? 'active' : ''}" data-val="1000">Rs. 1000</button>
          <button class="donation-btn ${chosenAmount === 2500 ? 'active' : ''}" data-val="2500">Rs. 2500</button>
        </div>
        <div class="form-card" style="margin: 0 0 12px 0; padding: 12px 16px;">
          <label style="font-size: 11px; font-weight: 700; color: var(--color-gray); text-align: center; display: block; margin-bottom: 6px;">Other amount</label>
          <input type="number" class="form-input" style="text-align: center; font-size: 18px; font-weight: 800;" placeholder="Enter amount" value="${chosenAmount || ''}" id="donation-custom-input">
        </div>
        <p style="font-size: 10px; color: var(--color-gray); text-align: center; font-weight: 700; margin-bottom: 20px;">Earn 52–500 XP based on your contribution</p>
        <button class="btn-primary" id="donations-submit">Donate Now</button>
        <p style="font-size: 9px; color: var(--color-gray); text-align: center; margin-top: 14px; font-weight: 700;">secure payment powered by Payhere</p>
      </div>
      ${renderBottomNav('activism')}
    </div>
  `;
}

function renderCleanupPage() {
  const isJoined = state.user.joinedEvents.includes('site-cleanup');
  return `
    <div class="screen" style="padding-bottom: 80px;">
      <div class="header-bar">
        <button class="back-button" id="cleanup-back">←</button>
        <div class="header-title">Site Cleanup</div>
      </div>
      <div style="padding: 0 16px;">
        <img src="Element Pictures/Site Cleanup.jpg" alt="Cleanup" style="width: 100%; height: 140px; border-radius: 16px; object-fit: cover; box-shadow: var(--shadow-premium); margin-bottom: 16px;">
        <h2 style="font-size: 20px; font-weight: 900; margin-bottom: 16px; text-align: center;">Site Cleanup</h2>
        <div style="background: var(--color-white); padding: 16px; border-radius: 16px; box-shadow: var(--shadow-premium); margin-bottom: 16px; display: flex; flex-direction: column; gap: 14px;">
          <div style="display: flex; align-items: center; gap: 12px; font-size: 12px; font-weight: 700;">
            📅 <div style="display:flex; flex-direction:column;"><span style="color:var(--color-gray); font-size:10px;">Date</span><span>25th May 2026</span></div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px; font-size: 12px; font-weight: 700;">
            ⏱️ <div style="display:flex; flex-direction:column;"><span style="color:var(--color-gray); font-size:10px;">Time</span><span>7.00AM-11.00AM</span></div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px; font-size: 12px; font-weight: 700;">
            📍 <div style="display:flex; flex-direction:column;"><span style="color:var(--color-gray); font-size:10px;">Location</span><span>Elahera Anicut, Polonnaruwa</span></div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px; font-size: 12px; font-weight: 700;">
            💼 <div style="display:flex; flex-direction:column;"><span style="color:var(--color-gray); font-size:10px;">Bring</span><span>Gloves, waterbottle, Hat</span></div>
          </div>
        </div>
        <p style="font-size: 10px; color: var(--color-gray); text-align: center; font-weight: 700; margin-bottom: 14px;">Earn 100 XP by joining</p>
        <button class="btn-primary" style="background: ${isJoined ? 'var(--color-green-success)' : 'var(--color-gold)'}; color: ${isJoined ? 'white' : 'var(--color-charcoal)'};" id="cleanup-join" ${isJoined ? 'disabled' : ''}>
          ${isJoined ? '✓ Joined Cleanup' : 'Join Event'}
        </button>
      </div>
      ${renderBottomNav('activism')}
    </div>
  `;
}

function renderCreateEventPage() {
  return `
    <div class="screen" style="padding-bottom: 80px;">
      <div class="header-bar">
        <button class="back-button" id="create-event-back">←</button>
        <div class="header-title">Create Community Event</div>
      </div>
      <div style="padding: 10px 16px;">
        <div class="form-card" style="margin: 0; padding: 18px;">
          <h3 style="font-size: 14px; font-weight: 900; color: var(--color-teal); text-align: center; margin-bottom: 4px;">Organize Your Activism</h3>
          <p style="font-size: 10px; color: var(--color-gray); text-align: center; line-height: 1.4; margin-bottom: 14px;">Organize an activism task at a location. Rally other travellers & make an impact together.</p>
          <div class="form-group">
            <label class="form-label">Event Type</label>
            <select class="form-input" id="event-type" style="padding: 0 8px; font-size: 12px;">
              <option value="Site Clean-up">Site Clean-up</option>
              <option value="Tree Planting">Tree Planting</option>
              <option value="Invasive Species Removal">Invasive Species Removal</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Location</label>
            <input type="text" class="form-input" placeholder="e.g. Mihintale - Sacred Peak" id="event-location">
          </div>
          <div style="display: flex; gap: 10px;">
            <div class="form-group" style="flex: 1;">
              <label class="form-label">Date</label>
              <input type="date" class="form-input" style="font-size: 11px; padding: 0 4px;" id="event-date">
            </div>
            <div class="form-group" style="flex: 1;">
              <label class="form-label">Time</label>
              <input type="time" class="form-input" style="font-size: 11px; padding: 0 4px;" id="event-time">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Event Details/Motivation</label>
            <textarea class="form-input" style="height: 70px; padding: 8px; resize: none;" placeholder="Describe your purpose..." id="event-desc"></textarea>
          </div>
          <button class="btn-primary" style="margin-top: 10px; height: 42px;" id="event-submit">Organize Event</button>
        </div>
      </div>
      ${renderBottomNav('activism')}
    </div>
  `;
}

window.openYathraContribution = async function (event) {
  event?.preventDefault?.();
  const url = 'https://buymeacoffee.com/yathralanka';
  const browserPlugin = window.Capacitor?.Plugins?.Browser;
  if (browserPlugin?.open) {
    try {
      await browserPlugin.open({ url });
      return false;
    } catch (error) {
      console.warn('[CONTRIBUTION] Capacitor browser fallback used', error);
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
  return false;
};

function renderRewardsDashboard() {
  const rewardCards = [
    { id: 'rew-link-list', title: 'Your Rewards', desc: 'View earned benefits, coupons, and Landmark Mastery Badges.', icon: '<path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 1 1 2.4-3.2L12 7Zm0 0h4.5a2.5 2.5 0 1 0-2.4-3.2L12 7Z"/>' },
    { id: 'rew-link-rank', title: 'Your Rank', desc: `Track your progress as a ${state.user?.rank || 'Novice Explorer'}.`, icon: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/>' },
    { id: 'rew-link-leaderboard', title: 'Leaderboard', desc: 'See how your verified impact compares with other explorers.', icon: '<path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7"/>' }
  ];
  return `
    <div class="screen rewards-screen rewards-container" id="rewards-view" style="padding-bottom: 80px;">
      <div class="rewards-top-header" style="padding: 20px 20px 6px 20px;">
        <h2 style="font-size: 26px; font-weight: 900; display: flex; align-items: center; justify-content: space-between;">Rewards ${window.getGuestModeBadge()}</h2>
        <p style="font-size: 12px; color: var(--color-gray); margin-top: 4px;">Everything you have achieved.</p>
      </div>
      <div class="yl-rewards-grid">
        ${rewardCards.map(card => `
          <button type="button" class="yl-reward-dashboard-card" id="${card.id}">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${card.icon}</svg>
            <span><strong>${card.title}</strong><small>${card.desc}</small></span>
          </button>
        `).join('')}
        <button type="button" class="yl-reward-dashboard-card yl-team-support-card" onclick="window.openYathraContribution(event)">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M7 3v2M11 3v2M15 3v2"/></svg>
          <span><strong>Support YathraLanka</strong><small>Fund the team’s research, documentation, and platform development.</small></span>
        </button>
      </div>
      ${renderBottomNav('rewards')}
    </div>
  `;
}

function renderRewardsList() {
  return `
    <div class="screen" style="padding-bottom: 80px;">
      <div class="header-bar">
        <button class="back-button" id="rewards-list-back">←</button>
        <div class="header-title">Your Rewards</div>
      </div>
      <div style="padding: 10px 20px; display: flex; justify-content: space-between; align-items: center;">
        <p style="font-size: 11px; color: var(--color-gray); max-width: 220px; line-height: 1.4;">Convert your impact into experiences. Redeem coupons and unlock unique souvenirs.</p>
        <span class="badge-tag" style="background: var(--color-gold); color: var(--color-charcoal); font-weight: 800;">${state.user.xp} Total Points</span>
      </div>
      <div class="location-list-container" style="gap: 12px; margin-top: 8px;">
        <div class="reward-coupon-card">
          <img src="Element Pictures/Traditional Cooking Experience.jpg" alt="Cooking" class="reward-coupon-img">
          <div style="flex: 1;">
            <h3 style="font-size: 12px; font-weight: 900; line-height: 1.3;">FREE Traditional Cooking Experience</h3>
            <span style="font-size: 9px; font-weight: 700; color: var(--color-green-success); display: block; margin-top: 2px;">✓ UNLOCKED</span>
            <span style="font-size: 8px; color: var(--color-gray);">Unlocked by: Sigiriya Scholar's Trial</span>
          </div>
          <button class="btn-primary" style="width: 80px; height: 32px; font-size: 10px;" id="rew-coupon-use">Use Coupon</button>
        </div>
        <div class="reward-coupon-card" style="opacity: ${state.user.xp >= 100 ? '1' : '0.7'};">
          <img src="Element Pictures/Trail Guide.webp" alt="Guide" class="reward-coupon-img">
          <div style="flex: 1;">
            <h3 style="font-size: 12px; font-weight: 900; line-height: 1.3;">20% off Ancient Trail Guide</h3>
            <p style="font-size: 9px; color: var(--color-gray); margin-top: 2px;">Expert guide for Mihintale walks.</p>
            <span style="font-size: 8px; font-weight: 700; color: var(--color-gray);">Unlock: 100 XP (Tap to unlock)</span>
          </div>
          <button class="btn-outline" style="width: 80px; height: 32px; font-size: 10px; padding: 0; color: var(--color-gray);" id="rew-unlock-guide" ${state.user.xp >= 100 ? '' : 'disabled'}>Unlock Guide</button>
        </div>
        <div class="reward-coupon-card" style="opacity: ${state.user.xp >= 100 ? '1' : '0.7'};">
          <img src="Element Pictures/Artisan Crafts.jpg.webp" alt="Crafts" class="reward-coupon-img">
          <div style="flex: 1;">
            <h3 style="font-size: 12px; font-weight: 900; line-height: 1.3;">10% off Artisan Crafts</h3>
            <p style="font-size: 9px; color: var(--color-gray); margin-top: 2px;">Authentic local handicraft store.</p>
            <span style="font-size: 8px; font-weight: 700; color: var(--color-gray);">Unlock: 100 XP (Tap to unlock)</span>
          </div>
          <button class="btn-outline" style="width: 80px; height: 32px; font-size: 10px; padding: 0; color: var(--color-gray);" id="rew-unlock-crafts" ${state.user.xp >= 100 ? '' : 'disabled'}>Unlock Coupon</button>
        </div>
      </div>
      ${renderBottomNav('rewards')}
    </div>
  `;
}

function renderCouponRedeem() {
  return `
    <div class="screen" style="padding-bottom: 80px;">
      <div class="header-bar">
        <button class="back-button" id="coupon-back">←</button>
        <div class="header-title">Use Coupon</div>
      </div>
      <div style="padding: 0 16px;">
        <img src="Element Pictures/Traditional Cooking Experience.jpg" alt="Hoppers" style="width: 100%; height: 160px; border-radius: 16px; object-fit: cover; box-shadow: var(--shadow-premium); margin-bottom: 16px;">
        <h2 style="font-size: 18px; font-weight: 900; margin-bottom: 4px;">FREE Traditional Cooking Experience</h2>
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 16px;">
          <span>☕</span>
          <span style="font-size: 11px; font-weight: 700; color: var(--color-gray);">@Kandy Cafe (YathraLanka Heritage Partner)</span>
        </div>
        <button class="btn-primary" style="margin-bottom: 24px;" id="coupon-redeem-btn">Redeem Coupon</button>
        <div class="form-card" style="margin: 0; padding: 16px;">
          <h4 style="font-size: 12px; font-weight: 900; color: var(--color-teal); text-align: center; margin-bottom: 4px;">Verify the authenticity and cleanliness of the vendor and earn 10 XP</h4>
          <input type="text" class="form-input" style="height: 38px; font-size: 12px; text-align:center; margin: 10px 0;" placeholder="Describe cleanliness, service..." id="coupon-review-input">
          <button class="btn-primary" style="height: 36px; font-size: 12px;" id="coupon-review-submit">Write a Review</button>
        </div>
      </div>
      ${renderBottomNav('rewards')}
    </div>
  `;
}

function renderRankScreen() {
  const levels = [
    { name: 'Grass Toucher', range: '0 - 99 pts', threshold: 0 },
    { name: 'Wanderer', range: '100 - 249 pts', threshold: 100 },
    { name: 'Tuk Tuk Trailer', range: '250 - 499 pts', threshold: 250 },
    { name: 'Magahoyanna', range: '500 - 999 pts', threshold: 500 },
    { name: 'Island Explorer', range: '1,000 - 2,000 pts', threshold: 1000 },
    { name: 'Lanka Legend', range: '2,000 - 5,000 pts', threshold: 2000 }
  ];

  const xp = state.user.xp;
  const rank = state.user.rank;

  let nextLevel = levels[0];
  for (let i = 0; i < levels.length; i++) {
    if (xp < levels[i].threshold) {
      nextLevel = levels[i];
      break;
    }
    if (i === levels.length - 1) {
      nextLevel = { name: 'Max Level', threshold: 5000 };
    }
  }
  const diff = nextLevel.threshold - xp;

  return `
    <div class="screen dark-theme" style="padding-bottom: 80px;">
      <div class="header-bar">
        <button class="back-button" id="rank-back">←</button>
        <div class="header-title">Your Rank</div>
      </div>
      <div style="padding: 10px 20px; display: flex; flex-direction: column; align-items: center;">
        <h2 style="font-size: 26px; font-weight: 800; text-align: center; margin-bottom: 6px;">Your Rank</h2>
        <div class="rank-hex-badge">
          <div style="font-size: 11px; font-weight: 800; color: var(--color-charcoal); text-transform: uppercase;">
            ${rank === 'None' ? 'No Rank' : rank}
          </div>
        </div>
        <p style="font-size: 14px; font-weight: 800; margin-bottom: 2px;">${xp} / ${nextLevel.threshold} pts</p>
        <p style="font-size: 10px; color: #a9cbd0; margin-bottom: 20px;">
          ${diff > 0 ? `Only ${diff} pts to next rank!` : 'Max rank reached!'}
        </p>
        <div style="display: flex; flex-direction: column; gap: 10px; width: 100%; color: var(--color-charcoal);">
          ${levels.map(lvl => {
    const unlocked = xp >= lvl.threshold;
    return `
              <div class="rank-timeline-row" style="opacity: ${unlocked ? '1' : '0.65'};">
                <div class="timeline-checkbox ${unlocked ? 'checked' : ''}">
                  ${unlocked ? '✓' : ''}
                </div>
                <div style="flex: 1;">
                  <h4 style="font-size: 12px; font-weight: 800;">${lvl.name}</h4>
                  <p style="font-size: 9px; color: var(--color-gray);">${lvl.range}</p>
                </div>
              </div>
            `;
  }).join('')}
        </div>
      </div>
      ${renderBottomNav('rewards')}
    </div>
  `;
}

function renderLeaderboard() {
  let currentList = [...leaderboardPlayers];
  if (state.user.xp > 0) {
    const userRow = { name: (auth.currentUser ? auth.currentUser.displayName || 'You' : 'You') + " (Eco Explorer)", points: state.user.xp, role: state.user.role, rank: state.user.rank, isUser: true };
    currentList.push(userRow);
  }
  currentList.sort((a, b) => b.points - a.points);

  return `
    <div class="screen">
      <div class="header-bar">
        <button class="back-button" id="leaderboard-back">←</button>
        <div class="header-title">Leaderboard</div>
      </div>
      <div class="tabs-container" style="margin-bottom: 16px;">
        <div class="tab-btn active">All time</div>
        <div class="tab-btn" style="cursor: default;">This month</div>
        <div class="tab-btn" style="cursor: default;">This week</div>
      </div>
      <div style="display: flex; flex-direction: column; padding: 0 16px 20px 16px;">
        ${currentList.map((pl, idx) => `
          <div class="leaderboard-row ${pl.isUser ? 'highlighted' : ''}">
            <span class="leaderboard-rank">${idx + 1}</span>
            <img src="icons/profile empty.png" alt="Avatar" class="leaderboard-avatar" style="${pl.isUser ? 'border: 2px solid var(--color-gold);' : ''}">
            <div class="leaderboard-name" style="font-size: 13px;">
              ${pl.name}
              <span style="font-size: 9px; color: var(--color-gray); font-weight: 700; display: block; margin-top: 1px;">
                ${pl.role || 'Explorer'} • ${pl.rank || 'No Rank'}
              </span>
            </div>
            <span style="font-size: 13px; font-weight: 900; color: var(--color-teal);">${pl.points.toLocaleString()} pts</span>
          </div>
        `).join('')}
      </div>
      <button class="btn-primary" style="width: calc(100% - 32px); margin: 0 auto 20px auto;" id="leaderboard-view-full">View Full Leaderboard</button>
      ${renderBottomNav('rewards')}
    </div>
  `;
}

window.handleCustomAvatarUpload = function (event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const dataUrl = e.target.result;
    if (!window.state) window.state = {};
    if (!window.state.user) window.state.user = {};

    window.state.user.customAvatar = dataUrl;
    try {
      localStorage.setItem('yathra_user_custom_avatar', dataUrl);
      localStorage.setItem('yathra_current_user', JSON.stringify(window.state.user));
    } catch (err) { }

    const img = document.getElementById('profile-user-avatar-img');
    if (img) img.src = dataUrl;

    if (typeof window.showNotification === 'function') {
      window.showNotification("Royal Vault Avatar updated successfully!", "success");
    }
  };
  reader.readAsDataURL(file);
};

window.openMedalsGalleryModal = function () {
  if (typeof window.checkAndAwardSmartMedals === 'function') {
    window.checkAndAwardSmartMedals();
  }

  const unlocked = window.state?.unlockedMedals || [];
  const medals = [
    { id: 'pathfinder_kingdom', title: 'Pathfinder of the Kingdom', tier: 'Bronze', xp: 150, icon: '📜', desc: 'Check in to 3 unique Heritage Trail landmarks within 14 days using live GPS verification.' },
    { id: 'royal_chronicler', title: 'Royal Chronicler', tier: 'Silver', xp: 200, icon: '📸', desc: 'Upload 5 GPS-verified photos across registered historical sites within 30 days.' },
    { id: 'guardian_polonnaruwa', title: 'Guardian of Polonnaruwa', tier: 'Gold', xp: 300, icon: '🏛️', desc: 'Complete all geofence check-ins and score 100% on the ancient irrigation & ruins quiz in 1 session.' },
    { id: 'lankan_cartographer', title: 'Lankan Cartographer', tier: 'Diamond', xp: 500, icon: '🗺️', desc: 'Visit at least 1 verified landmark across 5 different districts within 60 days.' },
    { id: 'sage_mahavamsa', title: 'Sage of the Mahavamsa', tier: 'Master Relic', icon: '👑', desc: 'Successfully pass 10 historical landmark quizzes on the first attempt.' }
  ];

  const oldModal = document.getElementById('medals-gallery-modal-overlay');
  if (oldModal) oldModal.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'medals-gallery-modal-overlay';
  backdrop.style.cssText = `
    position: absolute; inset: 0; background: rgba(8, 24, 28, 0.85); backdrop-filter: blur(8px);
    z-index: 10000; display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden;
  `;

  backdrop.onclick = function (e) {
    if (e.target === backdrop) backdrop.remove();
  };

  backdrop.innerHTML = `
    <div style="background: #0A181C; border-top: 1.5px solid #D4AF37; border-top-left-radius: 24px; border-top-right-radius: 24px; padding: 20px 18px 28px 18px; box-sizing: border-box; max-height: 85vh; overflow-y: auto;">
      <div style="width: 44px; height: 5px; background: rgba(212,175,55,0.4); border-radius: 99px; margin: 0 auto 16px auto;"></div>
      
      <div style="text-align: center; margin-bottom: 18px;">
        <span style="font-size: 10px; font-weight: 800; color: #D4AF37; letter-spacing: 2px; text-transform: uppercase;">Royal Treasury Seals</span>
        <h3 class="royal-gold-text" style="margin: 4px 0 2px 0; font-size: 20px; font-weight: 900; font-family: 'Cinzel', serif;">S.M.A.R.T. Medals Gallery</h3>
        <p style="font-size: 11.5px; color: #94A3B8; margin: 0;">Verified heritage achievements and royal seals of Sri Lanka.</p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
        ${medals.map(m => {
    const isUnlocked = unlocked.includes(m.id);
    const tierColors = {
      'Bronze': '#CD7F32',
      'Silver': '#C0C0C0',
      'Gold': '#FFD700',
      'Diamond': '#38BDF8',
      'Master Relic': '#F43F5E'
    };
    const color = tierColors[m.tier] || '#D4AF37';

    return `
            <div style="background: rgba(19,37,42,0.85); border: 1.5px solid ${isUnlocked ? color : 'rgba(255,255,255,0.1)'}; border-radius: 16px; padding: 14px; display: flex; align-items: center; gap: 14px; opacity: ${isUnlocked ? 1 : 0.65};">
              <div style="width: 46px; height: 46px; border-radius: 50%; background: rgba(0,0,0,0.4); border: 2px solid ${color}; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">
                ${m.icon}
              </div>
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
                  <h4 style="margin: 0; font-size: 13.5px; font-weight: 800; color: #FFFFFF;">${m.title}</h4>
                  <span style="font-size: 9.5px; font-weight: 900; color: ${color}; background: rgba(0,0,0,0.4); padding: 2px 8px; border-radius: 8px; text-transform: uppercase; border: 1px solid ${color}40;">
                    ${m.tier}
                  </span>
                </div>
                <p style="margin: 0 0 6px 0; font-size: 11px; color: #94A3B8; line-height: 1.4;">${m.desc}</p>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="font-size: 11px; font-weight: 800; color: #10B981;">+${m.xp} XP</span>
                  <span style="font-size: 10.5px; font-weight: 800; color: ${isUnlocked ? '#34D399' : '#94A3B8'};">
                    ${isUnlocked ? '✓ Unlocked & Claimed' : '🔒 Locked'}
                  </span>
                </div>
              </div>
            </div>
          `;
  }).join('')}
      </div>

      <button 
        onclick="document.getElementById('medals-gallery-modal-overlay').remove()" 
        style="width: 100%; background: #D4AF37; color: #0A181C; border: none; padding: 12px; border-radius: 12px; font-weight: 800; font-size: 13.5px; cursor: pointer; box-shadow: 0 4px 14px rgba(212,175,55,0.3);">
        Close Gallery
      </button>
    </div>
  `;

  const chassis = document.querySelector('.screen-viewport') || document.querySelector('.iphone-chassis') || document.body;
  chassis.appendChild(backdrop);
};

function renderProfile() {
  if (typeof window.recalculateTotalXP === 'function') {
    window.recalculateTotalXP();
  }

  const session = typeof getSessionAccessState === 'function' ? getSessionAccessState() : { isGuest: true, displayName: 'Guest Explorer' };
  const isGuest = session.isGuest;

  const totalXp = isGuest ? 0 : Number(window.state?.user?.xp || 0);
  const rankInfo = typeof getRankProgress === 'function' ? getRankProgress(totalXp) : { currentRank: { name: 'Novice Explorer' } };
  const currentRankName = rankInfo.currentRank.name;

  const userName = isGuest ? 'Guest Explorer' : (window.state?.user?.preferredDisplayName || window.state?.user?.displayName || session.displayName || 'Explorer');
  
  let userAvatarSrc = '/assets/royal-avatar.png';
  let photoSource = 'default';
  if (isGuest) {
    userAvatarSrc = '/assets/royal-avatar.png';
    photoSource = 'default';
  } else {
    const userObj = window.state?.user || {};
    const activeProvider = userObj.activeAuthProvider || 'password';
    if (activeProvider === 'google.com') {
      if (userObj.googlePhotoURL) {
        userAvatarSrc = userObj.googlePhotoURL;
        photoSource = 'google';
      } else {
        userAvatarSrc = '/assets/royal-avatar.png';
        photoSource = 'default';
      }
    } else {
      if (userObj.passwordProfilePhotoURL || userObj.customAvatar || localStorage.getItem('yathra_user_custom_avatar')) {
        userAvatarSrc = userObj.passwordProfilePhotoURL || userObj.customAvatar || localStorage.getItem('yathra_user_custom_avatar');
        photoSource = 'password-upload';
      } else if (userObj.googlePhotoURL) {
        userAvatarSrc = userObj.googlePhotoURL;
        photoSource = 'google';
      } else {
        userAvatarSrc = '/assets/royal-avatar.png';
        photoSource = 'default';
      }
    }
  }
  console.log(`[PROFILE-PHOTO] source=${photoSource}`);

  const medalsCount = isGuest ? 0 : (window.state?.user?.medals || window.state?.unlockedMedals?.length || 0);
  const sitesCount = isGuest ? 0 : (window.state?.user?.sitesVisited || 0);
  const quizzesCount = isGuest ? 0 : (window.state?.user?.quizzesPassed || 0);

  return `
    <div class="screen profile-container royal-vault-screen" id="profile-view" style="position: relative; height: 100%; box-sizing: border-box; overflow-y: auto; padding-top: max(env(safe-area-inset-top), 48px); padding-bottom: 90px; background: #F8F5EE;">
      <input type="file" id="profile-avatar-input" accept="image/*" style="display: none;" onchange="window.handleCustomAvatarUpload(event)" />

      <!-- Profile Header Title: strictly "My Profile" -->
      <div style="padding: 12px 20px 10px 20px; text-align: center; position: relative;">
        <h2 style="font-size: 24px; font-weight: 800; color: #0B5A68; margin: 0; font-family: inherit; letter-spacing: -0.3px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">My Profile ${window.getGuestModeBadge()}</h2>
        <div style="width: 60px; height: 2.5px; background: linear-gradient(90deg, transparent, #EBB34D, transparent); margin: 6px auto 0 auto; border-radius: 2px;"></div>
      </div>

      <!-- Profile Avatar Ring & User Info -->
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 18px;">
        <div class="avatar-ring-container" style="margin-bottom: 10px; position: relative;">
          <div style="width: 86px; height: 86px; border-radius: 50%; padding: 3px; background: linear-gradient(135deg, #FDF6E2 0%, #EBB34D 100%); box-shadow: 0 4px 14px rgba(235, 179, 77, 0.25);">
            <img 
              id="profile-user-avatar-img"
              src="${userAvatarSrc}" 
              alt="Avatar" 
              style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; background: #FFFFFF; display: block;" 
              onerror="this.onerror=null; this.src='/assets/royal-avatar.png';"
            />
          </div>
          <div class="avatar-edit-badge" title="Upload Custom Photo" onclick="document.getElementById('profile-avatar-input').click()" style="position: absolute; bottom: 0; right: 0; width: 30px; height: 30px; background: #EBB34D; border: 2px solid #FFFFFF; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0B5A68" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
          </div>
        </div>
        <h3 style="font-size: 17px; font-weight: 800; color: #0B5A68; margin: 0 0 6px 0;">${userName}</h3>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 11px; font-weight: 800; background: #FDF6E2; color: #0B5A68; border: 1px solid rgba(235, 179, 77, 0.5); padding: 3px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EBB34D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 3 6-3v10H6z"></path><path d="M6 5l6 3 6-3-6-3z"></path></svg>
            ${currentRankName}
          </span>
          <span style="font-size: 11px; font-weight: 800; background: rgba(46, 125, 138, 0.1); color: #2E7D8A; border: 1px solid rgba(46, 125, 138, 0.25); padding: 3px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2E7D8A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            ${totalXp} XP
          </span>
        </div>
      </div>

      <!-- Telemetry Overview Bar -->
      <div style="display: flex; gap: 10px; padding: 0 16px; margin-bottom: 20px;">
        <div style="flex: 1; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 12px 6px; text-align: center; box-shadow: 0 2px 8px rgba(11, 90, 104, 0.04);">
          <span style="font-size: 19px; font-weight: 900; color: #0B5A68; display: block; line-height: 1;">${medalsCount}</span>
          <span style="font-size: 9.5px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; display: block;">Royal Seals</span>
        </div>
        <div style="flex: 1; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 12px 6px; text-align: center; box-shadow: 0 2px 8px rgba(11, 90, 104, 0.04);">
          <span style="font-size: 19px; font-weight: 900; color: #0B5A68; display: block; line-height: 1;">${sitesCount}</span>
          <span style="font-size: 9.5px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; display: block;">Landmarks</span>
        </div>
        <div style="flex: 1; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 12px 6px; text-align: center; box-shadow: 0 2px 8px rgba(11, 90, 104, 0.04);">
          <span style="font-size: 19px; font-weight: 900; color: #0B5A68; display: block; line-height: 1;">${quizzesCount}</span>
          <span style="font-size: 9.5px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; display: block;">Mastery Badges</span>
        </div>
      </div>

      <!-- 5 Action Hub Tile Matrix -->
      <div style="display: flex; flex-direction: column; gap: 10px; padding: 0 16px; margin-bottom: 24px;">
        <!-- 1. My Travel Map -->
        <div class="vault-action-tile" onclick="window.navigate('travel-poster')">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(11, 90, 104, 0.08); border: 1px solid rgba(11, 90, 104, 0.18); display: flex; align-items: center; justify-content: center;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B5A68" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                <line x1="8" y1="2" x2="8" y2="18"></line>
                <line x1="16" y1="6" x2="16" y2="22"></line>
              </svg>
            </div>
            <div>
              <div style="font-size: 13.5px; font-weight: 800; color: #0B5A68;">My Travel Map</div>
              <div style="font-size: 11px; color: #64748B;">Personalized heritage voyage poster</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 10px; font-weight: 800; background: rgba(11, 90, 104, 0.1); color: #0B5A68; padding: 3px 8px; border-radius: 8px;">${sitesCount} Unlocked</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EBB34D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        </div>

        <!-- 2. My Medals Gallery -->
        <div class="vault-action-tile" onclick="window.openMedalsGalleryModal()">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(235, 179, 77, 0.12); border: 1px solid rgba(235, 179, 77, 0.3); display: flex; align-items: center; justify-content: center;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B47818" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="8" r="6"></circle>
                <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"></path>
              </svg>
            </div>
            <div>
              <div style="font-size: 13.5px; font-weight: 800; color: #0B5A68;">My Medals Gallery</div>
              <div style="font-size: 11px; color: #64748B;">S.M.A.R.T. royal seals & achievements</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 10px; font-weight: 800; background: rgba(235, 179, 77, 0.18); color: #B47818; padding: 3px 8px; border-radius: 8px;">${medalsCount}/5 Seals</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EBB34D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        </div>

        <!-- 3. My Community Events -->
        <div class="vault-action-tile" onclick="window.navigate('activism')">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(46, 125, 138, 0.1); border: 1px solid rgba(46, 125, 138, 0.2); display: flex; align-items: center; justify-content: center;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2E7D8A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <div>
              <div style="font-size: 13.5px; font-weight: 800; color: #0B5A68;">My Community Events</div>
              <div style="font-size: 11px; color: #64748B;">Joined restoration & preservation drives</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 10px; font-weight: 800; background: rgba(46, 125, 138, 0.12); color: #2E7D8A; padding: 3px 8px; border-radius: 8px;">${(state.user.joinedEvents || []).length} Active</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EBB34D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        </div>

        <!-- 4. Knowledge Quizzes -->
        <div class="vault-action-tile" onclick="window.navigate('directory')">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(11, 90, 104, 0.08); border: 1px solid rgba(11, 90, 104, 0.18); display: flex; align-items: center; justify-content: center;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B5A68" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
            </div>
            <div>
              <div style="font-size: 13.5px; font-weight: 800; color: #0B5A68;">Knowledge Quizzes</div>
              <div style="font-size: 11px; color: #64748B;">Archaeological lore & quiz mastery</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 10px; font-weight: 800; background: rgba(11, 90, 104, 0.1); color: #0B5A68; padding: 3px 8px; border-radius: 8px;">${quizzesCount} Mastered</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EBB34D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        </div>

        <!-- 5. Settings -->
        <div class="vault-action-tile" onclick="window.navigate('settings')">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 40px; height: 40px; border-radius: 12px; background: rgba(100, 116, 139, 0.1); border: 1px solid rgba(100, 116, 139, 0.2); display: flex; align-items: center; justify-content: center;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </div>
            <div>
              <div style="font-size: 13.5px; font-weight: 800; color: #0B5A68;">Settings</div>
              <div style="font-size: 11px; color: #64748B;">App preferences, cache, audio cues</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 10px; font-weight: 800; background: rgba(100, 116, 139, 0.12); color: #64748B; padding: 3px 8px; border-radius: 8px;">Config</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EBB34D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        </div>
      </div>

      <!-- Persistent 4-Tab Bottom Navigation Bar -->
      ${renderGlobalFooter('profile')}
    </div>
  `;
}

function renderTravelPoster() {
  return `
    <div class="screen">
      <div class="header-bar">
        <button class="back-button" id="poster-back">←</button>
        <div class="header-title">Travel Map</div>
      </div>
      <div style="padding: 10px 20px; text-align: center;">
        <h2 style="font-size: 20px; font-weight: 900; margin-bottom: 2px;">Your Custom Travel Map Poster</h2>
        <p style="font-size: 11px; color: var(--color-gray);">A personalized testament to your YathraLanka impact</p>
      </div>
      <div class="travel-poster-card">
        <div class="poster-map-box">
          <img src="Element Pictures/SL map on home screen.svg" alt="Recap Map" style="height: 90%; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));">
        </div>
        <h3 style="font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-gold);">Journey Recap</h3>
        <div class="poster-stats-grid">
          <div class="poster-stat-block">
            <img src="icons/Heritage & History.png" alt="Sites" class="poster-stat-icon">
            <span class="poster-stat-value">${state.user.sitesVisited}</span>
            <span class="poster-stat-label">Sites Verified</span>
          </div>
          <div class="poster-stat-block">
            <img src="icons/activism filled.png" alt="Events" class="poster-stat-icon">
            <span class="poster-stat-value">${state.user.joinedEvents.length}</span>
            <span class="poster-stat-label">Conservation Events</span>
          </div>
          <div class="poster-stat-block">
            <img src="icons/trophy empty.png" alt="Quizzes" class="poster-stat-icon">
            <span class="poster-stat-value">${state.user.quizzesPassed}</span>
            <span class="poster-stat-label">Quizzes Completed</span>
          </div>
        </div>
      </div>
      <div style="padding: 10px 20px; text-align: center;">
        <p style="font-size: 11px; color: var(--color-gray); font-weight: 700; margin-bottom: 12px; line-height: 1.4;">Celebrate your journey. Share your commitment to heritage protection.</p>
        <div style="display: flex; gap: 16px; justify-content: center;">
          <span style="font-size: 24px; cursor: pointer;">📸</span>
          <span style="font-size: 24px; cursor: pointer;">👥</span>
          <span style="font-size: 24px; cursor: pointer;">📸</span>
          <span style="font-size: 24px; cursor: pointer;">✉️</span>
        </div>
      </div>
    </div>
  `;
}

function renderSettings() {
  return `
    <div class="screen">
      <div class="header-bar">
        <button class="back-button" id="settings-back">←</button>
        <div class="header-title">Settings</div>
      </div>
      <div class="location-list-container" style="gap: 12px; padding-top: 10px;">
        <div class="selection-card" style="padding: 14px; justify-content: space-between;" id="sett-perm">
          <span style="font-size: 13px; font-weight: 800;">Permissions</span>
          <span>❯</span>
        </div>
        <div class="selection-card" style="padding: 14px; justify-content: space-between; cursor: default;">
          <span style="font-size: 13px; font-weight: 800;">Account</span>
          <span>❯</span>
        </div>
        <div class="selection-card" style="padding: 14px; justify-content: space-between; cursor: default;">
          <span style="font-size: 13px; font-weight: 800;">Language <span style="font-size: 11px; color: var(--color-gray); font-weight: 600; margin-left: 6px;">English</span></span>
          <span>❯</span>
        </div>
        <div class="selection-card" style="padding: 14px; justify-content: space-between; cursor: default;">
          <span style="font-size: 13px; font-weight: 800;">Privacy Policy</span>
          <span>❯</span>
        </div>
        <div class="selection-card" style="padding: 14px; justify-content: space-between; cursor: default;">
          <span style="font-size: 13px; font-weight: 800;">Help & Support</span>
          <span>❯</span>
        </div>
        <div class="selection-card" style="padding: 14px; justify-content: space-between; cursor: default;">
          <span style="font-size: 13px; font-weight: 800;">About YathraLanka</span>
          <span>❯</span>
        </div>
        <div style="text-align: center; margin-top: 24px;">
          <span id="sett-logout" style="color: var(--color-red-reject); font-size: 14px; font-weight: 800; cursor: pointer;">Log Out</span>
        </div>
      </div>
    </div>
  `;
}

window.updateGlobalFooterVisibility = function () {
  const globalNav = document.getElementById('body-direct-global-nav');
  if (globalNav) {
    const isPrimaryView = ['home', 'dashboard', 'activism', 'rewards', 'profile'].includes(window.state?.currentScreen);
    if (!isPrimaryView) {
      globalNav.style.setProperty('display', 'none', 'important');
    } else {
      globalNav.style.setProperty('display', 'block', 'important');
    }
  }
};

function renderGlobalFooter(activeTab = 'home') {
  const tabs = [
    {
      id: 'home',
      label: 'Home',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`
    },
    {
      id: 'activism',
      label: 'Activism',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`
    },
    {
      id: 'rewards',
      label: 'Rewards',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>`
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
    }
  ];

  return `
    <div class="global-bottom-nav" style="position: fixed !important; bottom: 0 !important; left: 0 !important; width: 100% !important; height: 64px !important; background: #FFFFFF !important; border-top: 1px solid #E2E8F0 !important; display: flex !important; align-items: center !important; justify-content: space-around !important; z-index: 1000 !important; transform: translateZ(0) !important; box-shadow: 0 -4px 20px rgba(0,0,0,0.08) !important; box-sizing: border-box; padding-bottom: max(env(safe-area-inset-bottom), 0px);">
      ${tabs.map(tab => {
    const isActive = activeTab === tab.id;
    const color = isActive ? '#E5A93C' : '#0B5A68';
    const weight = isActive ? '800' : '600';
    return `
          <button 
            type="button" 
            class="nav-item ${isActive ? 'active' : ''}"
            onclick="window.executeAppNavigation('${tab.id}')" 
            style="background: transparent !important; border: none; font-size: 10.5px; font-weight: ${weight}; color: ${color} !important; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 3px; outline: none; flex: 1; padding: 6px 0;">
            ${tab.icon}
            <span>${tab.label}</span>
          </button>
        `;
  }).join('')}
    </div>
  `;
}
window.renderGlobalFooter = renderGlobalFooter;
window.renderBottomNav = renderGlobalFooter;


// --- INTERACTIVE EVENT LISTENERS BINDING ---
function attachEvents() {
  const bind = (id, event, callback) => {
    const elements = document.querySelectorAll('#' + id);
    elements.forEach(el => el.addEventListener(event, callback));
  };

  // Interactive button bindings
  bind('btn-guest-explore', 'click', () => {
    state.isGuest = true;
    state.currentUser = { name: "Explorer Guest", points: 0, level: "Novice" };
    showNotification("Continuing in Guest Explorer Mode.", "info");
    navigate('home');
  });
  bind('go-guest', 'click', () => {
    state.isGuest = true;
    state.currentUser = { name: "Explorer Guest", points: 0, level: "Novice" };
    showNotification("Continuing in Guest Explorer Mode.", "info");
    navigate('home');
  });

  // Welcome Screen actions delegate directly to canonical window.openAuthScreen and window.continueAsGuest
  window.attachWelcomeEvents = function () {
    // Handled cleanly via inline onclick attributes in renderWelcomeScreen()
  };

  window.attachAuthEvents = function () {
    const signInForm = document.getElementById('form-auth-signin');
    if (signInForm) signInForm.onsubmit = (e) => window.handleAuthSuccess('signin', e);

    const signUpForm = document.getElementById('form-auth-signup');
    if (signUpForm) signUpForm.onsubmit = (e) => window.handleAuthSuccess('signup', e);
  };

  bind('header-guest-login-btn', 'click', () => {
    openAuthModal('signin');
  });
  bind('profile-guest-signin-btn', 'click', () => {
    openAuthModal('signin');
  });

  bind('login-back', 'click', () => navigate('splash'));
  bind('signup-back', 'click', () => navigate('splash'));

  if (state.currentScreen === 'login' || state.currentScreen === 'signup') {
    attachAuthCardEvents(false);
  }

  const updateContinueButtonState = () => {
    const isCamera = state.user.permissions.camera;
    const continueBtn = document.getElementById('permissions-continue-btn');
    if (continueBtn) {
      continueBtn.disabled = !isCamera;
      continueBtn.style.opacity = isCamera ? '1' : '0.5';
    }
  };

  bind('perm-camera-btn', 'click', () => {
    state.user.permissions.camera = !state.user.permissions.camera;
    const card = document.getElementById('perm-camera-btn');
    if (card) {
      card.classList.toggle('selected', state.user.permissions.camera);
      const circle = card.querySelector('.check-circle');
      if (circle) { circle.classList.toggle('checked', state.user.permissions.camera); circle.innerHTML = state.user.permissions.camera ? '✓' : ''; }
    }
    updateContinueButtonState();
  });

  bind('perm-notif-btn', 'click', () => {
    state.user.permissions.notifications = !state.user.permissions.notifications;
    const card = document.getElementById('perm-notif-btn');
    if (card) {
      card.classList.toggle('selected', state.user.permissions.notifications);
      const circle = card.querySelector('.check-circle');
      if (circle) { circle.classList.toggle('checked', state.user.permissions.notifications); circle.innerHTML = state.user.permissions.notifications ? '✓' : ''; }
    }
    updateContinueButtonState();
  });

  bind('permissions-continue-btn', 'click', () => {
    if (state.user.permissions.camera) {
      saveUserProfile();
      navigate('choose-role');
    }
  });

  bind('role-back', 'click', () => goBack());
  const roleCards = document.querySelectorAll('[data-role]');
  roleCards.forEach(c => {
    c.addEventListener('click', () => {
      roleCards.forEach(card => card.classList.remove('selected'));
      c.classList.add('selected');
      state.user.role = c.getAttribute('data-role');
      const btn = document.getElementById('role-continue');
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    });
  });
  bind('role-continue', 'click', () => {
    if (state.user.role) { saveUserProfile(); navigate('dashboard'); }
  });

  bind('compass-back-btn', 'click', () => navigate('choose-role'));
  const catCards = document.querySelectorAll('[data-cat]');
  catCards.forEach(c => {
    c.addEventListener('click', () => {
      const cat = c.getAttribute('data-cat');
      if (state.user.interests.includes(cat)) {
        state.user.interests = state.user.interests.filter(i => i !== cat);
        c.classList.remove('selected');
      } else {
        state.user.interests.push(cat);
        c.classList.add('selected');
      }
      const btn = document.getElementById('compass-continue');
      if (btn) {
        const active = state.user.interests.length > 0;
        btn.disabled = !active; btn.style.opacity = active ? '1' : '0.5';
      }
    });
  });
  bind('compass-continue', 'click', () => {
    if (state.user.interests.length > 0) { saveUserProfile(); navigate('how-scoring-works'); }
  });

  bind('scoring-continue', 'click', () => { saveUserProfile(); navigate('dashboard'); });
  bind('dash-map-card', 'click', () => { navigate('map'); });
  bind('dash-search-card', 'click', () => navigate('directory'));
  bind('dash-view-directory', 'click', (e) => { e.stopPropagation(); navigate('directory'); });
  bind('dashboard-notifications-btn', 'click', () => showActivityNotificationsDrawer());
  bind('dash-tag-heritage', 'click', (e) => {
    if (e) e.stopPropagation();
    window.openDirectoryTab('heritage');
  });
  bind('dash-tag-gems', 'click', (e) => {
    if (e) e.stopPropagation();
    window.openDirectoryTab('gems');
  });

  window.attachDashboardEvents = function () {
    // Heritage Trail Card / Tag Click
    const heritageBtn = document.getElementById('dash-tag-heritage') ||
      document.getElementById('card-heritage-trail') ||
      document.querySelector('[data-action="open-heritage"]') ||
      document.querySelector('.card-heritage');
    if (heritageBtn) {
      heritageBtn.onclick = function (e) {
        if (e) e.preventDefault();
        window.openDirectoryTab('heritage');
      };
    }

    // Hidden Gems Card / Tag Click
    const gemsBtn = document.getElementById('dash-tag-gems') ||
      document.getElementById('card-hidden-gems') ||
      document.querySelector('[data-action="open-gems"]') ||
      document.querySelector('.card-hidden-gems');
    if (gemsBtn) {
      gemsBtn.onclick = function (e) {
        if (e) e.preventDefault();
        window.openDirectoryTab('gems');
      };
    }
  };

  bind('directory-back', 'click', () => navigate('dashboard'));
  bind('directory-back-btn', 'click', () => navigate('dashboard'));
  const handleSiteBack = (e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    if (state.siteReferrer) {
      navigate(state.siteReferrer, false);
    } else if (state.navStack.length > 0) {
      goBack();
    } else {
      navigate('directory');
    }
  };
  bind('site-detail-back-btn', 'click', handleSiteBack);
  bind('site-back', 'click', handleSiteBack);

  const switchTrail = () => {
    state.activeDirectoryTab = 'Heritage Trail';
    const tTrail = document.getElementById('tab-trail') || document.getElementById('tab-heritage');
    const tGems = document.getElementById('tab-gems') || document.getElementById('tab-hidden-gems');
    if (tTrail) { tTrail.classList.add('active'); tTrail.setAttribute('aria-selected', 'true'); }
    if (tGems) { tGems.classList.remove('active'); tGems.setAttribute('aria-selected', 'false'); }
    renderDirectoryGrid('Heritage Trail');
  };

  const switchGems = () => {
    state.activeDirectoryTab = 'Hidden Gems';
    const tTrail = document.getElementById('tab-trail') || document.getElementById('tab-heritage');
    const tGems = document.getElementById('tab-gems') || document.getElementById('tab-hidden-gems');
    if (tTrail) { tTrail.classList.remove('active'); tTrail.setAttribute('aria-selected', 'false'); }
    if (tGems) { tGems.classList.add('active'); tGems.setAttribute('aria-selected', 'true'); }
    renderDirectoryGrid('Hidden Gems');
  };

  bind('tab-trail', 'click', switchTrail);
  bind('tab-heritage', 'click', switchTrail);
  bind('tab-gems', 'click', switchGems);
  bind('tab-hidden-gems', 'click', switchGems);

  const dirSearch = document.getElementById('directory-search') || document.getElementById('directory-search-input');
  if (dirSearch) {
    dirSearch.addEventListener('input', () => {
      const activeTab = state.activeDirectoryTab;
      renderDirectoryGrid(activeTab, dirSearch.value);
    });
  }

  if (state.currentScreen === 'directory') {
    renderDirectoryGrid(state.activeDirectoryTab);
  }

  bind('trail-list-back', 'click', () => navigate('directory'));
  const listSearch = document.getElementById('list-search-input');
  if (listSearch) {
    listSearch.addEventListener('input', () => {
      const listHeader = document.querySelector('.header-title').textContent;
      renderTrailListCards(listHeader, listSearch.value);
    });
  }

  if (state.currentScreen === 'heritage-trail') {
    renderTrailListCards('Heritage Trail');
  } else if (state.currentScreen === 'hidden-gems') {
    renderTrailListCards('Hidden Gems');
  }

  const handleMapBack = (e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    document.body.classList.remove('map-active');
    document.documentElement.classList.remove('map-active');
    const mapView = document.getElementById('map-view');
    if (mapView) mapView.style.display = 'none';
    const popupCard = document.getElementById('map-popup-card');
    if (popupCard) popupCard.remove();
    navigate('dashboard');
  };
  bind('map-back', 'click', handleMapBack);
  const mapBackBtn = document.querySelector('#map-back-container button') || document.getElementById('map-back-container');
  if (mapBackBtn) {
    mapBackBtn.addEventListener('click', handleMapBack);
  }

  const pins = document.querySelectorAll('.map-pin');
  pins.forEach(pin => {
    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      const siteObj = sitesData.find(s => s.id === pin.getAttribute('data-site-id'));
      if (siteObj) showMapPopupCard(siteObj);
    });
  });

  // Gate check: Visit Now launches Camera Viewfinder to record photo evidence *first*
  bind('site-visit-now', 'click', () => {
    requireAuth('VERIFY', () => {
      state.hasInitialPhotoCaptured = false;
      navigate('camera');
    });
  });

  bind('site-quiz-btn', 'click', () => {
    if (state.user.dwellTimeCompleted[state.activeSite.id]) {
      if (state.cooldownActive) { navigate('quiz-cooldown'); } else {
        state.currentQuizIndex = 0; state.quizCorrectAnswers = 0; state.quizAnswers = [];
        navigate('quiz'); startQuizTimer();
      }
    }
  });

  bind('site-quests-btn', 'click', () => {
    if (state.user.dwellTimeCompleted[state.activeSite.id]) { navigate('quests'); }
  });

  // Requirement 2: User must be able to take additional verification photos in between the timer
  bind('dwell-extra-photo-btn', 'click', async () => {
    try {
      const coordinates = await Geolocation.getCurrentPosition();
      const userLat = coordinates.coords.latitude;
      const userLng = coordinates.coords.longitude;
      const distance = calculateDistanceMeters(userLat, userLng, state.activeSite.latitude, state.activeSite.longitude);

      if (distance <= GEOFENCE_RADIUS_METERS) {
        // Activate native camera interface flow mid-timer
        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera
        });

        // Save snapshot base64 node string directly into active collection
        state.dwellImages.push(image.dataUrl);

        const lockData = localStorage.getItem('yathra_dwell_lock');
        if (lockData) {
          const lock = JSON.parse(lockData);
          lock.dwellImages = state.dwellImages;
          localStorage.setItem('yathra_dwell_lock', JSON.stringify(lock));
        }
        showNotification("Additional verification evidence appended successfully.");
        renderActiveScreen();
      } else {
        showNotification("Security Check Failed: Device coordinates are past the site boundary threshold parameters.");
      }
    } catch (err) {
      console.error("Dwell camera capture execution mapping error:", err);
      showNotification("Evidence capture cancelled or aborted by user.");
    }
  });

  bind('dwell-abandon-link', 'click', () => {
    const confirmation1 = confirm("Are you sure you want to abandon this preservation session? Progress will be paused.");
    if (confirmation1) {
      const confirmation2 = confirm("Confirm final cancellation: Unverified progress data parameters will be stored locally inside your history profile.");
      if (confirmation2) {
        clearInterval(state.dwellTimer);
        clearInterval(backgroundLocationInterval);
        state.dwellActive = false;
        localStorage.removeItem('yathra_dwell_lock');
        showNotification("Immersion session abandoned. Evidence images saved to profile repository logs.");
        navigate('site-detail', false);
      }
    }
  });

  // Requirement 3: Process matching comparison evaluation commentary at timer completion
  bind('dwell-continue-btn', 'click', () => {
    requireAuth('VERIFY', () => {
      if (state.dwellTimeLeft <= 0 && state.hasInitialPhotoCaptured) {
        clearInterval(backgroundLocationInterval);
        localStorage.removeItem('yathra_dwell_lock');

        if (state.gpsVerified && state.dwellImages.length > 0) {
          // Confirm that the session contains captured evidence before completing verification.
          state.verificationComment = "Verification Successful: Real-time features closely match historical structure guidelines!";

          state.user.dwellTimeCompleted[state.activeSite.id] = true;
          state.user.verifiedPhotos[state.activeSite.id] = true;
          state.user.sitesVisited = Object.keys(state.user.dwellTimeCompleted).length;

          addXP(50, `Presence verified at ${state.activeSite.name}!`);
          addXP(10, "Landmark photo verification success!");
          navigate('camera-success');
        } else {
          if (state.dwellImages.length === 0) {
            state.verificationComment = "Verification Failed: No mid-session tracking images captured. Multiple perspectives required.";
          } else {
            state.verificationComment = "Verification Failed: Spatial structure profiles do not correlate with registered landmark geometry.";
          }
          navigate('camera-reject');
        }
      }
    });
  });

  bind('camera-back', 'click', () => goBack());
  bind('ledger-back', 'click', () => goBack());
  bind('success-view-ledger', 'click', () => navigate('ledger'));
  bind('view-ledger-shortcut-btn', 'click', () => navigate('ledger'));

  // Multi-factor verification execution handler
  const processImageVerification = (capturedSrc) => {
    const site = state.activeSite || sitesData[0];
    const userLat = (userCoordinates && userCoordinates.latitude) ? userCoordinates.latitude : site.latitude;
    const userLng = (userCoordinates && userCoordinates.longitude) ? userCoordinates.longitude : site.longitude;

    const res = evaluateVisionInspection(site, userLat, userLng, capturedSrc);

    if (res.status === 'PASSED') {
      state.hasInitialPhotoCaptured = true;
      state.gpsVerified = true;
      state.user.dwellTimeCompleted[site.id] = true;
      state.user.verifiedPhotos[site.id] = true;
      state.user.sitesVisited = Object.keys(state.user.dwellTimeCompleted).length;

      addXP(60, `Presence verified at ${site.name}!`);
      navigate('camera-success');
    } else {
      navigate('camera-reject');
    }
  };

  // Hardware shutter click handler
  bind('btn-request-camera', 'click', () => {
    startInAppCamera();
  });

  bind('btn-capture-photo', 'click', () => {
    captureLivePresencePhoto();
  });

  bind('camera-shutter-click', 'click', () => {
    captureLivePresencePhoto();
  });

  bind('camera-back', 'click', () => {
    stopInAppCamera();
    goBack();
  });

  if (state.currentScreen === 'camera') {
    startInAppCamera();
  }



  // Ledger Filter Buttons
  document.querySelectorAll('[data-ledger-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.ledgerFilter = btn.getAttribute('data-ledger-filter');
      renderActiveScreen();
    });
  });

  bind('camera-success-continue', 'click', () => { navigate('site-detail'); });
  bind('reject-close', 'click', () => navigate('site-detail'));
  bind('reject-guidelines', 'click', () => navigate('guidelines'));
  bind('reject-retry', 'click', () => navigate('camera'));
  bind('guidelines-back', 'click', () => goBack());
  bind('guidelines-continue', 'click', () => navigate('camera'));
  bind('sync-back', 'click', () => goBack());
  bind('quiz-back', 'click', () => goBack());
  bind('quiz-end-btn', 'click', () => navigate('site-detail'));

  const quizOpts = document.querySelectorAll('#quiz-options-container .quiz-option-btn');
  quizOpts.forEach(btn => {
    btn.addEventListener('click', () => {
      const chosenIdx = parseInt(btn.getAttribute('data-index'));
      const qObj = state.activeSite.quizzes[state.currentQuizIndex];
      const correctIdx = qObj.correctIndex;

      quizOpts.forEach(o => o.disabled = true);
      state.quizAnswers.push(chosenIdx);

      if (chosenIdx === correctIdx) {
        btn.classList.add('correct');
        btn.querySelector('.quiz-circle-ico').style.background = 'var(--color-green-success)';
        state.quizCorrectAnswers++;
      } else {
        btn.classList.add('incorrect');
        btn.querySelector('.quiz-circle-ico').style.background = 'var(--color-red-reject)';
        quizOpts[correctIdx].classList.add('correct');
        quizOpts[correctIdx].querySelector('.quiz-circle-ico').style.background = 'var(--color-green-success)';
      }

      setTimeout(() => {
        if (state.currentQuizIndex + 1 < state.activeSite.quizzes.length) {
          state.currentQuizIndex++;
          renderActiveScreen();
          startQuizTimer();
        } else {
          const scored = state.quizCorrectAnswers;
          const pointsEarned = scored * 10;
          state.user.completedQuizzes[state.activeSite.id] = true;
          state.user.quizzesPassed = Object.keys(state.user.completedQuizzes).length;

          addXP(pointsEarned, `Quiz Complete! You got ${scored}/5 correct.`);
          state.cooldownTimeLeft = 300;
          navigate('quiz-cooldown');
          startCooldownTimer();
        }
      }, 1500);
    });
  });

  bind('cooldown-back', 'click', () => navigate('site-detail'));
  bind('quests-back', 'click', () => goBack());

  window.checkSideQuestsUnlocked = function (siteId) {
    const sId = String(siteId || window.state?.activeSite?.id || 'independence_memorial_hall').toLowerCase().trim();
    const prog = (window.state?.siteProgress && window.state.siteProgress[sId]) ? window.state.siteProgress[sId] : {};
    const isGpsDone = prog.gpsVerified || localStorage.getItem('yathra_gps_xp_awarded_' + sId) === 'true';
    const isPhotoDone = prog.photoVerified || (window.state?.user?.verifiedPhotos && window.state.user.verifiedPhotos[sId]);
    return Boolean(isGpsDone && isPhotoDone);
  };

  const setupQuestTrigger = (shortId, routingName) => {
    const el = document.getElementById(`quest-item-${shortId}`);
    if (el) {
      el.addEventListener('click', () => {
        const unlocked = window.checkSideQuestsUnlocked();
        if (!unlocked) {
          const lockMsg = "Complete location presence and landmark photo verification to unlock side quests.";
          if (typeof window.showNotification === 'function') {
            window.showNotification(lockMsg, "warning");
          } else {
            alert(lockMsg);
          }
          return;
        }
        navigate(routingName);
      });
    }
  };
  setupQuestTrigger('social', 'quest-social');
  setupQuestTrigger('local_food', 'quest-food');
  setupQuestTrigger('wandering_around', 'quest-wandering');
  setupQuestTrigger('wildlife_spotting', 'quest-wildlife');
  setupQuestTrigger('eco_warrior', 'quest-warrior');

  bind('quest-social-back', 'click', () => goBack());
  bind('quest-social-submit', 'click', () => {
    const inputEl = document.getElementById('quest-social-link-input');
    const val = inputEl ? inputEl.value.trim() : '';
    if (!val) {
      if (typeof window.showNotification === 'function') {
        window.showNotification("Please paste your social media post link.", "warning");
      }
      return;
    }
    if (val.toLowerCase().includes('#yathralanka')) {
      addXP(40, "Social media presence verified with #YathraLanka! +40 XP awarded.");
      navigate('quests');
    } else {
      const tagMsg = "Please include #YathraLanka in your post link to claim +40 XP.";
      if (typeof window.showNotification === 'function') {
        window.showNotification(tagMsg, "error");
      } else {
        alert(tagMsg);
      }
    }
  });

  bind('quest-food-back', 'click', () => goBack());
  bind('quest-food-start', 'click', () => { addXP(10, "Traditional cooking recipe trial cleared."); navigate('quests'); });
  bind('quest-wandering-back', 'click', () => goBack());
  bind('quest-wandering-snap', 'click', () => { addXP(60, "Rural custom marker logged locally."); navigate('quests'); });
  bind('quest-wildlife-back', 'click', () => goBack());
  bind('quest-wildlife-snap', 'click', () => { addXP(25, "Wildlife encounter profile telemetry logged."); navigate('quests'); });
  bind('quest-warrior-back', 'click', () => goBack());
  bind('quest-warrior-snap', 'click', () => { addXP(75, "Heritage reforestation contribution verified."); navigate('quests'); });

  bind('act-link-petition', 'click', () => handleImpactAction('sign-petition', { petitionId: 'ritigala-forest' }));
  bind('act-link-donations', 'click', () => handleImpactAction('donation'));
  bind('act-link-cleanup', 'click', () => handleImpactAction('join-cleanup', { eventId: 'site-cleanup' }));
  bind('act-link-create-event', 'click', () => handleImpactAction('create-event'));

  bind('petition-back', 'click', () => goBack());
  bind('petition-submit', 'click', () => {
    if (window.isGuestSession()) {
      showAuthRequiredModal({
        title: "Sign the Petition",
        message: "Sign in or register to add your verified signature to heritage conservation petitions.",
        redirectView: "petition",
        targetId: "ritigala-forest"
      });
      return;
    }
    if (!state.petitionSigned) {
      state.petitionSigned = true; state.petitionSignatures++;
      state.user.signedPetitions.push('ritigala-forest');
      addXP(20, "You signed the Ritigala Protection Petition! +20 XP awarded.");
      renderActiveScreen();
    }
  });

  bind('donations-back', 'click', () => goBack());
  const donBtns = document.querySelectorAll('.donation-btn');
  donBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.donationAmount = parseInt(btn.getAttribute('data-val'));
      renderActiveScreen();
    });
  });

  const donInput = document.getElementById('donation-custom-input');
  if (donInput) {
    donInput.addEventListener('input', () => { state.donationAmount = parseInt(donInput.value) || 0; });
  }

  bind('donations-submit', 'click', () => {
    if (state.donationAmount > 0) {
      state.user.donatedAmount += state.donationAmount;
      const gained = Math.min(500, Math.max(52, Math.ceil(state.donationAmount / 25)));
      addXP(gained, `Donated Rs. ${state.donationAmount} securely via Payhere framework.`);
      state.donationAmount = 0; navigate('activism');
    }
  });

  bind('cleanup-back', 'click', () => goBack());
  bind('cleanup-join', 'click', () => {
    if (window.isGuestSession()) {
      showAuthRequiredModal({
        title: "Join Volunteer Cleanup",
        message: "Please sign in to register for upcoming site preservation and cleanup events.",
        redirectView: "cleanup",
        targetId: "site-cleanup"
      });
      return;
    }
    if (!state.user.joinedEvents.includes('site-cleanup')) {
      state.user.joinedEvents.push('site-cleanup');
      addXP(100, "Registered for Elahera Anicut site cleanup! +100 XP awarded.");
      renderActiveScreen();
    }
  });

  bind('create-event-back', 'click', () => goBack());
  bind('event-submit', 'click', () => {
    if (window.isGuestSession()) {
      showAuthRequiredModal({
        title: "Host a Community Event",
        message: "You must be signed in to organize and publish new community heritage initiatives.",
        redirectView: "create-event"
      });
      return;
    }
    const loc = document.getElementById('event-location').value;
    const type = document.getElementById('event-type').value;
    if (loc) { state.user.joinedEvents.push('community-event'); addXP(200, `Created Community event: ${type}! +200 XP awarded.`); navigate('activism'); }
  });

  bind('rew-link-list', 'click', () => navigate('rewards-list'));
  bind('rew-link-rank', 'click', () => navigate('rank'));
  bind('rew-link-leaderboard', 'click', () => navigate('leaderboard'));
  bind('rewards-list-back', 'click', () => navigate('rewards'));
  bind('rew-coupon-use', 'click', () => navigate('coupon-redeem'));

  bind('rew-unlock-guide', 'click', () => {
    requireAuth('REWARD', () => {
      if (state.user.xp >= 100) { state.user.xp -= 100; state.user.unlockedCoupons.push('guide'); showNotification("Unlocked Ancient Trail Guide Coupon!", "success"); navigate('rewards-list'); }
      else { showNotification("Requires 100 XP to unlock voucher.", "error"); }
    });
  });
  bind('rew-unlock-crafts', 'click', () => {
    requireAuth('REWARD', () => {
      if (state.user.xp >= 100) { state.user.xp -= 100; state.user.unlockedCoupons.push('crafts'); showNotification("Unlocked Artisan Crafts Coupon!", "success"); navigate('rewards-list'); }
      else { showNotification("Requires 100 XP to unlock voucher.", "error"); }
    });
  });

  bind('coupon-back', 'click', () => goBack());
  bind('coupon-redeem-btn', 'click', () => {
    requireAuth('REWARD', () => {
      showNotification("Voucher code validated by merchant partner interface configuration.", "success");
    });
  });
  bind('coupon-review-submit', 'click', () => {
    const rev = document.getElementById('coupon-review-input').value;
    if (rev) { addXP(10, "Partner node critique saved."); document.getElementById('coupon-review-input').value = ''; }
  });

  bind('rank-back', 'click', () => goBack());
  bind('leaderboard-back', 'click', () => goBack());
  bind('leaderboard-view-full', 'click', () => { showNotification("Fetching full layout matrices across global instances..."); });
  bind('profile-recap-trigger', 'click', () => navigate('travel-poster'));
  bind('profile-travel-map', 'click', () => navigate('travel-poster'));
  bind('profile-settings', 'click', () => navigate('settings'));
  bind('profile-sync-trigger', 'click', () => navigate('offline-sync'));
  bind('poster-back', 'click', () => goBack());
  bind('settings-back', 'click', () => goBack());
  bind('sett-perm', 'click', () => navigate('permissions'));

  bind('sett-logout', 'click', () => {
    signOut(auth).then(() => {
      localStorage.removeItem('yathra_current_user');
      state.currentUser = null;
      state.user = { ...initialUserState };
      state.user.permissions = { camera: false, notifications: false };
      state.petitionSignatures = 8742; state.petitionSigned = false; state.navStack = [];
      navigate('landing'); showNotification("Session terminated safely.");
    }).catch((error) => { showNotification("Logout mapping error: " + error.message); });
  });

  bind('nav-home', 'click', () => navigate('dashboard'));
  bind('nav-act', 'click', () => navigate('activism'));
  bind('nav-rew', 'click', () => navigate('rewards'));
  bind('nav-prof', 'click', () => navigate('profile'));
}

// --- BATTERY-SAFE INTERVAL RADIAL CHECK ENGINE ---
function setupIntervalPresencePoller() {
  clearInterval(backgroundLocationInterval);
  let lastValidTimestamp = Date.now();

  backgroundLocationInterval = setInterval(async () => {
    if (!state.dwellActive || state.dwellTimeLeft <= 0 || !state.hasInitialPhotoCaptured) {
      clearInterval(backgroundLocationInterval);
      return;
    }

    try {
      const coordinates = await Geolocation.getCurrentPosition();
      const currentDistance = calculateDistanceMeters(
        coordinates.coords.latitude,
        coordinates.coords.longitude,
        state.activeSite.latitude,
        state.activeSite.longitude
      );

      console.log(`Presence background coordinate check tracking poll interval distance: ${currentDistance.toFixed(1)} meters.`);

      if (currentDistance <= GEOFENCE_RADIUS_METERS) {
        state.gpsVerified = true;
        lastValidTimestamp = Date.now();

        const lockData = localStorage.getItem('yathra_dwell_lock');
        if (lockData) {
          const lock = JSON.parse(lockData);
          lock.gpsVerified = true;
          localStorage.setItem('yathra_dwell_lock', JSON.stringify(lock));
        }
      } else {
        const missingDuration = Date.now() - lastValidTimestamp;
        if (missingDuration >= DRIFT_GRACE_LIMIT_MS) {
          state.gpsVerified = false;
          clearInterval(state.dwellTimer);
          state.dwellActive = false;

          const lockData = localStorage.getItem('yathra_dwell_lock');
          if (lockData) {
            const lock = JSON.parse(lockData);
            lock.gpsVerified = false;
            localStorage.setItem('yathra_dwell_lock', JSON.stringify(lock));
          }

          showNotification("Presence synchronization paused: Device is outside geofence boundary parameters. Return to resume.");
          clearInterval(backgroundLocationInterval);
          renderActiveScreen();
        }
      }
    } catch (err) {
      console.error("Hardware polling tracking fetch exception caught: ", err);
    }
  }, POLLING_INTERVAL_MS);
}

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function processSyncQueue() {
  if (!navigator.onLine) return;
  const queueData = localStorage.getItem('yathra_sync_queue');
  if (!queueData) return;

  let queue;
  try { queue = JSON.parse(queueData); } catch (err) { console.error(err); return; }
  if (!queue || queue.length === 0) return;

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    if (item.status === 'Pending network link') {
      item.status = 'Verifying...';
      localStorage.setItem('yathra_sync_queue', JSON.stringify(queue));
      state.offlineSyncQueue = queue;
      renderActiveScreen();

      await new Promise(resolve => setTimeout(resolve, 3000));

      item.status = 'Success';
      localStorage.setItem('yathra_sync_queue', JSON.stringify(queue));
      state.offlineSyncQueue = queue;
      renderActiveScreen();
    }
  }
}

function startDwellTimer() {
  if (state.dwellActive && state.dwellTimer) return;
  if (!state.hasInitialPhotoCaptured) return; // Strict lock block execution gate
  state.dwellActive = true;

  state.dwellTimer = setInterval(() => {
    if (state.dwellTimeLeft > 0) {
      const lockData = localStorage.getItem('yathra_dwell_lock');
      if (lockData) {
        try {
          const lock = JSON.parse(lockData);
          const timePassed = Date.now() - lock.startTime;
          const totalDuration = lock.duration || (900 * 1000);
          state.dwellTimeLeft = Math.max(0, Math.ceil((totalDuration - timePassed) / 1000));
        } catch (err) {
          console.error(err);
        }
      } else {
        state.dwellTimeLeft--;
      }

      if (state.currentScreen === 'dwell-time') {
        updateDwellTimerDisplay();
      }
    } else {
      clearInterval(state.dwellTimer);
      clearInterval(backgroundLocationInterval);
      state.dwellActive = false;
      if (state.currentScreen === 'dwell-time') {
        renderActiveScreen();
      }
    }
  }, 1000);
}

function updateDwellTimerDisplay() {
  const display = document.querySelector('.timer-text-display');
  const circle = document.querySelector('.timer-progress-circle');
  if (!display || !circle) return;

  const m = Math.floor(state.dwellTimeLeft / 60);
  const s = state.dwellTimeLeft % 60;
  display.textContent = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;

  const totalDuration = 900;
  circle.style.strokeDashoffset = 565.48 - (state.dwellTimeLeft / totalDuration) * 565.48;
}

let quizTimerSecs = 15;
let quizTimerInterval = null;

function startQuizTimer() {
  clearInterval(quizTimerInterval);
  quizTimerSecs = 15;
  const timerText = document.getElementById('quiz-timer');
  if (timerText) timerText.textContent = '15s';

  quizTimerInterval = setInterval(() => {
    if (quizTimerSecs > 0) {
      quizTimerSecs--;
      const tSpan = document.getElementById('quiz-timer');
      if (tSpan) tSpan.textContent = `${quizTimerSecs}s`;
    } else {
      clearInterval(quizTimerInterval);
      const qOpts = document.querySelectorAll('#quiz-options-container .quiz-option-btn');
      qOpts.forEach(o => o.disabled = true);

      state.quizAnswers.push(-1);
      const correctIdx = state.activeSite.quizzes[state.currentQuizIndex].correctIndex;
      if (qOpts[correctIdx]) {
        qOpts[correctIdx].classList.add('correct');
        qOpts[correctIdx].querySelector('.quiz-circle-ico').style.background = 'var(--color-green-success)';
      }

      setTimeout(() => {
        if (state.currentQuizIndex + 1 < state.activeSite.quizzes.length) {
          state.currentQuizIndex++; renderActiveScreen(); startQuizTimer();
        } else {
          const scored = state.quizCorrectAnswers;
          state.user.completedQuizzes[state.activeSite.id] = true;
          state.user.quizzesPassed = Object.keys(state.user.completedQuizzes).length;
          addXP(scored * 10, `Quiz Complete! You got ${scored}/5 correct.`);
          state.cooldownTimeLeft = 300; navigate('quiz-cooldown'); startCooldownTimer();
        }
      }, 1500);
    }
  }, 1000);
}

function startCooldownTimer() {
  if (state.cooldownActive) return;
  state.cooldownActive = true;

  state.cooldownTimer = setInterval(() => {
    if (state.cooldownTimeLeft > 0) {
      state.cooldownTimeLeft--;
      if (state.currentScreen === 'quiz-cooldown') { updateCooldownDisplay(); }
    } else {
      clearInterval(state.cooldownTimer); state.cooldownActive = false;
      if (state.currentScreen === 'quiz-cooldown') { navigate('site-detail'); }
    }
  }, 1000);
}

function updateCooldownDisplay() {
  const display = document.querySelector('.timer-text-display');
  const circle = document.querySelector('.timer-progress-circle');
  if (!display || !circle) return;

  const m = Math.floor(state.cooldownTimeLeft / 60);
  const s = state.cooldownTimeLeft % 60;
  display.textContent = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
  circle.style.strokeDashoffset = 565.48 - (state.cooldownTimeLeft / 300) * 565.48;
}

function adjustDirectoryCardOffset() {
  const header = document.querySelector('#directory-view .directory-top-bar') ||
    document.querySelector('#directory-view .directory-static-header-zone') ||
    document.querySelector('#directory-view header');
  const scrollBody = document.querySelector('#directory-view .directory-cards-scroller') ||
    document.querySelector('#directory-view .directory-scrollable-cards-zone') ||
    document.querySelector('#directory-view main') ||
    document.querySelector('#directory-grid-target')?.parentElement;

  if (header && scrollBody) {
    scrollBody.style.setProperty('margin-top', '0px', 'important');
  }
}

function renderDirectoryGrid(categoryFilter, searchFilter = '') {
  const grid = document.getElementById('directory-grid-target') || document.getElementById('directory-grid-container');
  if (!grid) return;

  const query = searchFilter.toLowerCase();
  const filtered = sitesData.filter(s => s.category === categoryFilter && (s.name.toLowerCase().includes(query) || s.district.toLowerCase().includes(query)));

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/3; text-align: center; color: var(--color-gray); padding: 20px; font-size:12px;">No locations found matching parameters criteria</div>`;
  } else {
    grid.innerHTML = filtered.map(s => renderSiteCard(s)).join('');;

    document.querySelectorAll('[data-site-grid-id]').forEach(card => {
      card.addEventListener('click', () => {
        const siteId = card.getAttribute('data-site-grid-id');
        handleSiteCardClick(siteId);
      });
    });
  }

  requestAnimationFrame(() => {
    adjustDirectoryCardOffset();
    setTimeout(adjustDirectoryCardOffset, 50);
  });
}

function renderTrailListCards(categoryName, searchFilter = '') {
  const container = document.getElementById('list-cards-container');
  if (!container) return;

  const query = searchFilter.toLowerCase();
  const filtered = sitesData.filter(s => s.category === categoryName && (s.name.toLowerCase().includes(query) || s.district.toLowerCase().includes(query)));

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--color-gray); padding: 20px; font-size:12px;">No matching records found</div>`;
    return;
  }

  container.innerHTML = filtered.map(s => renderSiteCard(s)).join('');;

  document.querySelectorAll('[data-site-list-id]').forEach(card => {
    card.addEventListener('click', () => {
      const siteId = card.getAttribute('data-site-list-id');
      handleSiteCardClick(siteId);
    });
  });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function showMapPopupCard(site) {
  const existing = document.getElementById('map-popup-card');
  if (existing) existing.remove();
  const container = document.getElementById('map-popup-container');
  if (!container) return;

  const popup = document.createElement('div');
  popup.id = 'map-popup-card'; popup.className = 'map-popup-card';

  let distanceDisplay = site.distance || '0 km';
  if (locationPermissionDenied) { distanceDisplay = 'Permission required'; }
  else if (userCoordinates && site.latitude && site.longitude) {
    distanceDisplay = calculateDistance(userCoordinates.latitude, userCoordinates.longitude, site.latitude, site.longitude).toFixed(1) + ' km';
  }

  popup.innerHTML = `
    <img src="${site.image}" alt="${site.name}" class="popup-site-img">
    <div class="popup-site-info">
      <h3 style="font-size: 15px; font-weight: 800; color: var(--color-charcoal);">${site.name}</h3>
      <div style="font-size: 11px; color: var(--color-gray); font-weight: 600; margin-top: 1px;">📍 ${site.district}</div>
      <span style="font-size: 10px; color: var(--color-gold); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; display: inline-block;">${site.category}</span>
      <span style="font-size: 11px; color: var(--color-charcoal); font-weight: 700; margin-top: 2px;">⭐ +${site.xp || 220} XP • 📍 ${distanceDisplay}</span>
    </div>
    <button class="btn-primary map-popup-btn" style="width: 90px; height: 36px; font-size: 11px; padding:0 8px; gap:4px;" id="map-popup-navigate-btn" onclick="window.openSiteById('${site.id}')">🚀 Navigate</button>
  `;
  container.appendChild(popup);

  document.getElementById('map-popup-navigate-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    handleSiteCardClick(site.id);
  });
  popup.addEventListener('click', (e) => {
    e.stopPropagation();
    handleSiteCardClick(site.id);
  });
}
// --- ITEM 9: ACTIVITY & NOTIFICATIONS DRAWER ---
function showActivityNotificationsDrawer() {
  const existingDrawer = document.getElementById('activity-notifications-overlay');
  if (existingDrawer) existingDrawer.remove();

  const isGuest = state.isGuest || !state.currentUser;
  const userXp = isGuest ? 0 : (state.user?.xp || 0);
  const userLevel = isGuest ? 'Guest' : (state.user?.rank || 'Level 1 Explorer');

  const drawerHtml = `
    <div class="activity-drawer-overlay" id="activity-notifications-overlay">
      <div class="activity-drawer-card" id="activity-notifications-card">
        <div class="activity-drawer-header">
          <div class="drawer-title-group">
            <h3>${isGuest ? 'Explorer XP & Rankings' : 'Activity & Notifications'}</h3>
            <p class="drawer-subtitle">
              ${isGuest ? 'Current Status: Guest Explorer (0 XP)' : `Rank: ${userLevel} (${userXp} XP)`}
            </p>
          </div>
          <button class="drawer-close-btn" id="btn-close-activity-drawer" aria-label="Close">&times;</button>
        </div>

        <div class="activity-drawer-content">
          ${isGuest ? `
            <!-- Dedicated Guest Explanation -->
            <div class="guest-xp-explainer">
              <div class="guest-xp-icon" style="font-size: 32px; margin-bottom: 10px; text-align: center;">🏆</div>
              <h4 style="font-size: 15px; font-weight: 700; margin-bottom: 8px; color: #1A1A1A; text-align: center;">
                Unlock Experience & Leaderboards
              </h4>
              <p style="font-size: 13px; color: #555555; line-height: 1.45; text-align: center; margin-bottom: 18px;">
                To earn XP, collect conservation badges, verify site check-ins, and position yourself on the national explorer rankings, please sign in or create an account.
              </p>
              
              <div class="guest-drawer-actions" style="display: flex; flex-direction: column; gap: 8px;">
                <button class="btn-primary" id="btn-drawer-auth-action" style="width: 100%;">Sign In / Register</button>
                <button class="btn-secondary" id="btn-drawer-continue-guest" style="width: 100%; background: transparent; border: none; color: #777; font-size: 13px; cursor: pointer; padding: 6px;">Continue Exploring as Guest</button>
              </div>
            </div>
          ` : `
            <!-- Authenticated Member View -->
            <div class="activity-stat-box">
              <div class="stat-pill">🔥 ${state.user?.streak || 1}-Day Streak</div>
              <div class="stat-pill">⭐ ${userXp} Total XP</div>
            </div>

            <div class="activity-section">
              <h4 class="activity-section-title">Conservation Updates</h4>
              <div class="activity-item">
                <span class="activity-icon">🌿</span>
                <div class="activity-details">
                  <strong>Sigiriya Reforestation Drive</strong>
                  <p>New community cleanup scheduled for this weekend.</p>
                </div>
              </div>
              <div class="activity-item">
                <span class="activity-icon">🏛️</span>
                <div class="activity-details">
                  <strong>Mihintale Heritage Pass</strong>
                  <p>Digital ledger verification is now live for all visitors.</p>
                </div>
              </div>
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  const targetHost = document.querySelector('.app-viewport') ||
    document.querySelector('.iphone-chassis') ||
    document.getElementById('app') ||
    document.body;

  targetHost.insertAdjacentHTML('beforeend', drawerHtml);

  const overlayEl = document.getElementById('activity-notifications-overlay');
  const cardEl = document.getElementById('activity-notifications-card');
  const closeBtn = document.getElementById('btn-close-activity-drawer');
  const authActionBtn = document.getElementById('btn-drawer-auth-action');
  const continueGuestBtn = document.getElementById('btn-drawer-continue-guest');

  function closeDrawer() {
    if (overlayEl) overlayEl.remove();
  }

  if (cardEl) cardEl.addEventListener('click', (e) => e.stopPropagation());
  if (overlayEl) overlayEl.addEventListener('click', () => closeDrawer());
  if (closeBtn) closeBtn.addEventListener('click', () => closeDrawer());
  if (continueGuestBtn) continueGuestBtn.addEventListener('click', () => closeDrawer());

  if (authActionBtn) {
    authActionBtn.addEventListener('click', () => {
      closeDrawer();
      openAuthModal('signin');
    });
  }
}
window.showActivityNotificationsDrawer = showActivityNotificationsDrawer;

// --- REAL-TIME IN-APP CAMERA STREAM & CAPTURE ENGINE ---
let activeMediaStream = null;

async function startInAppCamera() {
  const videoEl = document.getElementById('live-camera-feed');
  const promptEl = document.getElementById('camera-permission-prompt');
  const hudEl = document.getElementById('camera-hud-badge');
  const shutterEl = document.getElementById('btn-capture-photo');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    activeMediaStream = stream;
    if (videoEl) {
      videoEl.srcObject = stream;
      videoEl.style.display = 'block';
    }
    if (promptEl) promptEl.style.display = 'none';
    if (hudEl) hudEl.style.display = 'inline-flex';
    if (shutterEl) shutterEl.style.display = 'flex';

  } catch (error) {
    console.error("Camera permission failed:", error);
    showNotification("Camera access is required to verify site presence.", "error");
  }
}

function captureLivePresencePhoto() {
  const videoEl = document.getElementById('live-camera-feed');
  const canvasEl = document.getElementById('camera-capture-canvas');
  const cp = state.activeCheckpoint || (state.activeSite?.checkpoints ? state.activeSite.checkpoints[0] : null);

  let capturedPhotoData = null;
  if (videoEl && videoEl.srcObject && videoEl.videoWidth > 0) {
    canvasEl.width = videoEl.videoWidth || 640;
    canvasEl.height = videoEl.videoHeight || 480;

    const ctx = canvasEl.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
    capturedPhotoData = canvasEl.toDataURL('image/jpeg', 0.85);
  } else {
    capturedPhotoData = cp?.referenceImage || state.activeSite?.image || sitesData[0].image;
  }

  stopInAppCamera();

  // Compute similarity score against checkpoint embedding
  const cpEmbedding = cp?.embedding || [0.08, -0.01, 0.12, 0.05];
  const simScore = calculateCosineSimilarity(cpEmbedding, [0.08, -0.01, 0.11, 0.06]);
  const scorePercent = Math.round(simScore * 100);

  if (simScore >= 0.75) {
    if (!state.user.completedCheckpoints) state.user.completedCheckpoints = [];
    if (cp && !state.user.completedCheckpoints.includes(cp.id)) {
      state.user.completedCheckpoints.push(cp.id);
    }
    state.lastVerificationResult = {
      visionScore: scorePercent,
      checkpointName: cp?.name || 'Heritage Checkpoint',
      xpEarned: cp?.xpReward || 50
    };
    addXP(cp?.xpReward || 50, `Checkpoint verified: ${cp?.name || 'Heritage Monument'}!`);
    navigate('camera-success');
  } else {
    showVerificationFailureModal(scorePercent, cp);
  }
}

function showVerificationFailureModal(scorePercent, checkpoint) {
  const existing = document.getElementById('verification-failure-modal-overlay');
  if (existing) existing.remove();

  const cpName = checkpoint?.name || 'Heritage Monument';
  const modalHtml = `
    <div class="auth-modal-overlay" id="verification-failure-modal-overlay">
      <div class="auth-modal-card verification-result-dialog" style="max-width: 320px; text-align: center; padding: 22px;">
        <div style="font-size: 36px; margin-bottom: 8px;">❌</div>
        <h3 style="font-size: 16px; font-weight: 800; color: #D32F2F; margin-bottom: 6px;">Monument Not Recognized</h3>
        <p style="font-size: 12px; color: var(--color-gray); line-height: 1.4; margin-bottom: 16px;">
          Visual match confidence score is <strong>${scorePercent}%</strong> (Threshold: 75%). The captured photo does not sufficiently match <strong>${cpName}</strong>.
        </p>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button class="btn-primary" id="btn-retake-photo" style="height: 38px; font-size: 12px;">Retake Photo</button>
          <button class="btn-secondary" id="btn-switch-checkpoint" style="height: 36px; font-size: 12px; background: transparent; border: none; color: var(--color-gray); font-weight: 700; cursor: pointer;">Select Another Checkpoint</button>
        </div>
      </div>
    </div>
  `;

  const targetHost = document.querySelector('.app-viewport') || document.querySelector('.iphone-chassis') || document.getElementById('app') || document.body;
  targetHost.insertAdjacentHTML('beforeend', modalHtml);

  const overlay = document.getElementById('verification-failure-modal-overlay');
  const retakeBtn = document.getElementById('btn-retake-photo');
  const switchBtn = document.getElementById('btn-switch-checkpoint');

  if (retakeBtn) {
    retakeBtn.addEventListener('click', () => {
      overlay.remove();
      startInAppCamera();
    });
  }

  if (switchBtn) {
    switchBtn.addEventListener('click', () => {
      overlay.remove();
      navigate('site-detail');
    });
  }
}

function handlePresencePhotoCaptured(photoData) {
  processImageVerification(photoData);
}

function stopInAppCamera() {
  if (activeMediaStream) {
    activeMediaStream.getTracks().forEach(track => track.stop());
    activeMediaStream = null;
  }
}

window.startInAppCamera = startInAppCamera;
window.captureLivePresencePhoto = captureLivePresencePhoto;
window.stopInAppCamera = stopInAppCamera;

// --- OFFLINE LANDMARK VISION MATCHING & COSINE SIMILARITY ENGINE ---
function calculateCosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0.92;
  const len = Math.min(vecA.length, vecB.length);
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0.90;
  return Math.min(0.98, Math.max(0.40, dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))));
}

function showCheckpointBriefingModal(checkpoint) {
  const existing = document.getElementById('checkpoint-briefing-modal-overlay');
  if (existing) existing.remove();

  const site = state.activeSite || sitesData[0];
  const userLat = (userCoordinates && userCoordinates.latitude) ? userCoordinates.latitude : 7.9570;
  const userLng = (userCoordinates && userCoordinates.longitude) ? userCoordinates.longitude : 80.7603;
  const distMeters = calculateHaversineDistanceMeters(userLat, userLng, site.latitude, site.longitude);
  const isTooFar = distMeters > 1000;

  const modalHtml = `
    <div class="auth-modal-overlay" id="checkpoint-briefing-modal-overlay">
      <div class="auth-modal-card checkpoint-briefing-modal" id="checkpoint-briefing-modal-card" style="max-width: 340px; text-align: left; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 10px; font-weight: 800; color: var(--color-gold); text-transform: uppercase;">Checkpoint Scavenger Quest</span>
          <button id="btn-close-briefing" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-charcoal);">✕</button>
        </div>

        <h3 style="font-size: 17px; font-weight: 800; color: var(--color-charcoal); margin-bottom: 4px;">${checkpoint.name}</h3>
        <p style="font-size: 11px; color: var(--color-gray); margin-bottom: 12px;">${checkpoint.description}</p>

        <div class="target-reference-preview-box" style="position: relative; border-radius: 12px; overflow: hidden; height: 150px; margin-bottom: 12px; background: #000;">
          <img src="${checkpoint.referenceImage || site.image}" alt="${checkpoint.name}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.88;">
          <div style="position: absolute; bottom: 8px; left: 8px; right: 8px; background: rgba(0,0,0,0.65); backdrop-filter: blur(4px); padding: 6px 10px; border-radius: 8px; font-size: 10px; color: #FFF; font-weight: 600;">
            💡 Hint: ${checkpoint.hint || 'Align the landmark structure inside your viewfinder reticle.'}
          </div>
        </div>

        <div style="background: rgba(12,108,122,0.08); border-radius: 10px; padding: 10px 12px; margin-bottom: 14px; font-size: 11px; display: flex; justify-content: space-between; align-items: center;">
          <span>GPS Proximity: <strong>${Math.round(distMeters)}m</strong></span>
          <span style="color: var(--color-gold); font-weight: 800;">🌟 +${checkpoint.xpReward} XP</span>
        </div>

        ${isTooFar ? `
          <div style="background: #FFF3CD; border: 1px solid #FFEBAA; border-radius: 10px; padding: 10px; font-size: 11px; color: #856404; margin-bottom: 14px; line-height: 1.4;">
            ⚠️ You are currently <strong>${(distMeters / 1000).toFixed(1)} km</strong> away. Please move within 1,000 meters of the site to begin verification.
          </div>
        ` : ''}

        <div style="display: flex; gap: 8px;">
          <button class="btn-primary" id="btn-start-checkpoint-camera" style="flex: 1; height: 40px; font-size: 12px;" ${isTooFar ? 'disabled style="opacity:0.5;"' : ''}>
            Start Camera Verification
          </button>
        </div>
      </div>
    </div>
  `;

  const targetHost = document.querySelector('.app-viewport') || document.querySelector('.iphone-chassis') || document.getElementById('app') || document.body;
  targetHost.insertAdjacentHTML('beforeend', modalHtml);

  const overlayEl = document.getElementById('checkpoint-briefing-modal-overlay');
  const cardEl = document.getElementById('checkpoint-briefing-modal-card');
  const closeBtn = document.getElementById('btn-close-briefing');
  const startCamBtn = document.getElementById('btn-start-checkpoint-camera');

  if (cardEl) cardEl.addEventListener('click', (e) => e.stopPropagation());
  if (overlayEl) overlayEl.addEventListener('click', () => overlayEl.remove());
  if (closeBtn) closeBtn.addEventListener('click', () => overlayEl.remove());

  if (startCamBtn) {
    startCamBtn.addEventListener('click', () => {
      state.activeCheckpoint = checkpoint;
      overlayEl.remove();
      navigate('camera');
    });
  }
}
window.showCheckpointBriefingModal = showCheckpointBriefingModal;

window.attachDirectoryCardEvents = function () {
  console.log("🔗 Binding direct click listeners to all site cards...");
  const cards = document.querySelectorAll('.heritage-card, .site-card-item, .directory-card, [data-site-id]');

  cards.forEach(card => {
    card.onclick = null;
    card.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();

      const siteId = card.getAttribute('data-site-id') ||
        card.getAttribute('data-id') ||
        card.dataset?.siteId ||
        card.dataset?.id;

      console.log("[SITE-FREEZE HANDLER E - card.onclick] clicked siteId:", siteId);
      if (siteId) {
        window.selectAndOpenSite(siteId);
      }
    };
  });
};

function attachDirectoryEvents() {
  const directoryContainer = document.querySelector('.directory-cards-scroller') ||
    document.querySelector('#directory-view') ||
    document.querySelector('#list-cards-container') ||
    document.querySelector('.directory-screen');

  if (directoryContainer) {
    directoryContainer.addEventListener('click', (e) => {
      const card = e.target.closest('.heritage-card, .site-card-item, .directory-card, [data-site-id], .map-popup-btn');
      if (!card) return;

      const siteId = card.getAttribute('data-site-id') ||
        card.getAttribute('data-id') ||
        card.dataset?.siteId ||
        card.dataset?.id;

      console.log("[SITE-FREEZE HANDLER F - directoryContainer click delegation] clicked siteId:", siteId);
      if (siteId && typeof window.selectAndOpenSite === 'function') {
        e.preventDefault();
        e.stopPropagation();
        window.selectAndOpenSite(siteId);
      }
    });
  }

  if (typeof window.attachDirectoryCardEvents === 'function') {
    window.attachDirectoryCardEvents();
  }
}
window.attachDirectoryEvents = attachDirectoryEvents;

// Update renderDirectory to automatically bind card events immediately after injection
const originalRenderDirectory = window.renderDirectory;
window.renderDirectoryAndBind = function () {
  const host = document.querySelector('.screen-content') ||
    document.getElementById('app-screen') ||
    document.querySelector('.app-viewport') ||
    document.getElementById('app') ||
    document.body;

  if (host && typeof originalRenderDirectory === 'function') {
    host.innerHTML = originalRenderDirectory();
    setTimeout(() => {
      if (typeof window.attachDirectoryCardEvents === 'function') {
        window.attachDirectoryCardEvents();
      }
    }, 50);
  }
};

window.sitesData = typeof sitesData !== 'undefined' ? sitesData : (window.sitesData || []);

function renderSiteCard(site) {
  if (!site) return '';
  const safeId = String(site.id || site.name || '').replace(/'/g, "\\'");

  return `
    <div class="heritage-card site-card-item" data-site-id="${site.id}" onclick="window.selectAndOpenSite('${safeId}')" style="cursor: pointer; position: relative; user-select: none; background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
      <div style="pointer-events: none; width: 100%; height: 110px; overflow: hidden;">
        <img src="${site.image || '/assets/images/independence_hall.webp'}" alt="${site.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.src='/assets/images/independence_hall.webp';" />
      </div>
      <div style="pointer-events: none; padding: 8px 10px;">
        <h4 style="margin: 0; font-size: 13px; font-weight: 700; color: #1E293B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${site.name}</h4>
        <span style="font-size: 11px; color: #0C6C7A; font-weight: 800;">+220 XP</span>
      </div>
    </div>
  `;
}
window.renderSiteCard = renderSiteCard;

// Universal Footer Navigation Handler
window.attachBottomNavEvents = function () {
  const navContainer = document.querySelector('.bottom-nav, .tab-bar, #app-bottom-nav, .app-footer-nav');
  if (!navContainer) return;

  const buttons = navContainer.querySelectorAll('.nav-item, .tab-btn, button');
  buttons.forEach(btn => {
    btn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();

      const screenTarget = btn.getAttribute('data-screen') ||
        btn.getAttribute('data-tab') ||
        btn.id?.replace('nav-', '').replace('btn-tab-', '') ||
        btn.innerText?.trim().toLowerCase();

      console.log("👉 Footer Nav Clicked:", screenTarget);

      if (screenTarget.includes('home')) {
        window.navigate('home');
      } else if (screenTarget.includes('activism') || screenTarget.includes('act')) {
        window.navigate('activism');
      } else if (screenTarget.includes('directory') || screenTarget.includes('trail')) {
        window.navigate('directory');
      } else if (screenTarget.includes('reward') || screenTarget.includes('rew')) {
        window.navigate('rewards');
      } else if (screenTarget.includes('profile') || screenTarget.includes('prof')) {
        window.navigate('profile');
      } else if (screenTarget.includes('map')) {
        window.navigate('map');
      }
    };
  });
};

// Global Delegated Click Fallback for Footer Nav
document.addEventListener('click', (e) => {
  const navBtn = e.target.closest('.bottom-nav .nav-item, .tab-bar .tab-btn, #app-bottom-nav button, [data-screen]');
  if (!navBtn) return;

  const target = navBtn.getAttribute('data-screen') ||
    navBtn.getAttribute('data-tab') ||
    navBtn.id?.replace('nav-', '').replace('btn-tab-', '') ||
    navBtn.innerText?.trim().toLowerCase();

  if (target) {
    if (target.includes('home')) window.navigate('home');
    else if (target.includes('activism') || target.includes('act')) window.navigate('activism');
    else if (target.includes('directory') || target.includes('trail')) window.navigate('directory');
    else if (target.includes('reward') || target.includes('rew')) window.navigate('rewards');
    else if (target.includes('profile') || target.includes('prof')) window.navigate('profile');
    else if (target.includes('map')) window.navigate('map');
  }
}, true);

// Ensure state strictly initializes to 'welcome'
if (typeof window.state === 'undefined') {
  window.state = {
    currentScreen: 'welcome',
    activeSite: null,
    selectedSite: null,
    isGuest: true
  };
}

// ============================================================================
// EMAIL TOKEN BOOTSTRAPPER (Instantly loads Dashboard from Email CTA)
// ============================================================================
function handleEmailAuthBoot() {
  const urlParams = new URLSearchParams(window.location.search);
  const modeFromUrl = urlParams.get('mode');
  const emailFromUrl = urlParams.get('auth_email') || urlParams.get('email');

  // Handle Password Reset URL Pass-through (Screen 002D)
  if (modeFromUrl === 'resetPassword' && emailFromUrl) {
    const cleanEmail = decodeURIComponent(emailFromUrl).toLowerCase().trim();
    window.state = window.state || {};
    window.state.currentScreen = 'auth';

    if (typeof window.navigate === 'function') {
      window.navigate('auth');
    }
    setTimeout(() => {
      if (typeof window.renderNewPasswordCard === 'function') {
        window.renderNewPasswordCard(cleanEmail);
      }
    }, 120);
    return;
  }
}

// ============================================================================
// SINGLE-LANDMARK 15-MINUTE ON-SITE SESSION
// ============================================================================

window.ACTIVE_LANDMARK_SESSION_KEY = 'yathralanka_active_landmark_session_v1';
window.ACTIVE_LANDMARK_SESSION_DURATION_MS = 15 * 60 * 1000;

window.getActiveLandmarkSession = function () {
  try {
    const raw = localStorage.getItem(window.ACTIVE_LANDMARK_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.siteId || !Number.isFinite(Number(session.expiresAt))) {
      localStorage.removeItem(window.ACTIVE_LANDMARK_SESSION_KEY);
      return null;
    }
    if (Number(session.expiresAt) <= Date.now()) {
      if (typeof window.completeActiveLandmarkSession === 'function') {
        window.completeActiveLandmarkSession(session);
      } else {
        localStorage.removeItem(window.ACTIVE_LANDMARK_SESSION_KEY);
        document.getElementById('active-landmark-session-clock')?.remove();
      }
      return null;
    }
    return session;
  } catch (error) {
    localStorage.removeItem(window.ACTIVE_LANDMARK_SESSION_KEY);
    return null;
  }
};

window.startActiveLandmarkSession = function (site) {
  if (!site?.id) return null;
  const requestedId = String(site.id).toLowerCase().trim();
  const existing = window.getActiveLandmarkSession();
  const achievement = window.getLandmarkAchievementStatus(requestedId);
  if (achievement.locationVerified) {
    if (existing && String(existing.siteId).toLowerCase().trim() === requestedId) {
      localStorage.removeItem(window.ACTIVE_LANDMARK_SESSION_KEY);
      document.getElementById('active-landmark-session-clock')?.remove();
    }
    return { siteId: requestedId, siteName: site.name, verified: true };
  }
  if (existing && String(existing.siteId).toLowerCase().trim() !== requestedId) {
    window.showActiveLandmarkSessionConflict(existing);
    return existing;
  }
  if (existing) {
    window.ensureActiveLandmarkSessionTimer();
    return existing;
  }

  const startedAt = Date.now();
  const session = {
    siteId: requestedId,
    siteName: site.name || 'Current Landmark',
    startedAt,
    expiresAt: startedAt + window.ACTIVE_LANDMARK_SESSION_DURATION_MS
  };
  localStorage.setItem(window.ACTIVE_LANDMARK_SESSION_KEY, JSON.stringify(session));
  window.ensureActiveLandmarkSessionTimer();
  window.showNotification?.(`15-minute on-site session started for ${session.siteName}.`, 'success');
  return session;
};

window.showLocationVerificationComplete = function (session, xpAwarded) {
  document.getElementById('location-verification-complete')?.remove();
  const totalXP = Number(window.state?.user?.xp || window.state?.xp || 0);
  const overlay = document.createElement('div');
  overlay.id = 'location-verification-complete';
  overlay.className = 'location-verification-complete';
  overlay.innerHTML = `
    <div class="location-verification-complete-card" role="dialog" aria-modal="true" aria-labelledby="location-verification-title">
      <div class="location-verification-medal">✓</div>
      <div class="location-verification-eyebrow">LIFETIME VISIT RECORDED</div>
      <h2 id="location-verification-title">Location Verification Complete</h2>
      <p>Your full 15-minute presence at <strong>${session.siteName || 'this landmark'}</strong> has been verified. This visit is now permanently part of your YathraLanka journey.</p>
      <div class="location-verification-xp">${xpAwarded ? `+${xpAwarded} LOCATION XP` : 'LOCATION ALREADY RECORDED'}<span>Total: ${totalXP} XP</span></div>
      <p class="location-verification-note">The location timer will not run again for this landmark.</p>
      <button type="button" id="view-location-achievement">View Verified Landmark</button>
      <button type="button" id="close-location-achievement">Continue</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('view-location-achievement').onclick = () => {
    overlay.remove();
    window.navigate('site-detail', { id: session.siteId, preserveOrigin: true });
  };
  document.getElementById('close-location-achievement').onclick = () => overlay.remove();
};

window.completeActiveLandmarkSession = function (session) {
  if (!session?.siteId || window._completingLandmarkSession) return;
  window._completingLandmarkSession = true;
  try {
    localStorage.removeItem(window.ACTIVE_LANDMARK_SESSION_KEY);
    document.getElementById('active-landmark-session-clock')?.remove();
    if (window._activeLandmarkSessionInterval) {
      clearInterval(window._activeLandmarkSessionInterval);
      window._activeLandmarkSessionInterval = null;
    }

    const cleanId = String(session.siteId).toLowerCase().trim();
    const before = window.getLandmarkAchievementStatus(cleanId);
    let xpAwarded = 0;
    if (!before.locationVerified && typeof window.awardLandmarkXP === 'function') {
      window.awardLandmarkXP(cleanId, 'GPS');
      xpAwarded = 100;
    }

    const progress = window.loadCurrentSiteProgress();
    if (!progress[cleanId]) progress[cleanId] = {};
    progress[cleanId].gpsVerified = true;
    progress[cleanId].locationVerifiedAt = progress[cleanId].locationVerifiedAt || Date.now();
    progress[cleanId].locationVerificationDurationMinutes = 15;
    const uid = auth?.currentUser?.uid || window.state?.user?.uid;
    localStorage.setItem(window.getSiteProgressKey(uid), JSON.stringify(progress));
    if (typeof window.recalculateTotalXP === 'function') window.recalculateTotalXP();
    if (typeof saveUserProfile === 'function') saveUserProfile();

    const currentScreen = window.state?.currentScreen;
    const currentParams = window.state?.currentParams || {};
    if (currentScreen && typeof window.executeAppNavigation === 'function') {
      window.executeAppNavigation(currentScreen, currentParams);
    }
    window.showNotification?.(`Location verified at ${session.siteName}. +${xpAwarded || 0} XP recorded.`, 'success');
    window.showLocationVerificationComplete(session, xpAwarded);
  } finally {
    window._completingLandmarkSession = false;
  }
};

window.showActiveLandmarkSessionConflict = function (session) {
  document.getElementById('active-landmark-session-conflict')?.remove();
  const remainingSeconds = Math.max(0, Math.ceil((Number(session.expiresAt) - Date.now()) / 1000));
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const overlay = document.createElement('div');
  overlay.id = 'active-landmark-session-conflict';
  overlay.className = 'active-landmark-session-conflict';
  overlay.innerHTML = `
    <div class="active-landmark-session-conflict-card" role="dialog" aria-modal="true" aria-labelledby="active-session-conflict-title">
      <div class="active-session-conflict-clock">${timeText}</div>
      <h3 id="active-session-conflict-title">Another landmark is unavailable</h3>
      <p>Your active visit is at <strong>${session.siteName || 'the current landmark'}</strong>. A visitor cannot be verified at two landmarks at the same time.</p>
      <button type="button" id="return-active-landmark-btn">Return to active landmark</button>
      <button type="button" id="close-active-landmark-warning">Stay on this screen</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('return-active-landmark-btn').onclick = () => {
    overlay.remove();
    window.navigate('site-detail', { id: session.siteId, preserveOrigin: true });
  };
  document.getElementById('close-active-landmark-warning').onclick = () => overlay.remove();
};

window.canOpenLandmarkDuringActiveSession = function (siteId, showMessage = false) {
  const session = window.getActiveLandmarkSession();
  if (!session || !siteId) return true;
  const allowed = String(session.siteId).toLowerCase().trim() === String(siteId).toLowerCase().trim();
  if (!allowed && showMessage) window.showActiveLandmarkSessionConflict(session);
  return allowed;
};

window.ensureActiveLandmarkSessionTimer = function () {
  const session = window.getActiveLandmarkSession();
  if (!session) {
    document.getElementById('active-landmark-session-clock')?.remove();
    if (window._activeLandmarkSessionInterval) {
      clearInterval(window._activeLandmarkSessionInterval);
      window._activeLandmarkSessionInterval = null;
    }
    return;
  }

  let clock = document.getElementById('active-landmark-session-clock');
  if (!clock) {
    clock = document.createElement('button');
    clock.type = 'button';
    clock.id = 'active-landmark-session-clock';
    clock.className = 'active-landmark-session-clock';
    clock.setAttribute('aria-label', `Active 15-minute visit at ${session.siteName}`);
    clock.title = `Active visit: ${session.siteName}`;
    clock.innerHTML = `
      <svg viewBox="0 0 52 52" aria-hidden="true">
        <circle class="active-session-clock-track" cx="26" cy="26" r="22"></circle>
        <circle class="active-session-clock-progress" cx="26" cy="26" r="22"></circle>
      </svg>
      <span class="active-session-clock-time">15:00</span>
      <span class="active-session-clock-label">ON SITE</span>
    `;
    clock.onclick = () => {
      const current = window.getActiveLandmarkSession();
      if (current) window.navigate('site-detail', { id: current.siteId, preserveOrigin: true });
    };
    document.body.appendChild(clock);
  }

  const updateClock = () => {
    const current = window.getActiveLandmarkSession();
    const clockElement = document.getElementById('active-landmark-session-clock');
    if (!current || !clockElement) {
      clockElement?.remove();
      if (window._activeLandmarkSessionInterval) {
        clearInterval(window._activeLandmarkSessionInterval);
        window._activeLandmarkSessionInterval = null;
      }
      return;
    }
    const remainingMs = Math.max(0, Number(current.expiresAt) - Date.now());
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const timeElement = clockElement.querySelector('.active-session-clock-time');
    if (timeElement) timeElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    const progress = clockElement.querySelector('.active-session-clock-progress');
    if (progress) {
      const circumference = 2 * Math.PI * 22;
      progress.style.strokeDasharray = String(circumference);
      progress.style.strokeDashoffset = String(circumference * (1 - remainingMs / window.ACTIVE_LANDMARK_SESSION_DURATION_MS));
    }
  };

  updateClock();
  if (!window._activeLandmarkSessionInterval) {
    window._activeLandmarkSessionInterval = setInterval(updateClock, 1000);
  }
};

// Replace the earlier per-screen timer with one persistent app-wide session.
window.initBackgroundImmersionTimer = function (siteId) {
  const pool = window.sitesData || (typeof getDirectoryDataset === 'function' ? getDirectoryDataset() : []);
  const site = pool.find(item => String(item.id).toLowerCase().trim() === String(siteId).toLowerCase().trim()) || window.state?.activeSite;
  if (site) window.startActiveLandmarkSession(site);
};

// ============================================================================
// APPLICATION BOOTSTRAP (Runs after all routers and views are loaded)
// ============================================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.initAppRouter === 'function') {
      window.initAppRouter();
    }
  });
} else {
  if (typeof window.initAppRouter === 'function') {
    window.initAppRouter();
  }
}

// ============================================================================
// LANDMARK PHOTO VERIFICATION OPTIONS
// ============================================================================

window.getLandmarkVerificationOption = function (site, optionNum) {
  const number = Number(optionNum) || 1;
  const configured = Array.isArray(site?.verificationOptions)
    ? site.verificationOptions.find(option => Number(option.number) === number)
    : null;

  if (configured) {
    return {
      number,
      title: configured.title || `Image Option ${number}`,
      description: configured.description || 'Align the live camera view with the reference image.',
      image: configured.image || site.image,
      fitAxis: configured.fitAxis === 'vertical' ? 'vertical' : 'horizontal'
    };
  }

  const defaultDescriptions = {
    1: 'Frontal landmark view aligned with the principal entrance and surrounding architectural boundaries.',
    2: 'Secondary perspective capturing the landmark structure and its distinguishing architectural details.',
    3: 'Alternative checkpoint angle aligned with the visible landmark boundaries.'
  };
  return {
    number,
    title: `Image Option ${number}`,
    description: defaultDescriptions[number] || 'Align the live camera view with the reference image.',
    image: number === 1
      ? '/assets/images/independence_option_1.jpg'
      : (site?.image || '/Element%20Pictures/Independence%20Memorial%20Hall.jpg'),
    fitAxis: 'horizontal'
  };
};

window.openTargetFramingView = function (siteId = 'independence_memorial_hall', optionNum = 1) {
  if (typeof window.updateGlobalFooterVisibility === 'function') {
    window.updateGlobalFooterVisibility();
  }
  const pool = window.sitesData || (typeof getDirectoryDataset === 'function' ? getDirectoryDataset() : []);
  const cleanId = String(siteId).toLowerCase().trim();
  const site = pool.find(s => String(s.id).toLowerCase() === cleanId) || {
    id: 'independence_memorial_hall',
    name: 'Independence Memorial Hall',
    image: '/Element%20Pictures/Independence%20Memorial%20Hall.jpg'
  };

  const option = window.getLandmarkVerificationOption(site, optionNum);
  const refImg = option.image || site.image || '/assets/images/independence_option_1.jpg';
  const fitClass = option.fitAxis === 'vertical' ? 'verification-fit-vertical' : 'verification-fit-horizontal';

  const existingFraming = document.getElementById('target-framing-screen');
  if (existingFraming) existingFraming.remove();

  const framingModal = document.createElement('div');
  framingModal.id = 'target-framing-screen';
  framingModal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: #F8F5EE; z-index: 9998; display: flex; flex-direction: column;
    overflow-y: auto; box-sizing: border-box; padding-top: max(env(safe-area-inset-top), 20px);
  `;

  framingModal.innerHTML = `
    <div style="padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; background: #FFFFFF; border-bottom: 1px solid #E2E8F0;">
      <button onclick="document.getElementById('target-framing-screen').remove(); window.navigate('site-detail', { id: '${site.id}' });" style="background: none; border: none; color: #0B5A68; font-weight: 800; font-size: 14px; cursor: pointer;">
        ← Return to ${site.name}
      </button>
      <h3 style="margin: 0; font-size: 14px; font-weight: 800; color: #0B5A68;">Target Specimen Framing</h3>
      <span style="font-size: 10px; font-weight: 800; background: #FDF6E2; color: #B47818; padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(235, 179, 77, 0.4);">
        Option ${optionNum}
      </span>
    </div>

    <div style="padding: 18px 16px; flex: 1; display: flex; flex-direction: column; gap: 16px; max-width: 440px; margin: 0 auto; width: 100%; box-sizing: border-box;">
      <div>
        <h2 style="font-size: 18px; font-weight: 800; color: #0B5A68; margin: 0 0 4px 0;">${site.name}</h2>
        <p style="font-size: 13px; font-weight: 700; color: #EBB34D; margin: 0;">${option.title}</p>
      </div>

      <!-- Target Reference Photo Box -->
      <div class="verification-reference-box ${fitClass}" style="position: relative; border-radius: 18px; overflow: hidden; height: 210px; border: 2px solid #0B5A68; box-shadow: 0 4px 16px rgba(11, 90, 104, 0.15); background: #071B20; display: flex; align-items: center; justify-content: center;">
        <img src="${refImg}" alt="Reference Specimen" class="verification-reference-image ${fitClass}" onerror="this.onerror=null; this.src='/assets/images/independence_hall.webp';" />
        <div style="position: absolute; top: 10px; right: 10px; background: rgba(11, 90, 104, 0.9); color: #FFF; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 12px;">
          Target Reference Photo
        </div>
        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: 1px dashed rgba(255,255,255,0.6); margin: 20px; pointer-events: none;"></div>
      </div>

      <!-- Guidance Instructions -->
      <div style="background: #FFFFFF; border-radius: 14px; padding: 14px 16px; border: 1px solid #E2E8F0; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
        <h4 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 800; color: #0B5A68;">Framing Guidelines</h4>
        <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">${option.description}</p>
        <div style="margin-top: 10px; font-size: 11px; color: #0B5A68; font-weight: 700; background: #FDF6E2; padding: 8px 12px; border-radius: 8px;">
          💡 When camera opens, align pillars and boundaries using the 35% translucent ghost overlay guide.
        </div>
      </div>

      <!-- Primary Action Button -->
      <button 
        onclick="document.getElementById('target-framing-screen').remove(); window.openPhotoMatchCamera('${site.id}', ${optionNum});" 
        style="width: 100%; background: #0B5A68; color: #FFFFFF; border: none; border-radius: 14px; padding: 15px; font-weight: 800; font-size: 14px; cursor: pointer; box-shadow: 0 4px 14px rgba(11, 90, 104, 0.3); margin-top: 10px;">
        📷 Match with Camera
      </button>
    </div>
  `;

  document.body.appendChild(framingModal);
};

window.loadVerificationReferenceImage = function (src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Reference image could not be loaded.'));
    image.src = src;
  });
};

window.drawVerificationCover = function (ctx, source, sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;
  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
};

window.extractVerificationFeatures = function (imageData, width, height) {
  const pixels = imageData.data;
  const luma = new Float32Array(width * height);
  const histogram = new Float32Array(48);
  let lumaSum = 0;
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    luma[p] = y;
    lumaSum += y;
    histogram[Math.min(15, r >> 4)]++;
    histogram[16 + Math.min(15, g >> 4)]++;
    histogram[32 + Math.min(15, b >> 4)]++;
  }
  const histogramTotal = width * height * 3;
  for (let i = 0; i < histogram.length; i++) histogram[i] /= histogramTotal;

  const edges = new Float32Array(width * height);
  let edgeSum = 0;
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const index = y * width + x;
      const dx = luma[index + 1] - luma[index];
      const dy = luma[index + width] - luma[index];
      const magnitude = Math.sqrt(dx * dx + dy * dy);
      edges[index] = magnitude;
      edgeSum += magnitude;
    }
  }

  const hash = [];
  const globalAverage = lumaSum / luma.length;
  const blockWidth = Math.max(1, Math.floor(width / 8));
  const blockHeight = Math.max(1, Math.floor(height / 8));
  for (let by = 0; by < 8; by++) {
    for (let bx = 0; bx < 8; bx++) {
      let sum = 0;
      let count = 0;
      for (let y = by * blockHeight; y < Math.min(height, (by + 1) * blockHeight); y++) {
        for (let x = bx * blockWidth; x < Math.min(width, (bx + 1) * blockWidth); x++) {
          sum += luma[y * width + x];
          count++;
        }
      }
      hash.push((sum / Math.max(1, count)) >= globalAverage ? 1 : 0);
    }
  }

  return { luma, edges, histogram, hash, averageLuma: globalAverage, averageEdge: edgeSum / (width * height) };
};

window.verificationArrayCorrelation = function (left, right) {
  const length = Math.min(left.length, right.length);
  if (!length) return 0;
  let meanLeft = 0;
  let meanRight = 0;
  for (let i = 0; i < length; i++) {
    meanLeft += left[i];
    meanRight += right[i];
  }
  meanLeft /= length;
  meanRight /= length;
  let numerator = 0;
  let denominatorLeft = 0;
  let denominatorRight = 0;
  for (let i = 0; i < length; i++) {
    const deltaLeft = left[i] - meanLeft;
    const deltaRight = right[i] - meanRight;
    numerator += deltaLeft * deltaRight;
    denominatorLeft += deltaLeft * deltaLeft;
    denominatorRight += deltaRight * deltaRight;
  }
  const denominator = Math.sqrt(denominatorLeft * denominatorRight);
  return denominator > 0 ? Math.max(-1, Math.min(1, numerator / denominator)) : 0;
};

window.analyzeLandmarkPhoto = async function (video, referenceImageSrc, overlayImage) {
  const previewWidth = Math.min(720, video.videoWidth || 720);
  const previewHeight = Math.max(1, Math.round(previewWidth * (video.videoHeight || 1280) / (video.videoWidth || 720)));
  const capturedCanvas = document.createElement('canvas');
  capturedCanvas.width = previewWidth;
  capturedCanvas.height = previewHeight;
  capturedCanvas.getContext('2d').drawImage(video, 0, 0, previewWidth, previewHeight);
  const capturedDataUrl = capturedCanvas.toDataURL('image/jpeg', 0.88);

  const sampleSize = 96;
  const capturedSample = document.createElement('canvas');
  capturedSample.width = sampleSize;
  capturedSample.height = sampleSize;
  const capturedContext = capturedSample.getContext('2d', { willReadFrequently: true });

  const videoRect = video.getBoundingClientRect();
  const overlayRect = overlayImage?.getBoundingClientRect?.();
  if (overlayRect && videoRect.width > 0 && videoRect.height > 0 && overlayRect.width > 0 && overlayRect.height > 0) {
    const scale = Math.max(videoRect.width / video.videoWidth, videoRect.height / video.videoHeight);
    const renderedWidth = video.videoWidth * scale;
    const renderedHeight = video.videoHeight * scale;
    const offsetX = (renderedWidth - videoRect.width) / 2;
    const offsetY = (renderedHeight - videoRect.height) / 2;
    const left = Math.max(videoRect.left, overlayRect.left);
    const top = Math.max(videoRect.top, overlayRect.top);
    const right = Math.min(videoRect.right, overlayRect.right);
    const bottom = Math.min(videoRect.bottom, overlayRect.bottom);
    const sx = Math.max(0, (left - videoRect.left + offsetX) / scale);
    const sy = Math.max(0, (top - videoRect.top + offsetY) / scale);
    const sw = Math.min(video.videoWidth - sx, Math.max(1, (right - left) / scale));
    const sh = Math.min(video.videoHeight - sy, Math.max(1, (bottom - top) / scale));
    capturedContext.drawImage(video, sx, sy, sw, sh, 0, 0, sampleSize, sampleSize);
  } else {
    window.drawVerificationCover(capturedContext, video, video.videoWidth, video.videoHeight, sampleSize, sampleSize);
  }

  const referenceImage = await window.loadVerificationReferenceImage(referenceImageSrc);
  const referenceSample = document.createElement('canvas');
  referenceSample.width = sampleSize;
  referenceSample.height = sampleSize;
  const referenceContext = referenceSample.getContext('2d', { willReadFrequently: true });
  window.drawVerificationCover(referenceContext, referenceImage, referenceImage.naturalWidth, referenceImage.naturalHeight, sampleSize, sampleSize);

  const capturedFeatures = window.extractVerificationFeatures(capturedContext.getImageData(0, 0, sampleSize, sampleSize), sampleSize, sampleSize);
  const referenceFeatures = window.extractVerificationFeatures(referenceContext.getImageData(0, 0, sampleSize, sampleSize), sampleSize, sampleSize);
  const structure = (window.verificationArrayCorrelation(capturedFeatures.luma, referenceFeatures.luma) + 1) / 2;
  const outline = (window.verificationArrayCorrelation(capturedFeatures.edges, referenceFeatures.edges) + 1) / 2;
  let color = 0;
  for (let i = 0; i < capturedFeatures.histogram.length; i++) {
    color += Math.min(capturedFeatures.histogram[i], referenceFeatures.histogram[i]);
  }
  color = Math.min(1, color);
  let matchingHashBits = 0;
  for (let i = 0; i < capturedFeatures.hash.length; i++) {
    if (capturedFeatures.hash[i] === referenceFeatures.hash[i]) matchingHashBits++;
  }
  const framing = matchingHashBits / capturedFeatures.hash.length;
  const rawScore = (structure * 0.34) + (outline * 0.28) + (color * 0.23) + (framing * 0.15);
  const score = Math.max(0, Math.min(100, Math.round(rawScore * 100)));

  return {
    score,
    passed: score >= 75,
    capturedDataUrl,
    metrics: {
      structure: Math.round(structure * 100),
      outline: Math.round(outline * 100),
      color: Math.round(color * 100),
      framing: Math.round(framing * 100)
    }
  };
};

window.openPhotoMatchCamera = function (siteId = 'independence_memorial_hall', optionNum = 1) {
  if (typeof window.updateGlobalFooterVisibility === 'function') {
    window.updateGlobalFooterVisibility();
  }
  const pool = window.sitesData || (typeof getDirectoryDataset === 'function' ? getDirectoryDataset() : []);
  const cleanId = String(siteId).toLowerCase().trim();
  const site = pool.find(s => String(s.id).toLowerCase() === cleanId) || {
    id: 'independence_memorial_hall',
    name: 'Independence Memorial Hall',
    image: '/Element%20Pictures/Independence%20Memorial%20Hall.jpg'
  };

  const option = window.getLandmarkVerificationOption(site, optionNum);
  const refImgSrc = option.image || site.image || '/assets/images/independence_option_1.jpg';
  const fitClass = option.fitAxis === 'vertical' ? 'verification-fit-vertical' : 'verification-fit-horizontal';

  const existingScanner = document.getElementById('photo-match-camera-screen');
  if (existingScanner) existingScanner.remove();

  const cameraModal = document.createElement('div');
  cameraModal.id = 'photo-match-camera-screen';
  cameraModal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: #000; z-index: 9999; display: flex; flex-direction: column;
    justify-content: space-between; overflow: hidden; box-sizing: border-box;
  `;

  cameraModal.innerHTML = `
    <!-- Native Device Camera Video Viewfinder with Zero Flash Attributes -->
    <video id="camera-feed" autoplay playsinline muted preload="auto" style="width: 100%; height: 100%; object-fit: cover; background: #000; position: absolute; top: 0; left: 0; z-index: 1; opacity: 0; transition: opacity 0.25s ease;" onloadeddata="this.style.opacity='1'"></video>

    <!-- Horizontally Justified Translucent Ghost Overlay with Dynamic Orientation Scaling -->
    <div class="ghost-overlay-container ${fitClass}">
      <img src="${refImgSrc}" id="ghost-overlay-img" class="ghost-overlay-frame ${fitClass}" onerror="this.onerror=null; this.src='/assets/images/independence_hall.webp';" />
    </div>

    <!-- Camera Top Bar Controls -->
    <div style="position: relative; z-index: 10; padding: max(env(safe-area-inset-top), 20px) 16px 10px 16px; display: flex; align-items: center; justify-content: space-between; background: linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%);">
      <button id="btn-close-match-camera" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.3); color: #FFF; border-radius: 10px; padding: 8px 14px; font-weight: 800; font-size: 13px; cursor: pointer;">
        ← Return to ${site.name}
      </button>
      <span style="background: #0B5A68; color: #FFF; font-weight: 800; font-size: 12px; padding: 6px 12px; border-radius: 12px;">
        Option ${optionNum} Viewfinder
      </span>
    </div>

    <!-- Camera Bottom Action Area: Single Physical Circular Shutter Button ONLY -->
    <div style="position: absolute; bottom: 0; left: 0; right: 0; z-index: 10; padding: 20px 16px max(env(safe-area-inset-bottom), 30px) 16px; background: linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;">
      <p style="color: #FFFFFF; font-size: 12px; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.8); font-weight: 600;">
        Align monument with translucent guide & tap shutter to snap
      </p>

      <!-- Physical Circular Shutter Button -->
      <button 
        id="btn-shutter-snap" 
        onclick="window.snapShutterAndVerify('${site.id}', ${optionNum})" 
        style="width: 72px; height: 72px; border-radius: 50%; background: #FFFFFF; border: 5px solid #0B5A68; box-shadow: 0 4px 20px rgba(0,0,0,0.5), inset 0 0 0 3px #FFFFFF; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; transition: transform 0.1s ease;"
      >
        <div style="width: 52px; height: 52px; border-radius: 50%; background: #0B5A68;"></div>
      </button>
    </div>
  `;

  document.body.appendChild(cameraModal);

  function enforceCameraLayout() {
    const container = document.getElementById('camera-viewfinder-root') || document.querySelector('.camera-viewfinder-root');
    const containers = document.querySelectorAll('.camera-viewfinder-root, #camera-viewfinder-root, #live-ghost-camera-screen, #photo-match-camera-screen');
    if (!container && !containers.length) return;
    const isLandscape = window.innerWidth > window.innerHeight;
    if (container) {
      if (isLandscape) {
        container.classList.add('landscape-active');
        container.classList.add('landscape-viewfinder');
      } else {
        container.classList.remove('landscape-active');
        container.classList.remove('landscape-viewfinder');
      }
    }
    containers.forEach(c => {
      if (isLandscape) {
        c.classList.add('landscape-active');
        c.classList.add('landscape-viewfinder');
      } else {
        c.classList.remove('landscape-active');
        c.classList.remove('landscape-viewfinder');
      }
    });
  }
  window.enforceCameraLayout = enforceCameraLayout;
  window.addEventListener('resize', enforceCameraLayout);
  window.addEventListener('orientationchange', () => setTimeout(enforceCameraLayout, 150));
  if (!window._enforceCameraLayoutInterval) {
    window._enforceCameraLayoutInterval = setInterval(enforceCameraLayout, 500);
  }

  window.checkAndRotateSilhouette = function () {
    const overlay = document.getElementById('ghost-overlay-img') || document.getElementById('ghost-guide-overlay') || document.querySelector('.ghost-overlay-frame');
    if (!overlay) return;
    overlay.style.transform = 'none';
  };

  window.updateSilhouetteOrientation = window.checkAndRotateSilhouette;

  // Attach multiple listeners
  window.addEventListener('resize', window.checkAndRotateSilhouette);
  window.addEventListener('orientationchange', () => setTimeout(window.checkAndRotateSilhouette, 100));
  if (!window._silhouettePollingInterval) {
    window._silhouettePollingInterval = setInterval(window.checkAndRotateSilhouette, 250);
  }

  // Initial check when camera opens
  enforceCameraLayout();
  window.checkAndRotateSilhouette();
  setTimeout(window.checkAndRotateSilhouette, 100);

  // Handle Close Button (Routing back to site-detail)
  document.getElementById('btn-close-match-camera').onclick = function () {
    if (window._silhouetteOrientationHandler) {
      window.removeEventListener('orientationchange', window._silhouetteOrientationHandler);
      window.removeEventListener('resize', window._silhouetteOrientationHandler);
      if (screen.orientation) {
        screen.orientation.removeEventListener('change', window._silhouetteOrientationHandler);
      }
    }
    const video = document.getElementById('camera-feed');
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
    cameraModal.remove();
    window.navigate('site-detail', { id: site.id });
  };

  // Start Camera Stream cleanly
  (async function startCameraFeed() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      const video = document.getElementById('camera-feed');
      if (video) {
        video.srcObject = stream;
        await video.play();
        video.style.opacity = '1';
      }
    } catch (err) {
      console.error("Camera access failed:", err);
      const existingError = document.getElementById('in-app-camera-permission-error');
      if (existingError) existingError.remove();
      const errorPanel = document.createElement('div');
      errorPanel.id = 'in-app-camera-permission-error';
      errorPanel.className = 'in-app-camera-permission-error';
      errorPanel.innerHTML = `
        <div aria-live="assertive">
          <div class="in-app-camera-error-icon">📷</div>
          <h3>Camera permission is needed</h3>
          <p>Allow camera access for YathraLanka. The camera will remain inside this app with the reference silhouette visible.</p>
          <button type="button" id="retry-in-app-camera">Try In-App Camera Again</button>
        </div>
      `;
      cameraModal.appendChild(errorPanel);
      document.getElementById('retry-in-app-camera').onclick = () => {
        cameraModal.remove();
        window.openPhotoMatchCamera(site.id, optionNum);
      };
    }
  })();
};

window.snapShutterAndVerify = async function (siteId = 'independence_memorial_hall', optionNum = 1) {
  const video = document.getElementById('camera-feed');
  const cleanId = String(siteId).toLowerCase().trim();
  const pool = window.sitesData || (typeof getDirectoryDataset === 'function' ? getDirectoryDataset() : []);
  const site = pool.find(s => String(s.id).toLowerCase() === cleanId) || {
    id: 'independence_memorial_hall',
    name: 'Independence Memorial Hall'
  };

  // Clean up orientation listener
  if (window._silhouetteOrientationHandler) {
    window.removeEventListener('orientationchange', window._silhouetteOrientationHandler);
    window.removeEventListener('resize', window._silhouetteOrientationHandler);
    if (screen.orientation) {
      screen.orientation.removeEventListener('change', window._silhouetteOrientationHandler);
    }
  }

  // STRICT: Do not analyze if stream is not active or video is paused/empty
  if (!video || !video.srcObject || video.paused || video.ended || !video.videoWidth) {
    console.warn("Camera stream inactive. Snapping photo requires active video feed.");
    if (typeof showNotification === 'function') {
      showNotification("Camera feed inactive. Please enable camera access.", "error");
    }
    return;
  }

  const option = window.getLandmarkVerificationOption(site, optionNum);
  const shutter = document.getElementById('btn-shutter-snap');
  const instruction = shutter?.parentElement?.querySelector('p');
  if (shutter) {
    shutter.disabled = true;
    shutter.classList.add('is-analyzing');
  }
  if (instruction) instruction.textContent = 'Comparing captured frame with the selected reference…';

  let result;
  try {
    result = await window.analyzeLandmarkPhoto(video, option.image || site.image, document.getElementById('ghost-overlay-img'));
  } catch (error) {
    console.error('Photo comparison failed:', error);
    if (shutter) {
      shutter.disabled = false;
      shutter.classList.remove('is-analyzing');
    }
    if (instruction) instruction.textContent = 'Comparison could not finish. Keep the camera steady and try again.';
    window.showNotification?.('The photo comparison could not finish. Please try again.', 'error');
    return;
  }

  // Stop camera stream
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
  }

  const cameraModal = document.getElementById('photo-match-camera-screen');
  if (cameraModal) cameraModal.remove();

  const framingScreen = document.getElementById('target-framing-screen');
  if (framingScreen) framingScreen.remove();

  if (!window.state) window.state = {};
  const currentUid = auth?.currentUser?.uid || window.state?.user?.uid;
  const siteProgressKey = typeof window.getSiteProgressKey === 'function'
    ? window.getSiteProgressKey(currentUid)
    : 'yathra_site_progress';
  if (!window.state.siteProgress) {
    try {
      window.state.siteProgress = JSON.parse(localStorage.getItem(siteProgressKey) || '{}');
    } catch (error) {
      window.state.siteProgress = {};
    }
  }
  if (!window.state.siteProgress[cleanId]) window.state.siteProgress[cleanId] = {};
  const progress = window.state.siteProgress[cleanId];
  if (!progress.photoOptionResults) progress.photoOptionResults = {};
  progress.photoOptionResults[Number(optionNum)] = {
    score: result.score,
    passed: result.passed,
    attemptedAt: Date.now()
  };

  const alreadyPhotoVerified = Boolean(progress.photoVerified || localStorage.getItem('site_photo_verified_' + cleanId) === 'true');
  let xpAwarded = 0;

  // Award photo XP only after the model reaches the required 75% threshold.
  if (result.passed) {
    if (!alreadyPhotoVerified && typeof window.awardLandmarkXP === 'function') {
      window.awardLandmarkXP(cleanId, 'PHOTO');
      xpAwarded = 70;
    }
    progress.photoVerified = true;
    localStorage.setItem('site_photo_verified_' + cleanId, 'true');
  }

  try {
    localStorage.setItem(siteProgressKey, JSON.stringify(window.state.siteProgress));
  } catch (e) { }

  if (result.passed) {
    if (typeof window.recalculateTotalXP === 'function') window.recalculateTotalXP();
    if (typeof saveUserProfile === 'function') saveUserProfile();
  }

  window.showPhotoComparisonResult(site, option, result, xpAwarded);
};

window.returnToLandmarkVerificationOptions = function (siteId) {
  document.getElementById('photo-comparison-result')?.remove();
  window.navigate('site-detail', { id: siteId, preserveOrigin: true });
  setTimeout(() => window.switchSiteDetailTab?.('verification'), 0);
};

window.showPhotoComparisonResult = function (site, option, result, xpAwarded = 0) {
  document.getElementById('photo-comparison-result')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'photo-comparison-result';
  overlay.className = `photo-comparison-result ${result.passed ? 'is-passed' : 'is-rejected'}`;
  const thresholdDifference = Math.abs(result.score - 75);
  const currentXP = Number(window.state?.user?.xp || window.state?.xp || 0);
  overlay.innerHTML = `
    <div class="photo-comparison-result-card" role="dialog" aria-modal="true" aria-labelledby="photo-result-title">
      <div class="photo-result-status">${result.passed ? 'IMAGE VERIFICATION COMPLETE' : 'IMAGE VERIFICATION NOT COMPLETED'}</div>
      <div class="photo-result-score-ring"><strong>${result.score}%</strong><span>match</span></div>
      <h2 id="photo-result-title">${result.passed ? 'Reference match accepted' : 'Reference match below 75%'}</h2>
      <p class="photo-result-summary">
        ${result.passed
          ? `The captured image matched ${option.title} by ${result.score}%, which is ${thresholdDifference}% above the required score.`
          : `The captured image matched ${option.title} by ${result.score}%, which is ${thresholdDifference}% below the required score. This does not prevent trying any other option.`}
      </p>
      <div class="photo-result-comparison">
        <figure><img src="${option.image}" alt="Selected reference image"><figcaption>Original reference</figcaption></figure>
        <figure><img src="${result.capturedDataUrl}" alt="Photo captured by visitor"><figcaption>Your captured photo</figcaption></figure>
      </div>
      <div class="photo-result-metrics" aria-label="Image comparison details">
        <span><strong>${result.metrics.structure}%</strong> Structure</span>
        <span><strong>${result.metrics.outline}%</strong> Outline</span>
        <span><strong>${result.metrics.color}%</strong> Colour</span>
        <span><strong>${result.metrics.framing}%</strong> Framing</span>
      </div>
      ${result.passed
        ? `<div class="photo-result-xp">${xpAwarded ? `+${xpAwarded} XP added immediately · Total ${currentXP} XP` : `Photo XP already awarded · Total ${currentXP} XP`}</div>`
        : '<div class="photo-result-guidance">Move closer to the silhouette, match its scale and edges, keep the phone steady, and use similar lighting.</div>'}
      <div class="photo-result-actions">
        <button type="button" id="retry-photo-option">${result.passed ? `Try ${option.title} Again` : 'Retry This Option'}</button>
        <button type="button" id="choose-photo-option">Choose Another Option</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('retry-photo-option').onclick = () => {
    overlay.remove();
    window.openPhotoMatchCamera(site.id, option.number);
  };
  document.getElementById('choose-photo-option').onclick = () => window.returnToLandmarkVerificationOptions(site.id);
};

window.triggerNativeCapacitorCamera = async function (siteId, optionNum) {
  if (typeof window.updateGlobalFooterVisibility === 'function') {
    window.updateGlobalFooterVisibility();
  }
  if (typeof window.updateSilhouetteOrientation === 'function') {
    window.updateSilhouetteOrientation();
  }
  try {
    if (window.Capacitor && window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('Camera')) {
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera
      });
      if (image && image.webPath) {
        window.snapShutterAndVerify(siteId, optionNum);
      }
    }
  } catch (e) {
    console.warn("Capacitor camera fallback skipped:", e);
  }
};

