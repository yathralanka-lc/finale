# YathraLanka Phase 1 Feature Audit and Production Scope

**Status:** Approved and scope-locked by the project owner on 13 September 2026  
**Next phase:** Phase 2 requirements baseline and implementation planning

## 1. Executive assessment

YathraLanka already has a substantial working prototype: a responsive web application, Android and iOS project shells, Firebase authentication and profile sync, a 15-site directory, GPS-gated landmark flows, camera capture, quizzes, XP and ranks, profiles, rewards, and community-action screens. Its strongest asset is not any single screen; it is the coherent product idea connecting travel, learning, verification, and heritage participation.

The application is **not yet ready for a public production launch or app-store submission**. The main reason is not visual polish. Several systems that appear complete in the interface are still local demonstrations, conflicting implementations, or unverified content. Examples include simulated photo-match percentages, a client-editable verification ledger, a hard-coded leaderboard, locally awarded points and rewards, incomplete settings and legal pages, conflicting quiz engines, and no production security rules or automated test suite in the repository.

The right course is to preserve the single shared Capacitor/Vite codebase and complete one defined Version 1 product. Capacitor is specifically designed to package a web application for iOS and Android while retaining a shared codebase.[^1] Android and iOS should therefore not be developed as separate products and merged later. Platform-specific work should be limited to capabilities that genuinely differ: permissions, sign-in, deep links, camera/location behavior, store requirements, and device testing.

### Overall verdict

| Dimension | Current assessment | Production implication |
|---|---|---|
| Product concept | Strong and differentiated | Preserve the heritage journey, learning, and participation model |
| Feature breadth | Broad prototype | Narrow the first production release to capabilities that can be made trustworthy |
| Web experience | Functional but structurally fragile | Consolidate duplicate implementations before further visual redesign |
| Android | Installable development build | Requires security, signing, deep-link, permission, and release testing work |
| iOS | Capacitor project exists | Requires Mac/Xcode completion, Apple sign-in decision, universal links, privacy configuration, and TestFlight validation |
| Content | 15 sites, but uneven completeness | Establish an editorial workflow and approve every site, question, coordinate, and image |
| Verification | GPS works; visual score is not genuine recognition | Ship GPS plus guided photo capture, or build a real validated recognition service before claiming image verification |
| Identity | Firebase is integrated; legacy flows remain | Remove insecure legacy account storage and unify all sign-in paths |
| Rewards and ranking | Useful interface and rules foundation | Move authoritative scoring and redemption to trusted backend logic |
| Quality assurance | Mainly manual | Add automated tests, device matrix, staging, monitoring, and release gates |

## 2. Audit method and evidence standard

This audit reviewed the current repository as the source of truth, including application code, data, native Android and iOS configuration, deployment configuration, prior internal documentation, and recent reported device behavior. It distinguishes four different meanings of “complete”:

1. **Present**: a screen, route, data record, or control exists.
2. **Functional**: the feature works in at least one expected path.
3. **Verified**: expected, error, recovery, rotation, offline, and cross-device paths have passed repeatable tests.
4. **Production-ready**: the feature is secure, accessible, observable, legally supported, maintainable, and ready for real users.

The current code proves “present” for many features. It proves “functional” for a smaller set. It does not yet provide enough repeatable evidence for most features to be called “verified” or “production-ready.” Historical walkthrough documents and manual reports are useful evidence, but they are not substitutes for current acceptance tests.

### Audit status labels

- **Harden:** the concept and most behavior can remain, but production safeguards are required.
- **Complete:** the feature is partially implemented and needs defined missing work.
- **Rebuild:** the current implementation should not be promoted to production.
- **Defer:** valuable later, but not essential for a trustworthy Version 1.
- **Remove:** misleading, insecure, duplicate, or unsupported behavior should be taken out.
- **Decision required:** product or business ownership must define the rule before engineering proceeds.

## 3. Current product and technical baseline

### 3.1 Application structure

The product is a Vite-based single-page web application wrapped by Capacitor for Android and iOS. Vercel hosts the web build. Firebase provides Authentication, Firestore profile storage, and Analytics. Camera and geolocation are accessed through Capacitor plugins.

The approach is appropriate for the available equipment and team: most work can be done on the Windows PC, while the Apple computer is used for iOS certificates, Xcode configuration, device testing, TestFlight, and App Store submission. Apple builds cannot be completed and signed solely from Windows.

The implementation is currently concentrated in three unusually large files:

| File | Approximate size | Risk |
|---|---:|---|
| `src_web/app.js` | 13,237 lines | Routes, business rules, rendering, native integrations, and event binding are tightly coupled |
| `src_web/style.css` | 6,528 lines | Competing rules and extensive overrides make visual regressions likely |
| `src_web/data.js` | 3,363 lines | Product content and business configuration are mixed in one static file |

This monolithic structure explains recurring regressions such as duplicate footers, inconsistent profile/rank presentations, overlapping quiz behavior, and changes that fix one device while affecting another. Production visual work should start only after the core structure is separated into reusable components, services, and centrally defined rules.

### 3.2 Current feature inventory

The router exposes these major experiences:

- Welcome, sign-in, account creation, permission setup, role selection, and orientation/compass preparation.
- Home/dashboard, directory, map, Heritage Trail, Hidden Gems, and landmark details.
- GPS proximity validation, checkpoint guidance, camera capture, photo result, and verification history.
- Landmark quizzes, retry limits, cooldown, XP, ranks, medals, rewards, and leaderboard.
- Side quests and community action: petitions, donations, cleanups, and event creation.
- Profile, journey map/poster, settings, offline sync, guidelines, and ledger.

This breadth is larger than an advisable first production release. Some items should be moved behind a “future release” boundary until the necessary business operations and backend services exist.

## 4. Detailed feature audit

### 4.1 Welcome, onboarding, and permissions

**Current state:** Present and broadly functional. The app has welcome, guest, account, role, permissions, and instructional paths. Responsive behavior has recently been improved.

**Findings:**

- The guest path is valuable and has been the most reliable route during manual tests.
- The permission experience needs to request camera and location only when their value is clear to the user, and it needs a recovery path when permission is denied.
- Android configuration includes camera, fine location, and coarse location, but also contains the nonstandard permission `android.permission.ACCESS_COORDINATES`, which should be removed.
- iOS currently includes broad location descriptions and `NSAllowsArbitraryLoads=true`. The broad network exception should be removed unless a documented HTTPS exception genuinely requires it.
- Onboarding text, permission text, and actual runtime requests need to match exactly. Apple requires privacy-sensitive permissions to be relevant and clearly described.[^2]

**Scope decision:** **Harden for Version 1.** Keep guest onboarding, but define exactly which activities require an account. Add denied-permission recovery, precise copy, and analytics for onboarding completion and abandonment.

### 4.2 Account creation, sign-in, and session management

**Current state:** Firebase email/password and Google authentication are integrated; native and web sign-in paths exist. There are also older local activation and password-handling paths.

**Critical findings:**

- A legacy pending-registration flow stores a password in browser local storage. Plaintext passwords must never be stored by the application. This path must be removed, not patched.
- Multiple overlapping authentication handlers remain. This has already produced redirect, popup, and native Google-sign-in failures.
- The app intentionally signs out a restored Firebase session during some startup/sign-in flows. That is likely to produce unnecessary repeated authentication and should be replaced with one predictable session policy.
- It is not yet proven that email verification is consistently enforced before an account receives full privileges.
- Account linking between password and Google providers is complex and requires explicit tests for existing-account, cancelled chooser, offline, and wrong-password cases.
- There is no complete in-app account deletion and personal-data export flow visible in the repository. Apple requires apps supporting account creation to also support account deletion within the app.[^2]
- If Google remains a primary third-party sign-in option on iOS, the app must evaluate and normally provide an equivalent privacy-preserving login option, commonly Sign in with Apple, under Apple’s login-services rule.[^2]

**Scope decision:** **Rebuild the authentication boundary for Version 1.** Retain Firebase, but remove every legacy password/token system. Establish one session manager, one Google flow per platform, verified-email rules, Sign in with Apple for iOS if required, account deletion, sign-out, provider linking, and recovery tests.

### 4.3 Home, navigation, layout, and orientation

**Current state:** The app includes desktop-responsive and phone layouts and supports sensor orientation in Android. A persistent four-item navigation model is established.

**Findings:**

- Multiple renderers exist for conceptually identical screens, including dashboard, profile, directory, navigation, and quiz experiences.
- A large number of inline styles and event handlers bypass a shared design system.
- The recently reported double-footer defect was a symptom of two navigation-rendering paths being active.
- Desktop should use the available width intelligently, but mobile should remain the primary interaction target. Tablet and landscape layouts need intentional compositions rather than simple stretching.
- Safe areas, notches, dynamic browser bars, keyboard appearance, and rotation need repeatable device tests. Apple’s layout guidance emphasizes adapting to window size, safe areas, and orientation rather than relying on one fixed canvas.[^3]

**Scope decision:** **Harden for Version 1.** Keep the four main destinations, but create one app shell, one navigation component, one screen-width system, and one orientation policy. Remove phone-chassis simulation from normal production layouts.

### 4.4 Landmark directory, trails, maps, and content

**Current state:** Fifteen sites are configured: nine Heritage Trail sites and six Hidden Gems. Every site has a coordinate, main image, reference image, description, XP value, and at least one checkpoint. All referenced site, option, reward, and quest image files currently resolve in the public asset folder.

**Findings:**

- Distances written into static data are not live distance values and should not be displayed as if current.
- Site names, descriptions, historical statements, opening status, accessibility information, and coordinates do not yet have a documented source/approval record.
- “Open now” cannot be trustworthy as static data. It needs either maintained opening hours or neutral wording.
- Only Colombo National Museum has two checkpoints. Other sites have one. The product rule for checkpoint count is not defined.
- Map and directory state need consistent filters, empty states, loading states, and offline behavior.
- Google Maps key restrictions and production billing/quotas must be configured outside source code.

**Scope decision:** **Complete for Version 1.** Launch only sites that pass a per-site content checklist. A site must have approved coordinates, title, district, summary, opening/access notes, licensed media, verification mode, quiz bank, and named content owner.

### 4.5 GPS proximity verification

**Current state:** The app requests fresh location and calculates distance to the configured landmark. The BMICH coordinate is currently `6.9016667, 79.8727778`, corresponding to the supplied `06°54′06″N 79°52′22″E`.

**Findings:**

- A fixed 500-metre boundary is simple, but GPS accuracy can vary significantly by device, sky visibility, buildings, network conditions, and power mode.
- The decision currently relies principally on a point-to-point distance. It needs to account for reported accuracy and reject or retry low-confidence readings.
- Each site needs an operationally approved geofence center and radius. One global radius may be unsuitable for every site.
- The interface must show whether it is waiting for a better reading, using an inaccurate reading, or genuinely outside the area.
- Location-derived achievements and XP are client-controlled and therefore vulnerable to location spoofing or browser manipulation.

**Scope decision:** **Harden for Version 1.** GPS can be the authoritative requirement for on-site participation only after accuracy-aware handling, timeouts, retry guidance, per-site radii, audit logging, and backend validation are defined. Do not claim robust anti-spoofing until it is implemented and tested.

### 4.6 Camera capture and image verification

**Current state:** Camera capture, visual guide overlays, zoom controls, and success/rejection screens exist. BMICH, Colombo National Museum, and Independence Memorial Hall each have three explicit reference options. Galle Dutch Fort has been added to the launch scope, but its three project-owner-approved images must be requested during implementation. The remaining eleven deferred sites rely on a single reference or fallback rather than three defined options.

**Critical finding:** The current “vision” percentage is not genuine landmark recognition. One path derives a value from a simple hash of the captured image and another produces a random confidence between 88% and 94%. The ledger label suggests SHA-256, but the stored value is generated by a small custom integer hash. These results must not be presented to users, partners, or reviewers as AI image verification or cryptographic proof.

**Other findings:**

- Overlay zoom and crop behavior have improved, but need device-level acceptance tests for smoothness and correct in-frame comparison.
- Twelve sites still need a defined verification set if the business rule is three options per site.
- Lighting, motion blur, crowds, seasonal changes, renovation, camera aspect ratios, and accessibility alternatives are not covered by a validation dataset.
- Captured images raise consent, retention, deletion, security, and bandwidth requirements.

**Scope decision:** Choose one of two honest Version 1 approaches:

1. **Approved Version 1 approach:** GPS verification plus a guided camera step, with the captured frame processed only transiently in memory and immediately discarded. Retain only approved completion metadata and show no automated “match confidence” claim.
2. **Larger scope:** Build a real image-matching service, validation dataset, threshold study, failure/review process, privacy controls, and server-side decision record.

Until the second option is proven, remove simulated percentages, “vision model” wording, and cryptographic claims. This is a **P0 launch blocker**.

### 4.7 Quizzes and learning progression

**Current state:** Fourteen sites have 20 questions. Independence Memorial Hall has only one. The intended active model samples five questions, randomizes answer order, uses a 30-second timer, requires five correct answers, permits three attempts, and then applies a 30-minute cooldown.

**Critical findings:**

- A second legacy quiz engine remains in the same application. It uses different timers, question counts, and a five-minute cooldown. This conflict can cause progression failures like the reported stop after question three.
- The rules are not centrally defined; interface text and behavior can diverge.
- All historical questions and answers need authoritative editorial review and citation records.
- Requiring 100% may be appropriate for a mastery badge, but it needs usability validation and a clear separation between “quiz completed” and “mastery achieved.”
- Cooldown state is stored locally and can be manipulated.

**Scope decision:** **Rebuild into one quiz module for Version 1.** Complete 50 approved questions for every launch site; sample five without repetition; shuffle answer positions; use one timer rule; define pass/mastery rules; persist attempts through the backend for signed-in users; and add deterministic tests for question 1 through results, retry, timeout, cooldown, back navigation, rotation, and relaunch.

#### Required pre-quiz notice

Before every landmark quiz begins, show a clear preparation screen in point form. The quiz timer must not begin while this notice is displayed. The screen must explain:

- The quiz contains five questions selected from that landmark's approved question bank.
- Each question has four answer choices and only one correct answer.
- The time allowed for each question, once the final timing rule is approved.
- Whether unanswered questions are automatically marked incorrect when time expires.
- The score required to complete the quiz and the separate score required to earn the Landmark Mastery Badge, if those outcomes differ.
- How many attempts are allowed and when a cooldown begins.
- The length and scope of the cooldown, including whether it applies only to this landmark or to every quiz.
- Whether leaving, refreshing, rotating the phone, receiving a call, or closing the app pauses, continues, or ends the attempt.
- The XP and badge outcomes available, including whether rewards can be earned again.
- A short reminder that questions and answer choices may appear in a different order on another attempt.

The notice must provide two unambiguous actions: **Start Quiz** and **Not Now**. Selecting **Not Now** must return the user safely without consuming an attempt. Selecting **Start Quiz** creates the attempt and starts the first question and timer. The notice must be readable with screen readers, usable in portrait and landscape, and shown again for every new attempt unless a later product decision explicitly allows the user to suppress it.

### 4.8 XP, ranks, achievements, and medals

**Current state:** The current rank scale is:

| Rank | XP range |
|---|---:|
| Novice Explorer | 0–999 |
| Pathfinder | 1,000–2,499 |
| Heritage Seeker | 2,500–4,999 |
| Cultural Guardian | 5,000–9,999 |
| Legacy Ambassador | 10,000+ |

This is the canonical scale that the dashboard, profile, rank screen, and leaderboard should all use.

**Findings:**

- Rank display has recently been consolidated, but points are still awarded on the client and can be edited in web storage.
- Five achievement medals are configured, but their implementation does not consistently enforce their descriptions. Time windows, districts, first-attempt conditions, and named-site requirements are not reliably checked.
- Terms such as seals, badges, medals, mastery, points, and XP have been used inconsistently.
- The product needs one taxonomy and one source of truth.

**Recommended vocabulary:**

- **XP:** the single numeric progression currency.
- **Rank:** one of the five XP-based levels above.
- **Landmark Mastery Badge:** awarded for meeting a site’s quiz mastery rule.
- **Achievement Medal:** awarded for a defined multi-action challenge.
- **Reward:** a partner benefit redeemed under documented terms.

Remove “Royal Seal” unless it has a separate, clearly defined business meaning. Do not use “points” and “XP” interchangeably in user-facing screens.

**Scope decision:** **Harden for Version 1.** Move award decisions to trusted backend logic, write precise event and medal rules, add an immutable transaction history at the server level, and test every threshold boundary.

### 4.9 Leaderboard

**Current state:** The interface uses a hard-coded list of four sample people.

**Findings:**

- It is not a live ranking service.
- Production leaderboards require opt-in display names, privacy controls, abuse prevention, authoritative scoring, tie rules, refresh rules, seasonal/all-time definition, and moderation.
- Displaying invented sample people in production would misrepresent the feature.

**Scope decision:** **Defer from the first public release** unless a real backend and privacy model are funded. Replace it with personal progress, or clearly label a non-production preview only in internal builds.

### 4.10 Rewards and partner redemption

**Current state:** Three static rewards are configured. Unlocking and redemption are primarily local interface state.

**Findings:**

- There is no demonstrated inventory, partner contract, voucher issuance, expiry, fraud control, redemption confirmation, or support workflow.
- One reward identifies `@Kandy Cafe`; this and every commercial statement require partner approval.
- XP-spend behavior needs a transaction and refund policy.

**Scope decision:** **Defer partner rewards** until at least one real partner workflow is operational. Version 1 can retain non-commercial digital achievements. Never advertise a redeemable benefit before the partner, terms, inventory, and support process are ready.

### 4.11 Community actions, petitions, donations, cleanups, and events

**Current state:** The app presents petition, donation, cleanup registration, and event creation experiences.

**Critical findings:**

- Petition signatures and event registrations are largely local user-state changes rather than verifiable external actions.
- The donation flow awards XP and reports a secure PayHere-style action without demonstrating a payment transaction in the current handler.
- Event creation introduces user-generated content, moderation, reporting, safety, organizer verification, and liability requirements.
- Donation and petition claims require real organizations, receipts/confirmation, legal terms, and auditable integration.

**Scope decision:** For Version 1, either integrate each action with a real approved service or **defer/disable it**. A safe first release can show verified partner events as read-only listings and link externally to an approved organization. User-created events, in-app donation claims, and local-only petitions should not ship as operational features.

### 4.12 Profile, journey map, and settings

**Current state:** The profile now uses clearer labels for journey, medals, activities, quiz progress, and settings. A profile image can be selected locally. Settings currently exposes Permissions, Account, Language, Privacy Policy, Help & Support, About, and Log Out.

**Findings:**

- Most settings rows are visual placeholders and do not open complete experiences.
- The profile image is stored as a data URL in local storage, which is unsuitable for cross-device sync and may exceed browser storage limits.
- The journey poster includes sharing-like icons but not a complete accessible share/export workflow.
- Language displays “English,” but no localization framework is present; interface text is hard-coded throughout the application.
- Privacy Policy, Terms, support contact, data export, account deletion, notification controls, and consent history need complete pages and actions.

**Scope decision:** **Complete for Version 1.** Ship only settings that work. Add Account & Security, Privacy & Data, Permissions, Notifications if notifications ship, Language only when localization exists, Help & Support, Legal, App Version, Sign Out, and Delete Account. Store profile media in an approved cloud-storage path or use provider/default avatars.

### 4.13 Offline behavior and sync

**Current state:** The app has local caches and queue-like state and presents an offline-sync experience.

**Findings:**

- There is no service worker or installable web-app manifest in the repository, so the hosted web version is not a complete Progressive Web App.
- Local storage is used heavily for identity, progress, cooldown, verification, medals, and queue state. It is synchronous, capacity-limited, client-editable, and not a reliable system of record.
- Conflict rules between local and Firestore data are not fully documented or tested.

**Scope decision:** Do not promise “offline-first” until offline journeys, conflict resolution, retries, and data-loss behavior are specified and tested. For Version 1, support **offline-tolerant browsing** of selected cached content, queue only clearly safe actions, and require connectivity for authentication, authoritative scoring, reward redemption, and final verification.

### 4.14 Verification ledger and security claims

**Current state:** A local verification history records events and shows signatures.

**Finding:** The ledger is stored in user-controlled browser storage, its signature is not a cryptographic SHA-256 implementation, and records can be changed. It is neither immutable nor suitable as evidence of a verified action.

**Scope decision:** **Remove cryptographic and immutable-ledger wording from Version 1.** Replace it with “Activity History” backed by authenticated server records. If tamper-evident audit evidence is later required, design it as a backend security project with proper cryptography, access controls, retention, and incident review.

### 4.15 Accessibility and inclusive design

**Current state:** The app has attractive contrast in many places and generally large primary actions, but accessibility has not been systematically validated.

**Findings:**

- Several labels and secondary texts are very small.
- Emoji and icon-only controls may not have reliable accessible names.
- Inline click handlers and nonsemantic elements can impair keyboard and assistive-technology operation.
- Focus order, focus visibility, screen-reader announcements, text enlargement, reduced motion, color-only status, and camera/location alternatives need testing.
- Apple recommends supporting adaptable layouts, larger text, sufficient contrast, and alternatives to gestures or visual-only information.[^4]

**Scope decision:** Accessibility is a **Version 1 acceptance criterion**, not a later visual enhancement. Adopt WCAG 2.2 AA as the web target and test with keyboard, screen readers, text enlargement, contrast tools, orientation, and reduced-motion settings.

### 4.16 Analytics, monitoring, and support operations

**Current state:** Firebase Analytics is initialized.

**Missing production capabilities:**

- Crash and unhandled-error reporting with privacy-safe context.
- Authentication failure funnel, permission failure, GPS accuracy, camera failure, quiz abandonment, and sync-error events.
- Environment separation for development, staging, and production.
- Operational alerts and named ownership for incidents.
- A user support path with diagnostic information and response targets.
- Consent and data-minimization review for analytics.

**Scope decision:** Add a minimal production observability plan before external testing. Do not record precise coordinates, photos, passwords, tokens, or unnecessary personal data in analytics or logs.

### 4.17 Android, iOS, and QR/deep-link distribution

**Current state:** Android and iOS Capacitor projects exist, but QR-to-platform distribution is not implemented. There are no Android Digital Asset Links or Apple App Site Association files in the repository.

**Recommended model:**

1. Use one stable HTTPS URL in the QR code, for example `https://yathralanka.lk/get`.
2. If the app is installed, verified Android App Links and iOS Universal Links can open the relevant in-app destination.[^5][^6]
3. If it is not installed, the web landing page offers the appropriate store plus a “Continue on web” option.
4. Avoid invisible forced redirects. Give the user a clear, reversible choice and retain campaign parameters without collecting excessive device information.

Android App Links require an intent filter in the app and a matching `assetlinks.json` file on the verified domain.[^5] Apple Universal Links require associated-domain capability in the app and an `apple-app-site-association` file on the website.[^6]

**Scope decision:** Implement this after permanent Android package ID, Apple bundle ID, signing teams, domain, and store listings are finalized. QR generation is the last step; the domain routing and verified app associations are the actual functionality.

## 5. Site-content completeness matrix

| Site | Quiz bank | Explicit photo options | Checkpoints | Scope assessment |
|---|---:|---:|---:|---|
| Independence Memorial Hall | 1 | 3 | 1 | **Incomplete:** add and approve 19 questions |
| Colombo National Museum | 20 | 3 | 2 | Content-complete in quantity; requires editorial and field verification |
| BMICH | 20 | 3 | 1 | Content-complete in quantity; coordinate and new imagery require field acceptance |
| Sigiriya | 20 | 0 | 1 | Define verification approach/options |
| Temple of the Tooth | 20 | 0 | 1 | Define verification approach/options and sensitive-site camera rules |
| Ruwanweliseya | 20 | 0 | 1 | Define verification approach/options and sensitive-site camera rules |
| Mihintale | 20 | 0 | 1 | Define verification approach/options |
| Galle Fort | 20 | 0 | 1 | Define verification approach/options and geofence scope |
| Dambulla Cave Temple | 20 | 0 | 1 | Define verification approach/options and sensitive-site camera rules |
| Ritigala | 20 | 0 | 1 | Define verification approach/options and connectivity expectations |
| Dowa Rock Temple | 20 | 0 | 1 | Define verification approach/options and sensitive-site camera rules |
| Yudaganawa | 20 | 0 | 1 | Define verification approach/options |
| Pilikuttuwa | 20 | 0 | 1 | Define verification approach/options and sensitive-site camera rules |
| Maligawila | 20 | 0 | 1 | Define verification approach/options |
| Buduruwagala | 20 | 0 | 1 | Define verification approach/options |

Quantity is not approval. Each quiz bank, image, coordinate, and descriptive statement needs an owner, source, review date, and status.

## 6. Cross-cutting production risks

### P0: must be resolved before any public production release

1. Remove plaintext password storage and legacy activation-token account flows.
2. Remove simulated photo-match percentages and misleading AI/cryptographic claims, or replace them with a real validated system.
3. Consolidate duplicate quiz, authentication, navigation, profile, and directory implementations.
4. Establish production Firebase/Firestore/Storage rules and server-authoritative XP/achievement decisions.
5. Disable local-only payment, petition, event, reward, and leaderboard claims unless backed by real services.
6. Add complete Privacy Policy, Terms, support, account deletion, and data-handling flows.
7. Establish staging and production environments and prevent test/demo records from entering production.

### P1: required for release candidate

1. Complete and approve all launch-site content.
2. Build a shared design system and responsive app shell.
3. Meet accessibility acceptance criteria.
4. Add unit, integration, end-to-end, visual, and native-device test coverage.
5. Add crash/error monitoring, analytics governance, support procedures, and backups.
6. Complete Android and iOS permissions, signing, deep links, native authentication, and release configuration.
7. Define offline behavior and conflict rules.
8. Improve performance through route/module separation, lazy loading, image optimization, and an explicit performance budget.

### P2: post-launch or optional expansion

1. Commercial partner reward marketplace.
2. In-app donations and petitions.
3. User-created community events.
4. Advanced image recognition.
5. Tamper-evident audit ledger.
6. Full multilingual content beyond the languages approved for Version 1.

## 7. Recommended Version 1 production scope

### Include

- Welcome, guest exploration, secure account creation/sign-in, session persistence, recovery, deletion, and privacy controls.
- Responsive web, Android, and iOS apps from the same shared product code.
- Curated directory of only approved launch sites.
- Search/filter, site detail, live distance, map navigation, and clear access information.
- Accuracy-aware GPS arrival/check-in.
- Guided camera verification with transient in-memory capture, no retained photograph, and no fabricated confidence claim.
- One standardized five-question quiz experience per approved site.
- A point-form pre-quiz notice explaining question count, timing, passing and mastery rules, attempts, cooldown, interruption behavior, and available XP before the attempt begins.
- Server-authoritative XP, five-rank scale, personal progress, mastery badges, and achievement medals whose rules are actually implemented.
- A server-authoritative Monthly and All Time leaderboard showing the top 20 eligible profiles, private nearby positioning, approved public fields, privacy controls, moderation, search, correction, and abuse handling.
- A protected role-based administration area with on-screen reports, CSV exports, PDF summaries, retention controls, and audited staff actions.
- Profile, journey history, functional settings, help, legal, and support.
- Offline-tolerant content browsing and explicit connectivity messages.
- One QR destination on `yathralanka.lk` with web/store/app-link behavior.
- Analytics, error monitoring, accessibility, and release-quality testing.

### Defer or disable

- Commercial rewards until partner fulfillment exists.
- In-app donation claims until real payment, legal, receipt, and refund processes exist.
- Local-only petitions and user-created events.
- Automated image-match confidence until independently validated.
- “Immutable” or cryptographic ledger claims until a secure server design exists.

## 8. Version 1 acceptance gates

A release candidate is ready only when all of the following are true:

### Product completeness

- Every visible control performs a real action or is removed.
- Every launch site passes the content checklist.
- Rank, XP, quiz, badge, and achievement terms are consistent everywhere.
- Guest and signed-in capability boundaries are documented and enforced.

### Reliability

- Critical user journeys pass on supported web browsers, representative Android devices, and representative iPhones/iPads.
- Rotation, interruption, back navigation, permission denial, offline/reconnection, and app relaunch are covered.
- No duplicate screens, navigation bars, timers, or event handlers remain.

### Security and privacy

- No password, token, secret, precise location, or captured image is stored insecurely.
- Backend rules use least privilege and are tested against unauthorized reads/writes.
- XP, verification, badges, rewards, and leaderboard data cannot be authoritatively changed by the client.
- Privacy, retention, consent, export, and deletion behaviors are implemented and documented.

### Accessibility and experience

- WCAG 2.2 AA target is met for the web experience.
- Screen reader, keyboard, text scaling, contrast, safe areas, and orientation pass.
- Loading, empty, offline, denied, failed, and retry states are designed consistently.

### Release operations

- Development, staging, and production are separate.
- Automated checks run before merge and deployment.
- Crash/error monitoring and a rollback process are active.
- Android internal/closed testing and iOS TestFlight pass before store review. Google Play provides internal, closed, and open testing tracks; some new personal accounts have additional closed-testing requirements.[^7][^8] Apple uses TestFlight and App Store Connect for beta and submission workflows.[^9]

## 9. Product decisions required before implementation

These are decisions, not technical questions. They determine scope and cost:

1. **Launch sites:** All 15, or a smaller pilot set? Recommended: 3–5 thoroughly verified Colombo-area sites first.
2. **Photo meaning:** Is a photo a guided journey record, or must it be automated proof? Recommended for Version 1: journey record plus GPS proof.
3. **Guest access:** Which actions can guests perform, and what data should remain after sign-in?
4. **Quiz mastery:** Must mastery be 5/5, or should completion and mastery be separate outcomes?
5. **XP authority:** Confirm that production XP and achievements must be awarded by trusted backend rules.
6. **Community actions:** Which organization will own petitions, events, donation funds, safety, and support?
7. **Rewards:** Are there signed partner commitments and redemption operations? If not, defer commercial rewards.
8. **Languages:** English-only Version 1, or English/Sinhala/Tamil? Multilingual launch materially increases content and QA scope.
9. **Age audience:** Is the app intended for children or schools? This changes privacy, consent, content, and store requirements.
10. **Data retention:** How long should precise location, photos, verification history, and account data be retained?
11. **Platforms:** Confirm Version 1 targets responsive web, Android, and iOS from the shared codebase.
12. **Business owner:** Name the person authorized to approve historical content, partner claims, legal text, and release readiness.

### Confirmed decisions

1. **Version 1 launch sites: amended and confirmed:** The first production pilot will include BMICH, Independence Memorial Hall, Colombo National Museum, and Galle Dutch Fort. The remaining eleven configured locations will not be included in the public pilot until each one completes the same content, field-verification, accessibility, and quality-acceptance process.
2. **Version 1 photo purpose: confirmed:** The pilot will use accuracy-aware GPS as the authoritative on-site confirmation. The camera silhouette provides a guided on-site capture step, but the captured image is transient: it is not uploaded, retained in YathraLanka, or made available in administration reports. The image must be discarded immediately after the step completes or is cancelled. The server stores only the authorized verification metadata defined below. Version 1 will not calculate or display an automated landmark-match percentage, and it will not automatically accept or reject a visit based on simulated image recognition. Genuine automated image verification is deferred until a separately validated recognition system, privacy model, and review process exist.
3. **Guest access: confirmed:** Guests may browse the landmark directory, maps, and site information and may take quizzes in clearly labelled practice mode. An authenticated account is required for GPS check-ins, guided camera-step completion, XP, ranks, badges, achievements, and permanent or synchronized progress. Captured verification frames are not saved. Practice results do not award XP or permanent achievements.
4. **Quiz completion and mastery: confirmed:** Each production quiz contains five questions. A score of 4/5 completes the quiz and awards the approved completion XP. A score of 5/5 completes the quiz, awards completion XP, and additionally earns the Landmark Mastery Badge and its approved bonus XP. Scores of 0–3 do not complete the quiz. Practice-mode quiz results do not award XP or badges.
5. **Quiz timing: confirmed:** Each question allows 30 seconds, reflecting the pilot's primary audience of technology-comfortable users and young people. The timer begins only after the user accepts the pre-quiz notice and selects **Start Quiz**. The remaining time must be clearly visible and announced accessibly. If time reaches zero before an answer is submitted, that question is recorded as unanswered and incorrect, feedback is shown, and the user can proceed to the next question.
6. **Quiz attempts and cooldown: confirmed:** A user receives up to three attempts for each landmark quiz. After three unsuccessful attempts at one landmark, only that landmark's quiz is locked for 30 minutes. Quizzes for other landmarks remain available. Selecting **Not Now** on the pre-quiz notice does not consume an attempt. Practice-mode attempts do not affect the signed-in production cooldown.
7. **Quiz interruption behavior: confirmed:** Rotation must preserve the current question and layout without resetting the attempt. Refreshing, receiving a call, switching apps, or temporarily closing YathraLanka must preserve the attempt while the 30-second limit continues according to trusted elapsed time. If the user returns before expiry, the current question continues with the correct remaining time. If the time has expired, the current question is recorded as unanswered and incorrect and the saved attempt continues to the next valid step. An interruption alone must not consume an additional attempt.
8. **XP and achievement authority: confirmed:** Accepted check-ins, production quiz results, XP, ranks, badges, medals, and related progression records must be validated and stored by trusted cloud services. The web or mobile client may show provisional interface state but cannot authoritatively award, alter, or delete progression. Browsing and guest practice may work without a connection, but an XP-awarding action requires server confirmation before it becomes final.
9. **Activism and community scope: confirmed:** Version 1 retains an Activism section containing only approved heritage events, volunteer opportunities, and educational campaigns. Calls to action must lead to a verified external organizer using clear disclosure. In-app donations, in-app petitions, user-created events, local-only registrations, and unverified claims of participation or payment are excluded from the pilot. Every listed external action requires an owner, current URL, review date, and removal process.
10. **Achievements scope and name: confirmed:** The current **Rewards** destination will be renamed **Achievements** throughout Version 1. It retains the user's XP rank, Landmark Mastery Badges, Achievement Medals, and personal progress. Commercial coupons, discounts, partner offers, redemption, and XP purchasing/spending are excluded from the pilot.
11. **Production leaderboard: confirmed:** Version 1 includes a genuine leaderboard backed by server-authoritative progression records. The hard-coded sample leaderboard must be removed. The confirmed rules below define scoring, ties, periods, participation, privacy, visibility, refresh, moderation, suspicious activity, appeals, search, public fields, and account-deletion handling.
12. **Leaderboard participation, identity, and privacy: confirmed:** Every signed-in user enters the leaderboard by default. Only the user's selected profile display name, approved profile image or default avatar, XP, rank, and leaderboard position may be displayed. Email addresses, authentication identifiers, precise location, verification photographs, and other private account data must never appear publicly. A user may hide their public leaderboard entry in Settings without losing XP, rank, achievements, or private progress. Hidden users are excluded from public positions and public search, while authorized operational records remain governed by the application's privacy and retention policy.
13. **Administration and detailed reporting: confirmed:** Version 1 requires a secure staff-only reporting area separate from the consumer application and public leaderboard. It supports authorized reporting on account sign-ins; quiz location, attempt count, score, completion, mastery, and timestamps; GPS-verified landmark visits; completion of the guided camera-verification step by location and user; XP and achievement transactions; and relevant failures or suspicious activity. Reports never contain captured photographs. The confirmed rules below define roles, filtering, CSV and PDF exports, 24-hour download expiry, 24-month activity retention, 12-month audit-log retention, and auditability. Multi-factor authentication remains optional by owner decision and is recorded as a production security risk.
14. **Administration access model: confirmed:** Reporting permissions will be role-based. Owners/administrators may access identified operational records, including profile display name and account email, when required for authorized operations. Analysts receive aggregated or anonymized reporting rather than direct personal identifiers. Support staff receive limited case-based lookup access for assisting a specific user. Authentication, authorization, and audit logs must record sensitive views, searches, corrections, and exports. No role receives access beyond the minimum required for its approved duties.
15. **Photograph storage and staff access: superseded by data minimization decision:** Version 1 does not retain captured landmark photographs. Consequently, no administrator, analyst, or support role can browse, open, search, or export them. Staff reporting is limited to permitted verification metadata.
16. **Transient camera data: confirmed:** A captured frame may exist only in memory for the minimum time needed to complete or cancel the guided camera step. It must not be written to cloud storage, Firestore, analytics, logs, browser storage, app storage, cache, or a device gallery. The retained event may record the authenticated user ID, landmark ID, approved GPS-verification result, camera-step completion status, and server timestamp, subject to the final retention policy.
17. **Activity and reporting retention: confirmed:** Current account state, such as XP, rank, earned badges, achievements, and completed-site progress, remains while the account exists. Identifiable event-level records for sign-ins, quiz attempts, GPS-verified visits, camera-step completion, and progression transactions are retained for 24 months. At the end of that period, identifying fields must be deleted or irreversibly anonymized; only non-identifiable aggregate statistics and trends may remain. Account deletion must remove or anonymize applicable personal records earlier, except narrowly defined security or legal records that the approved privacy policy requires YathraLanka to retain.
18. **Leaderboard periods: confirmed:** Version 1 provides both **Monthly** and **All Time** leaderboard views. The Monthly view ranks server-approved XP earned during the current calendar month in the application's official timezone and begins a new period automatically at the start of each month; it does not delete lifetime XP. The All Time view ranks total server-approved lifetime XP. The interface must state the active period and the Monthly period's start/end dates clearly.
19. **Leaderboard tie-breaking: confirmed:** Users are ordered first by server-approved XP for the selected period. If XP is equal, the user with more Landmark Mastery Badges ranks higher; if still equal, the user with more distinct GPS-verified pilot landmarks ranks higher; if still equal, the user who reached the tied XP total first ranks higher. The interface may display the deciding statistic or provide an explanation so tied users understand the ordering.
20. **Version 1 language: confirmed:** The four-site pilot will launch in English. The implementation must nevertheless externalize user-facing text and establish localization-ready layouts, content structures, and formatting so Sinhala and Tamil can be introduced later without rebuilding the product. Unavailable languages must not appear as selectable options in the production Settings screen.
21. **Minimum account age: confirmed:** Version 1 account creation is limited to users aged 13 and above. The sign-up experience, Terms, and Privacy Policy must communicate the minimum age consistently. Version 1 is not designed or marketed as a child-directed service for children under 13, and it will not implement parental-consent account flows. The guest experience must not intentionally collect personal information from children.
22. **Immediate delivery context: confirmed:** The immediate milestone is a school competition finale in two days, not a ceremonial or coordinated public launch. A partially completed web build has already been distributed to students for testing. Work must therefore be divided into (a) a stable, truthful, finale-ready demonstration containing only flows that can be completed and verified within the available time, and (b) the broader production scope in this report, which remains the post-finale roadmap. Features that are simulated, insecure, misleading, or untested must not be represented to judges as completed production services.
23. **Finale platform coverage and iOS fallback: confirmed:** The finale demonstration must cover web, Android, and iOS. For iOS, the team will attempt a native Capacitor build installed through Xcode or TestFlight and will also prepare the finalized iPhone Home Screen web experience as the reliable fallback. Public App Store or Google Play publication is not required for the finale. The availability of Apple hardware, Xcode, device signing, and any paid developer membership must be confirmed before the native-iOS commitment is scheduled.
24. **Apple membership and finale installation route: confirmed:** The team does not currently have a paid Apple Developer Program membership, so TestFlight distribution is not available for the finale. The native iOS attempt will use Xcode development signing with an Apple ID and direct installation on an available iPhone. The iPhone Home Screen web experience remains the fallback and must be tested independently.
25. **Physical iPhone: confirmed:** A physical iPhone is available for direct native installation and device testing from the Apple computer. The device must be connected, trusted, placed in Developer Mode when required, selected as the Xcode run destination, and tested using the same finale acceptance journeys as web and Android.
26. **Xcode availability: confirmed:** Xcode is installed and opens correctly on the Apple computer. Native iOS preparation can therefore proceed once Apple-ID development signing and device trust are confirmed.
27. **Xcode Apple ID: confirmed:** An Apple ID is already signed into Xcode under Accounts. The native finale build can use Xcode-managed development signing, subject to selecting a valid team, resolving the bundle identifier, trusting the development certificate on the iPhone when requested, and completing a physical-device launch test.
28. **Finale identity methods: confirmed:** Web, Android, and iOS must support guest access, Firebase email/password accounts, and Google sign-in. All platforms must use one canonical account and session model. Legacy locally stored passwords, custom activation tokens, duplicate authentication handlers, and forced session clearing must be removed. Provider-specific technical handling may differ by platform, but successful sign-in must resolve to the same Firebase user identity and server-backed progress record.
29. **Email verification gate: confirmed:** A newly created email/password user may enter and browse the application before verifying the email address, but may not receive authoritative XP, complete a verified visit, save permanent progress, earn achievements, or enter the public leaderboard. The interface must explain the restriction and offer a safe resend-verification action. Once Firebase confirms the email, the same account is upgraded without losing permitted browsing state. Google-authenticated accounts use the verified identity status supplied through the approved Google/Firebase flow.
30. **Account deletion: confirmed:** The user may initiate deletion inside Settings after a clear confirmation step. Initiation immediately signs the account out, prevents new activity, and hides the public leaderboard entry. A 30-day recovery period follows, during which an authenticated recovery action can cancel deletion. If it is not cancelled, the account and applicable personal data are permanently deleted or irreversibly anonymized, subject only to narrowly defined security or legal retention disclosed in the Privacy Policy. The server:not only the client device:must execute and track the deletion workflow.
31. **User data export: confirmed:** A signed-in user may request a downloadable copy of their YathraLanka account information from Settings. The export includes profile data, XP transaction history, rank, earned badges and achievements, quiz history, and verified landmark visits in a readable portable format. It contains no captured photographs because YathraLanka does not retain them. The export requires recent authentication, is generated securely, expires after a limited download period, and must not expose internal secrets, security signals, or other users' data.
32. **GPS verification radius: confirmed for the original three sites; Galle Dutch Fort pending:** BMICH, Independence Memorial Hall, and Colombo National Museum each use a 500-metre radius measured from the approved landmark coordinate. The application must calculate live geodesic distance from a fresh device reading and must not use static distance labels as verification evidence. The handling of low-accuracy readings remains subject to the confirmed GPS accuracy rule. The radius and approved verification coordinate for Galle Dutch Fort must be confirmed separately.
33. **GPS reading policy: confirmed:** The 500-metre landmark boundary is applied to any fresh location reading successfully returned by the device, regardless of the device's reported accuracy estimate. The interface may show the reported accuracy and warn when it is weak, but weak accuracy does not block evaluation and there is no staff approval bypass. If the device returns no location because permission, location services, timeout, or system error prevents it, the visit is not verified; the app must provide permission/settings guidance and a retry action. This decision accepts a higher risk of inaccurate passes or rejections and should be reconsidered for a later production release.
34. **Landmark XP allocation: confirmed; repeatability pending:** A landmark awards 100 XP for the accepted GPS visit, 70 XP for completing the guided camera step, and 50 XP for quiz completion with a score of 4/5 or 5/5. A perfect 5/5 additionally awards a 30 XP Landmark Mastery bonus and the Landmark Mastery Badge. The maximum available total is therefore 250 XP per landmark. A 4/5 result may later be improved to 5/5 under the approved retry rules to obtain only the previously unearned mastery bonus and badge; already-awarded phase XP must never be duplicated by a retry.
35. **XP repeatability: confirmed:** Each XP component is awardable only once per account per landmark. Revisiting a completed location, repeating the guided camera step, or retaking an already completed quiz does not duplicate the previously awarded XP. A user who previously completed a quiz with 4/5 may later earn only the unearned 30 XP mastery bonus and badge by achieving 5/5. Server-side idempotency must enforce these rules even if requests are repeated, delayed, or retried from multiple devices.
36. **Permanent rank thresholds: confirmed:** The canonical progression remains Novice Explorer at 0–999 XP, Pathfinder at 1,000–2,499 XP, Heritage Seeker at 2,500–4,999 XP, Cultural Guardian at 5,000–9,999 XP, and Legacy Ambassador at 10,000 XP or more. These thresholds will not be reduced for the four-site finale pilot. Users may remain Novice Explorers during the pilot; future approved landmarks and activities will extend progression without a rank migration.
37. **Starting XP: confirmed:** A newly verified account begins at 0 XP. No automatic welcome, registration, login, or profile-completion XP is awarded. Every XP transaction must correspond to a confirmed activity rule and must appear in the user's progression history and authorized reports.
38. **Pilot Achievement Medal count: confirmed; scope amended:** The five existing achievement configurations will not be used for the four-site finale because several refer to unavailable locations, districts, time windows, or conditions not implemented by the pilot. Version 1 will instead contain three clearly named Achievement Medals whose requirements can be completed and server-verified using approved launch-site activity. The two achievements explicitly named for Colombo remain tied to the three Colombo landmarks. Galle Dutch Fort provides its own landmark XP and mastery badge but is not a requirement for a Colombo-named achievement. Their visual treatment must be approved before implementation.
39. **Achievement Medal XP: confirmed:** Each of the three pilot Achievement Medals provides its confirmed one-time server-approved XP bonus in addition to the visual medal: 50 XP for Heritage First Step, 100 XP for Colombo Heritage Explorer, and 150 XP for Colombo Heritage Scholar. The backend must award each medal and bonus idempotently from authoritative activity records. Medal XP contributes to monthly and all-time leaderboards and permanent ranks and must be included in progression history and administration reports.
40. **Achievement Medal 1: confirmed:** **Heritage First Step**, Bronze. Awarded once when a user fully completes any one pilot landmark by receiving its accepted GPS check-in, completing its guided camera step, and passing its quiz with at least 4/5. The medal awards a one-time 50 XP bonus. A later 5/5 result can still earn that landmark's separate Mastery Badge and mastery bonus.
41. **Writing style: confirmed:** Do not use em dashes in user-facing interface copy, product documentation, reports, presentation text, notifications, emails, or support material. Use normal punctuation and direct, natural phrasing instead.
42. **Achievement Medal 2: confirmed:** **Colombo Heritage Explorer**, Silver. Awarded once when a user fully completes BMICH, Independence Memorial Hall, and Colombo National Museum. Each landmark requires its accepted GPS check-in, completed guided camera step, and quiz pass of at least 4/5. Galle Dutch Fort is not required because this achievement is explicitly limited to Colombo. The medal awards a one-time 100 XP bonus.
43. **Achievement Medal 3: confirmed:** **Colombo Heritage Scholar**, Gold. Awarded once when a user earns the Landmark Mastery Badge at BMICH, Independence Memorial Hall, and Colombo National Museum by achieving a perfect 5/5 result in each site's production quiz. Galle Dutch Fort is not required because this achievement is explicitly limited to Colombo. The medal awards a one-time 150 XP bonus.
44. **Maximum pilot progression: amended by the approved four-site rules:** A user can earn up to 1,000 XP from the four fully completed and mastered landmarks and up to 300 XP from the three one-time Achievement Medals, for a total of 1,300 XP. This allows a fully engaged pilot user to enter the Pathfinder rank without changing the permanent rank thresholds.
45. **Historical content approver: confirmed:** The project owner has final approval authority for pilot landmark descriptions, coordinates, quiz questions, correct answers, and other historical or visitor-facing claims. Every production content item must have an identifiable source and review status. Material changes to factual content must be presented to the project owner for approval before inclusion in the finale build.
46. **Factual research process: amended and confirmed:** The assistant will research the four pilot landmarks using authoritative sources, distinguish between dates such as construction, completion, opening, and commemoration, prepare corrected descriptions and 50-question banks, and provide a source-backed review sheet to the project owner. Nothing becomes approved production content until the project owner accepts the review sheet.
47. **Known Independence Memorial Hall quiz defect: correction required:** The current question asks for the year the hall was constructed but marks 1948 as correct. The project owner has identified 1953 as the construction year. The factual review must verify this against authoritative sources, rewrite the question so the historical event and date are unambiguous, and set the approved answer before implementation. The app's current one-question Independence Memorial Hall bank is not approved for the finale.
48. **Quiz difficulty composition: amended and confirmed:** Every production attempt selects five questions without repetition from the site's approved 50-question bank using a fixed composition of two easy, two medium, and one difficult question. Every bank item must carry an approved difficulty label. Questions and answer choices may be randomized within the attempt, while the balanced composition remains constant so attempts are reasonably comparable.
49. **Per-question learning feedback: confirmed:** Submitting an answer or reaching the 30-second limit stops that question's timer. The interface states whether the response was correct, identifies the correct answer, and shows a concise source-approved factual explanation. The next timer starts only when the user selects **Next Question**. Feedback must not change the recorded answer, and the administration report must distinguish answered, unanswered, correct, and incorrect outcomes.
50. **Mastery retries and attempt window: confirmed:** A 4/5 result completes the quiz and awards the one-time 50 XP completion reward, but the user may continue attempting the production quiz to earn 5/5 mastery. No more than three production attempts may be made within one active attempt window. Any result below 5/5 counts toward this limit. If the third attempt still does not achieve 5/5, only that landmark's production quiz enters a 30-minute cooldown. After cooldown, the user may try for the previously unearned mastery badge and 30 XP bonus. Completion XP can never be awarded again. Once mastery is earned, later attempts are practice only.
51. **Question repetition across attempts: confirmed:** Within one three-attempt window, the selection engine avoids reusing a question previously shown to that user whenever the approved difficulty distribution makes this possible. Every attempt must still contain two easy, two medium, and one difficult question. The recent-question selection history resets after the 30-minute cooldown. Answer positions are shuffled independently for every attempt.
52. **Administration report formats: confirmed:** Authorized staff receive an on-screen reporting dashboard, filtered CSV exports for detailed analysis, and presentation-ready PDF summaries. The system must apply role permissions to both visible data and exported fields, record who generated each export and when, prevent public report URLs, and ensure generated downloads expire after a defined limited period. Reports must not include captured photographs, passwords, tokens, or unrelated private data.
53. **Administration portal location: confirmed:** The reporting portal will be a protected `/admin` area inside the same YathraLanka web project. It must not appear in ordinary user navigation or search indexing. Hiding the route is not a security control; every page load, query, action, and export must enforce the user's server-issued staff role. Unauthorized users must receive no administrative data even if they know the address.
54. **Administration role assignment: confirmed:** Owner, Administrator, Analyst, and Support permissions must be assigned by a trusted Firebase administrative process and enforced through server-verifiable role claims and backend security rules. Ordinary client code cannot create, change, or grant staff roles. Shared administration passwords and reusable invitation codes are prohibited. Role changes and revocations must be audit-logged.
55. **Canonical web address: confirmed:** `https://yathralanka.lk` is the official finale, authentication, demonstration, QR, and public-link origin. Vercel may host the deployment behind this domain. The `www` hostname and temporary Vercel deployment addresses should redirect to the canonical HTTPS origin where technically appropriate. Firebase authorized domains, Google authentication origins and redirects, web links, and QR destinations must use the canonical domain consistently.
56. **Finale QR routing: confirmed:** The QR code points to a stable device-aware page on `https://yathralanka.lk`. Android visitors are offered explicit **Open Web App** and **Download Android App** actions. iPhone visitors enter the web app and receive concise Safari Add to Home Screen guidance, because the native development build cannot be publicly distributed without the appropriate Apple program. Desktop visitors enter the responsive web experience. Downloads and redirects must not begin without a clear user choice, and the page must provide a direct web fallback.
57. **Android signing-key inspection: no project key found:** The project currently contains no `.jks` or `.keystore` file, no key properties file, and no configured release signing block. A signing key might exist elsewhere outside the repository, but the project itself provides no evidence of one. No key will be created, replaced, or committed until the project owner approves the signing plan. Signing files and passwords must never be committed to GitHub.
58. **Android signing plan: confirmed:** The implementation phase will create a new permanent YathraLanka Android release keystore for `com.yathralanka.app`. The keystore and credential record must remain outside the Git repository and generated web assets. The project owner must receive a tested backup and recovery procedure. Release builds must read signing values from protected local or deployment configuration, and the repository must explicitly ignore signing files and secret properties.
59. **Primary navigation: confirmed:** Mobile uses five primary destinations in this order: **Home**, **Explore**, **Activism**, **Achievements**, and **Profile**. Explore provides direct access to the pilot landmark directory and map. Desktop exposes the same information architecture using a navigation treatment appropriate to the available width rather than reproducing a phone-only bottom bar. Labels, active states, back behavior, deep links, and accessibility names must remain consistent across web, Android, and iOS.
60. **Offline boundary: confirmed:** Previously loaded landmark information and general application screens may remain readable during temporary connectivity loss. Guest practice may operate locally without creating authoritative results. Account authentication, production quiz creation and submission, verified visit completion, guided camera-step XP, XP transactions, achievements, leaderboard changes, and permanent synchronization require a successful server connection. The interface must label offline state clearly and must not show an unconfirmed activity as final.
61. **Push notifications: excluded from the finale:** The finale build will not request push-notification permission. Quiz cooldown status, verification outcomes, XP awards, achievements, connection problems, and recovery guidance will be communicated through accessible in-app messages. Push notifications may be reconsidered after the finale when there is a sustained user benefit and a complete consent strategy.
62. **Existing student data: preserve:** Accounts and activity created by students while testing the unfinished application will not be reset before the finale. Existing XP, quiz attempts, verified visits, achievements, and leaderboard records will continue where technically available. Migration into the new authoritative data model must preserve legitimate records without treating malformed, duplicated, simulated, or unverifiable client-only values as newly confirmed server events. Any unavoidable exclusion or correction must be documented for the project owner.
63. **Official timezone: confirmed:** Monthly leaderboard boundaries, report periods, cooldown displays, event dates, and user-facing activity timestamps use Sri Lanka Standard Time through the `Asia/Colombo` timezone. Server records should retain an unambiguous UTC timestamp and convert it to Asia/Colombo for business rules and display. Device timezone changes must not alter monthly ranking or cooldown calculations.
64. **Public profile moderation: confirmed:** Public leaderboard profile names and approved profile images are subject to automated safety checks, user reporting, and authorized staff moderation. Clearly prohibited content should be blocked where reliable detection is available. Users may report an inappropriate public profile, and authorized administrators may review, hide, correct, or suspend its public visibility according to a documented moderation policy. Moderation must not expose account email addresses or other private data to ordinary users, and every staff moderation action must be audit-logged.
65. **Leaderboard refresh: confirmed:** Monthly and All Time leaderboard positions update immediately after the server confirms an authoritative XP transaction, mastery award, achievement award, reversal, or approved correction. The client may refresh the visible ranking automatically or when the user requests it, but it must never calculate or publish an authoritative position from unconfirmed local state. Loading and synchronization states must be communicated clearly.
66. **Suspicious leaderboard activity: confirmed:** When suspicious XP or ranking activity is detected, the affected score is temporarily excluded from public rankings while the underlying records and security evidence are preserved for authorized review. Administrators are notified and may restore, correct, or reverse the score after review. The user must not be automatically deleted solely because an automated signal was raised. Review decisions and resulting progression changes must be audit-logged.
67. **Galle Dutch Fort launch inclusion and verification images: confirmed:** Galle Dutch Fort is part of the full four-site launch rather than a deferred location. Its content, GPS behavior, quiz, guided camera step, accessibility, and acceptance testing must meet the same production requirements as the other launch sites. During implementation, the assistant must ask the project owner for three approved Galle Dutch Fort verification images before configuring its camera options; existing or substitute images must not be assumed to be approved.
68. **Launch-site quiz bank size: amended and confirmed:** Each of the four launch landmarks requires an editorially approved bank of 50 questions. Production attempts continue to contain five questions with the approved difficulty composition, timing, feedback, retry, cooldown, and mastery rules. Expanding the bank does not increase the number of questions shown in one attempt.
69. **Galle Dutch Fort GPS radius: confirmed:** Galle Dutch Fort uses the same 500-metre verification radius as the other three launch landmarks, measured from its approved coordinate. The application must apply the shared fresh-reading and geodesic-distance rules consistently across all four locations.
70. **Colombo achievement names retained: confirmed:** The Silver and Gold achievements remain **Colombo Heritage Explorer** and **Colombo Heritage Scholar**. Their requirements therefore remain limited to BMICH, Independence Memorial Hall, and Colombo National Museum. Galle Dutch Fort awards its normal landmark completion XP, mastery bonus, and Landmark Mastery Badge but is not required for these Colombo-specific medals.

71. **Galle Dutch Fort coordinate process: amended and confirmed:** The verification centre is 6.0279875, 80.2175781 (Plus Code `26H9+52W`, Galle 80000), supplied and approved by the project owner. It uses the shared 500-metre radius. The field-test result, test-device accuracy, date, and project-owner approval must still be recorded before wider production approval.
72. **Fifty-question difficulty distribution: confirmed:** Each approved landmark bank contains 20 easy, 20 medium, and 10 difficult questions. Production attempts still select two easy, two medium, and one difficult question without repetition where the recent-question rules permit. Every difficulty assignment is part of the source-backed editorial review.
73. **Administration report expiry: confirmed:** Generated CSV and PDF report downloads expire 24 hours after creation. Access requires the authorized staff session and applicable role throughout that period. Expiry removes access to the generated download without deleting the governed source records, and report generation and download actions remain audit-logged.
74. **Deleted-account leaderboard treatment: confirmed:** Initiating account deletion immediately removes the user's public profile and leaderboard entry. During the approved recovery period, the entry remains hidden. After final deletion, only permitted irreversibly anonymized aggregate statistics may remain; the profile name, image, email, position, and identifiable score history must not remain publicly visible.
75. **Leaderboard display size: confirmed:** Each Monthly and All Time leaderboard view shows the top 20 eligible public participants. The application must not load or expose the complete participant list as one public page. A separate decision governs whether users outside the top 20 can see their own private position.
76. **Leaderboard profile search: confirmed:** Users may search eligible public leaderboard entries by exact or partial profile display name. Search results expose only the public leaderboard fields already approved. Hidden, deleted, suspended, and moderation-restricted profiles must not appear. Queries must be rate-limited and protected against bulk extraction.
77. **Public profile pictures: confirmed:** Signed-in users may upload a custom public profile picture. Images require safety screening, user reporting, authorized moderation, secure storage, size and format restrictions, and removal when the account is deleted. A safe default avatar must be shown while an image is pending, rejected, missing, or removed.
78. **Staff multi-factor authentication: owner decision recorded with production risk:** Multi-factor authentication remains optional for staff accounts. This is below the recommended security baseline for a portal containing identifiable user activity and exports. The finale implementation may proceed with strong authentication, recent reauthentication for sensitive operations, least-privilege roles, session controls, and audit logging, but this decision remains a security-review item before wider production use.
79. **Moderation and score appeals: confirmed:** A signed-in user can submit an in-app review request concerning a profile moderation action or corrected or excluded score. The request must identify the affected decision without exposing internal security signals. Authorized staff record the review outcome and notify the user in the application. Requests, staff access, evidence changes, and final decisions are audit-logged.
80. **Private position outside the top 20: confirmed:** A signed-in participant who is not publicly listed in the top 20 may privately view their own authoritative position and a limited set of nearby eligible ranks. Nearby entries expose only the approved public leaderboard fields. Hidden users do not occupy or reveal public positions, and the endpoint must prevent bulk enumeration.
81. **Public identity structure: confirmed:** Each account has a unique public username and a separate changeable profile display name. Authentication and authorization continue to use the private immutable account identifier rather than either public label. Username creation, normalization, reserved words, impersonation prevention, change limits, moderation, and account-deletion handling must be enforced by trusted services.
82. **Profile-picture visibility: confirmed:** Approved profile pictures are visible only within YathraLanka surfaces where the user's public profile or leaderboard identity is shown. They must not be intentionally exposed for search-engine indexing or through publicly enumerable storage addresses. Access, caching, replacement, moderation, and deletion must follow the approved privacy rules.
83. **Administration audit-log retention: confirmed:** Administrative audit logs are retained for 12 months, then deleted or irreversibly anonymized according to the approved retention procedure. Audit records include applicable staff sign-ins, sensitive record views, searches, exports, role changes, moderation actions, score corrections, and appeal outcomes without recording passwords, tokens, or unnecessary sensitive content.
84. **Product analytics consent: confirmed:** YathraLanka collects only essential operational, security, progression, and reliability records required to provide and protect the approved service. Optional product-usage analytics must be clearly disclosed and provide an accessible opt-out. Opting out must not prevent core use, authoritative progression, security logging, or records legally or operationally required to provide the service.
85. **Minimum Android support: confirmed:** The supported native Android baseline is Android 10 or later. The build, permissions, authentication, camera, location, rotation, background and resume behavior, accessibility, and performance acceptance matrix must include representative Android 10 hardware as well as a current Android release.
86. **Minimum iOS support: confirmed:** The supported native iPhone baseline is iOS 16 or later. The implementation must use APIs and dependencies compatible with that baseline and test representative iOS 16 and current-iOS behavior, including Safari and Home Screen web fallback behavior.
87. **Supported web browsers: confirmed:** The responsive web application supports the current and immediately previous major versions of Chrome, Edge, Firefox, and Safari. Critical journeys must be tested against this matrix. Unsupported-browser messaging must remain truthful and provide a usable recovery path where a required camera, location, or authentication capability is unavailable.
88. **Accessibility target: confirmed:** The responsive web experience targets WCAG 2.2 Level AA, with equivalent accessible behavior in the Android and iOS wrappers. Acceptance includes keyboard operation, screen-reader labels and announcements, visible focus, sufficient contrast, text scaling, reduced motion, touch-target sizing, orientation, error identification, and accessible authentication, quiz, camera, map, leaderboard, reporting, and account-management journeys.
89. **User-support channel: confirmed:** Version 1 provides an in-app Help Centre plus a monitored support email address. Help content must cover accounts, verification email, Google sign-in, permissions, location, camera, quizzes, cooldowns, XP, achievements, leaderboard privacy, data export, deletion, appeals, and troubleshooting. The final support address, responsible owner, response process, and escalation route must be approved before public production use.
90. **Support address: confirmed:** The official user-support address is `support@yathralanka.lk`. The domain mailbox must be created, secured, monitored by an identified responsible person, and tested for sending and receiving before it is published in the application, policies, or store information.
91. **Automated email identity: confirmed:** Automated account and service messages use `no-reply@yathralanka.lk` as the sender identity where the approved email service supports it, with `support@yathralanka.lk` supplied as the appropriate help or reply contact. Domain authentication, sender verification, deliverability, anti-spoofing configuration, and message templates must be completed before production use.
92. **Policy approval: confirmed:** The project owner approves the finale Privacy Policy and Terms after verifying that they accurately describe the implemented behavior. Qualified legal review is required before a wider public production release. Automatically generated or copied policy text cannot be published without responsible human review.
93. **Production backups: confirmed:** Supported server data receives protected daily backups retained for 30 days. Backup access follows least privilege, restoration procedures must be documented and tested, and backup retention and deletion must remain consistent with account deletion and applicable privacy obligations. Transient verification photographs remain excluded because they are never stored.
94. **Serious failure response: confirmed:** When a serious production defect affects security, privacy, progression integrity, authentication, or critical journeys, the affected feature is disabled or isolated, relevant evidence is preserved securely, and the application is restored to the last verified stable version where appropriate. The incident, response, correction, validation, and release decision must be recorded.
95. **Environment separation: confirmed:** Development, staging, and production use separate configurations, data boundaries, credentials, authentication settings, domains, and deployment controls. Development or staging data must not be represented as production activity, and production secrets must not be exposed to non-production clients.
96. **Automatic GitHub deployment: confirmed:** Deployment is automated from the approved GitHub workflow. Feature branches create isolated preview deployments, the designated staging branch updates staging after required checks pass, and the protected production branch updates production after its required checks pass. Manual project-owner approval is not required for each deployment, so branch protection, automated tests, restricted merge permissions, monitoring, and rollback capability are mandatory safeguards.
97. **Visible historical sourcing: confirmed:** Every launch landmark provides a user-accessible Sources section, and quiz learning explanations provide or link to the relevant approved source information. Source presentation must remain readable and concise while internal editorial records retain the full citation, access date, claim mapping, and approval status.
98. **Galle landmark name: confirmed:** The primary visitor-facing label is **Galle Dutch Fort**. Its description also gives the relevant formal heritage name and historical context so the accessible title remains familiar without losing accuracy.
99. **Phase 1 approval gate: confirmed:** Implementation does not begin until the consolidated four-site production scope has been reviewed and explicitly approved by the project owner. Approval locks the baseline for the next phase. Later changes must be recorded as controlled scope changes with their impact on content, design, engineering, privacy, testing, and schedule.
## 10. Recommended delivery sequence

1. **Scope lock:** approve the Version 1 inclusion/defer list and the twelve product decisions above.
2. **Requirements baseline:** convert every included feature into user journeys, business rules, data requirements, and acceptance criteria.
3. **Information architecture:** finalize navigation, terminology, screens, and guest/account boundaries.
4. **Technical foundation:** modularize the app, remove duplicate/legacy systems, separate environments, and establish backend security.
5. **Design system:** produce tokens, components, layouts, accessibility patterns, and responsive behavior; then apply them systematically.
6. **Core journeys:** identity, directory, site detail, GPS, guided photo, quiz, XP, rank, profile, and settings.
7. **Content production:** field-verify launch sites and complete editorial review in parallel with implementation.
8. **Quality system:** automated tests, device matrix, analytics, monitoring, privacy/security review, and performance budgets.
9. **Native completion:** Android and iOS configuration, permissions, authentication, deep links, signing, and store assets.
10. **Controlled release:** staging, Android internal/closed testing, iOS TestFlight, pilot field test, corrections, then public release.
11. **QR rollout:** publish the stable domain destination and print QR codes only after store URLs and app links are permanent.

## 11. Immediate next step

The 99 clarification decisions now form the consolidated Phase 1 production-scope baseline. In accordance with Decision 99, implementation must not begin until the project owner explicitly approves this report.

After approval, proceed to **Phase 2: requirements baseline and implementation planning**. Convert each included capability into prioritized user journeys, data contracts, backend rules, interface states, acceptance criteria, dependencies, and test cases. Separate the two-day finale-critical path from the broader post-finale production roadmap, then implement through the confirmed development, staging, and production environments.

## Sources

[^1]: Capacitor, “Cross-platform apps with web technology,” official documentation: https://capacitorjs.com/docs
[^2]: Apple, “App Review Guidelines,” including app completeness, privacy, account deletion, and login services: https://developer.apple.com/app-store/review/guidelines/
[^3]: Apple, “Human Interface Guidelines: Layout”: https://developer.apple.com/design/human-interface-guidelines/layout
[^4]: Apple, “Human Interface Guidelines: Accessibility”: https://developer.apple.com/design/human-interface-guidelines/accessibility
[^5]: Android Developers, “About App Links” and verified associations: https://developer.android.com/training/app-links/about
[^6]: Apple, “Supporting Associated Domains” and Universal Links: https://developer.apple.com/documentation/xcode/supporting-associated-domains
[^7]: Google Play Console Help, “Set up an open, closed, or internal test”: https://support.google.com/googleplay/android-developer/answer/9845334
[^8]: Google Play Console Help, “App testing requirements for new personal developer accounts”: https://support.google.com/googleplay/android-developer/answer/14151465
[^9]: Apple Developer, “Submitting to the App Store” and TestFlight: https://developer.apple.com/app-store/submitting/

### Repository evidence reviewed

- `package.json`, `vite.config.js`, `vercel.json`, and `capacitor.config.json`.
- `src_web/app.js`, `src_web/data.js`, `src_web/style.css`, and `src_web/firebase-init.js`.
- Android manifest and Gradle configuration under `android/`.
- iOS property-list and Capacitor configuration under `ios/`.
- Existing architecture, requirements, and walkthrough documents, treated as historical evidence rather than current acceptance proof.
