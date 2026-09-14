# YathraLanka Phase 2 Requirements Baseline and Implementation Plan

**Status:** Phase 2 approved; Step 2.1 baseline consolidation in progress  
**Date:** 14 September 2026  
**Authority:** The approved Phase 1 Feature Audit and Production Scope  
**Product:** One shared responsive web, Android, and iOS application

## 1. Phase 2 objective

Phase 2 converts the approved product scope into requirements that can be implemented, tested, and demonstrated without ambiguity. It separates the immediate finale build from the larger production programme while keeping both on one architecture.

The immediate objective is a stable and truthful public experience that keeps every existing landmark visible. Colombo and Galle are the primary public-release areas, while other landmarks remain available and require an on-site visit for verification. A control must either perform its approved function or clearly explain why its final action is unavailable. Simulated security, image recognition, payment, leaderboard, and cryptographic claims are not acceptable substitutes for working services.

## 2. Approved product boundary

### Priority production locations

1. BMICH
2. Independence Memorial Hall
3. National Museum, Colombo
4. Galle Dutch Fort

All existing landmarks remain visible. Each location uses its original coordinate, a 500-metre verification radius, and one guided-camera verification option. The four priority locations require an approved description, a 50-question source-backed quiz bank, visitor information, Sources section, accessibility review, and field acceptance record.

The Galle Dutch Fort verification centre is project-owner approved at **6.0279875, 80.2175781** (Plus Code `26H9+52W`, Galle 80000). It retains the standard 500-metre radius. The project owner will provide its camera-reference image when implementation reaches that task.

### Included capabilities

- Guest browsing and practice quizzes
- Firebase email/password and Google authentication
- Email verification restrictions for authoritative progress
- Five-destination navigation: Home, Explore, Activism, Achievements, Profile
- Landmark directory, details, search, map, and external directions
- Fresh GPS distance verification within 500 metres
- Guided camera step with smooth overlay zoom and transient in-memory images
- Five-question attempts drawn from 50-question banks
- Thirty seconds per question, immediate learning feedback, retry rules, and cooldown
- Server-authoritative XP, ranks, mastery badges, and three Achievement Medals
- Monthly and All Time leaderboard
- Profile, privacy controls, help, export, deletion, moderation, and appeals
- Approved external heritage activities only
- Protected `/admin` reporting area
- Responsive web plus Android 10+ and iOS 16+ wrappers
- Device-aware QR destination at `https://yathralanka.lk`

### Excluded capabilities

- Automated landmark-image match percentages
- Retention of captured verification photographs
- Client-authoritative XP or ranking
- Completion of in-app donations and petitions until their operational services are connected
- Publication of user-created events until moderation is connected
- Completion of commercial rewards and redemptions until partner services are connected
- Cryptographic or immutable-ledger claims
- Push notifications for the finale
- Sinhala and Tamil interface selection until their content is complete

## 3. Current implementation gap summary

Repository inspection identifies these immediate mismatches with the approved scope:

| ID | Current evidence | Required outcome | Priority |
|---|---|---|---|
| GAP-01 | `src_web/app.js` combines routing, views, state, authentication, GPS, camera, quiz, XP, and event binding in one very large file | Separate stable modules with one implementation per journey | P0 |
| GAP-02 | Duplicate renderer names and legacy flows remain | Retain one canonical renderer and route per screen | P0 |
| GAP-03 | XP has client-side award paths and a minimum of 50 XP in profile synchronization | New accounts start at 0 XP; only trusted services award progress | P0 |
| GAP-04 | Welcome email advertises a 50 XP bonus | Remove the bonus from logic and email content | P0 |
| GAP-05 | Quiz attempts and cooldowns use local storage, including a global cooldown path | Use server-authoritative per-landmark attempts and cooldowns | P0 |
| GAP-06 | Static sample leaderboard data remains | Replace with authoritative top-20 and private-nearby queries | P0 |
| GAP-07 | Existing content contains one-question and 20-question banks | Produce 50 approved questions for each of four locations | P0 content |
| GAP-08 | Camera flows still contain match and specimen language | Use a guided completion step with no recognition claim or retained frame | P0 |
| GAP-09 | Historic architecture material describes vision AI, demo overrides, and an immutable ledger | Replace it with the approved truthful architecture | P0 documentation |
| GAP-10 | Firebase is initialized in the client but no complete trusted progression service is evidenced | Add authenticated server operations and restrictive data rules | P0 |
| GAP-11 | Community and commercial prototype features remain visible | Limit Activism to approved external listings and remove commercial rewards | P1 |
| GAP-12 | No complete automated acceptance suite is defined | Add unit, integration, browser, security-rule, and device test coverage | P0 |

## 4. Authoritative business rules

### Progression

- New accounts start at 0 XP.
- Each landmark awards 100 XP for an accepted GPS visit, 70 XP for the guided camera step, and 50 XP for quiz completion.
- A perfect quiz result awards a separate 30 XP mastery bonus and Landmark Mastery Badge.
- Each component is awardable only once per account per landmark.
- The maximum landmark total is 250 XP.
- The four-landmark maximum is 1,000 XP.
- Achievement bonuses total 300 XP, making the complete pilot maximum 1,300 XP.
- Permanent ranks remain Novice Explorer 0 to 999, Pathfinder 1,000 to 2,499, Heritage Seeker 2,500 to 4,999, Cultural Guardian 5,000 to 9,999, and Legacy Ambassador 10,000 or more.

### Quiz

- Every location has 50 approved questions: 20 easy, 20 medium, and 10 difficult.
- An attempt presents two easy, two medium, and one difficult question.
- Questions do not repeat within an attempt and should not repeat within one three-attempt window when the distribution permits.
- Each question has four choices, one correct answer, and 30 seconds.
- A timeout records the question as unanswered and incorrect.
- Feedback identifies the correct answer and gives a concise approved explanation.
- A score of 4/5 completes the quiz and awards the one-time 50 XP.
- A score of 5/5 also awards the one-time 30 XP mastery bonus and badge.
- Three attempts are permitted in one window. A failed mastery attempt on the third try creates a 30-minute cooldown for that landmark only.
- Rotation and temporary interruption preserve the attempt while trusted elapsed time continues.
- Guest attempts are practice only and award no permanent progress.

### Verification privacy

- A fresh device location reading is evaluated against the approved coordinate and 500-metre radius.
- The reported accuracy may be shown but does not prevent evaluation under the approved owner decision.
- A captured camera frame exists only in memory for the minimum necessary time.
- The frame is never uploaded, stored, cached, logged, exported, or placed in the gallery.
- No automated match percentage or image-recognition claim is shown.

## 5. Prioritized user journeys

### J01: Guest entry and exploration, P0

The visitor can continue as a guest, browse every existing landmark, search, view maps and sources, rotate the device, and take clearly labelled practice quizzes. Protected actions explain their requirements without losing the current context.

**Acceptance:** No guest action creates permanent XP, a verified visit, an achievement, or a leaderboard record.

### J02: Email account creation and verification, P0

The user creates an account, receives a branded verification email, can resend it safely, and may browse before verification. Progress-awarding actions remain locked until Firebase confirms the address.

**Acceptance:** The account starts at 0 XP. The email contains no welcome bonus. Full-mailbox and delivery failures provide understandable recovery guidance.

### J03: Google authentication, P0

Web, Android, and iOS use approved Firebase Google authentication behavior and resolve to one canonical account. Redirect or popup recovery must not produce a login loop.

**Acceptance:** A successful provider response creates or restores exactly one account and returns to the intended screen. Cancelled, blocked, unauthorized-domain, offline, and account-conflict paths are recoverable.

### J04: Explore and landmark information, P0

The user can search and open every existing landmark, read available facts and visitor information, view sources, open directions, and understand which steps are available.

**Acceptance:** Deferred locations and incomplete actions are not presented as available production experiences.

### J05: GPS visit verification, P0

An authenticated and email-verified user requests location access, receives current distance and accuracy information, and can complete the visit within 500 metres.

**Acceptance:** Denial, disabled services, timeout, offline state, and out-of-range state give clear guidance and retry. XP is confirmed by the server once only.

### J06: Guided camera step, P0

After GPS acceptance, the user opens the single image-verification option for that landmark and smoothly zooms the guide overlay to align the visible landmark. Only the framed camera area participates in the guidance experience.

**Acceptance:** Zoom is continuous and responsive. Rotation preserves layout. Completion discards the frame and records only permitted metadata. No match score is calculated or shown.

### J07: Production quiz, P0

The user reviews the point-form notice, starts an attempt, answers five balanced questions, receives learning feedback, and reaches completion, mastery, retry, or cooldown outcomes.

**Acceptance:** There is one timer and one Next Question handler. The third-question freeze cannot recur. Refresh, rotation, backgrounding, timeout, and cooldown follow the approved rules.

### J08: XP, ranks, and achievements, P0

The user sees confirmed XP transactions, current rank, progress to the next rank, mastery badges, and the three medals without duplicate or conflicting terminology.

**Acceptance:** Every award is traceable, idempotent, server-confirmed, and consistent across Home, Achievements, Profile, reports, and leaderboard.

### J09: Leaderboard, P1

The signed-in user views Monthly or All Time top 20 results, searches eligible profiles, sees their private nearby position, and can hide their own entry.

**Acceptance:** Only approved public fields appear. Suspicious scores, deletion, moderation, ties, and appeals follow the confirmed rules. Email addresses never appear publicly.

### J10: Profile and account controls, P1

The user manages username, display name, custom profile image, leaderboard visibility, analytics choice, data export, support, and account deletion.

**Acceptance:** Deletion immediately hides public identity and begins the 30-day recovery period. Generated user exports are private and expire.

### J11: Activism, P1

The user views only approved heritage events, volunteer opportunities, and educational campaigns and follows clearly disclosed external links.

**Acceptance:** No local action falsely records a donation, petition signature, registration, or participation claim.

### J12: Administration and reporting, P1

Authorized staff access `/admin` according to Owner, Administrator, Analyst, or Support permissions. They filter activity, review issues, and generate CSV or PDF reports.

**Acceptance:** Server authorization protects every request. Reports contain no captured photographs or secrets. Downloads expire after 24 hours, event records follow 24-month retention, and audit logs follow 12-month retention.

## 6. Required trusted data domains

The final names may change during schema design, but the responsibilities must remain separate:

| Domain | Purpose | Client authority |
|---|---|---|
| Accounts | Private account state, verification, deletion lifecycle | Read and request approved changes only |
| Public profiles | Username, display name, approved image, visibility and moderation state | Submit changes; server validates |
| Landmark content | Approved facts, sources, coordinates, camera references and publication state | Read only |
| Quiz content | Approved questions, choices, answers, explanations, sources and difficulty | Never expose bulk answers through ordinary client queries |
| Quiz attempts | Server start time, selected questions, answers, expiry, result and cooldown | Submit answers through validated operations |
| Visit events | GPS decision and permitted metadata | Request verification; cannot self-award |
| Camera-step events | Completion metadata without image data | Request completion after valid flow |
| XP transactions | Immutable business transaction history and idempotency key | Read own history only |
| Achievements | Server-evaluated badge and medal awards | Read own awards only |
| Leaderboards | Derived Monthly and All Time rankings | Read approved public result sets only |
| Appeals | User request, restricted evidence, status and outcome | Create and read own requests |
| Administration | Roles, reports, exports and audit records | Server-authorized staff only |

## 7. Non-functional acceptance baseline

- WCAG 2.2 AA target across critical journeys
- Current and previous major Chrome, Edge, Firefox, and Safari versions
- Android 10 or later and iOS 16 or later
- Portrait and landscape support without reset or duplicated navigation
- No horizontal overflow at supported widths
- No secret, password, token, precise location, or quiz answer leakage
- Clear loading, empty, offline, denied, failed, retry, and success states
- Development, staging, and production separation
- Automatic GitHub deployments only through protected branches and required checks
- Daily protected backups retained for 30 days
- Error monitoring, privacy-aware analytics, and rollback readiness
- User-facing text contains no em dashes

## 8. Implementation sequence

### Step 2.1: Stabilize the truthful baseline

1. Create a protected working branch and record the current deployable baseline.
2. Remove the 50 XP account minimum and welcome-bonus message.
3. Remove or hide simulated image scores, ledger claims, donations, petitions, commercial rewards, and developer test controls from production paths.
4. Keep every existing landmark visible and preserve its original stored coordinate.
5. Establish one source of truth for routes, navigation labels, XP rules, ranks, and quiz rules.
6. Preserve legitimate existing student records while preventing unverified local values from becoming new authoritative awards.

#### Step 2.1 implementation record, 14 September 2026

Completed in the current Phase 2 working branch:

- Removed the hidden 50 XP recalculation floor. New account records begin at 0 XP and no longer create a welcome-bonus activity entry.
- Removed the second startup state reset and the weaker duplicate active-user repository that could split session state.
- Retained one authoritative landmark-opening handler and corrected its compatibility alias.
- Quarantined the inactive legacy camera and immersion-timer implementations so production uses only the current handlers; the build now removes those dead paths.
- Replaced the active image-score result with a guided-camera completion step. The live frame is used only while the guide is open, no match percentage is shown, and no captured frame is retained by that flow.
- Derived rank definitions from the shared ranking scale instead of maintaining a second threshold list.
- Centralized the active XP, quiz, geofence, GPS accuracy, GPS freshness, visit-duration, return-window, photo-threshold, and primary-navigation values.
- Confirmed that the production build compiles after the consolidation.

Still required before Step 2.1 can be marked complete:

- Delete the quarantined legacy source blocks and continue consolidating the remaining authentication and renderer prototypes during modular extraction.
- Hide or remove prototype donation, petition, commercial reward, sample leaderboard, and ledger claims from production routes.
- Verify the remote account email template contains no 50 XP or welcome-bonus wording.
- Add focused automated and device checks for guest isolation, authentication return, directory routing, GPS states, camera cleanup, quizzes, achievements, and rotation.

### Step 2.2: Modular foundation

Split the application into application shell, router, reusable UI components, authentication service, landmark repository, location service, camera guide, quiz engine, progression service, leaderboard service, profile service, administration service, and analytics service. Remove duplicate renderers and duplicate event handlers as each journey migrates.

### Step 2.3: Trusted backend

Design and deploy restrictive Firebase rules and trusted server operations for quiz attempts, visits, camera completion, XP, achievements, leaderboard derivation, moderation, exports, and deletion. Create development, staging, and production separation before accepting real production records.

### Step 2.4: Four-location content

Prepare source-backed review sheets and 50-question banks for the four priority sites. Correct Independence Memorial Hall date wording. Use the approved Galle Dutch Fort verification centre at 6.0279875, 80.2175781 and complete its field acceptance record. Request its camera image from the project owner at this step.

### Step 2.5: Core journey completion

Complete authentication, Explore, GPS, camera guidance, quiz, progression, Achievements, Profile, Help, and offline boundaries in that order. Validate every journey on responsive web before synchronizing Android and iOS wrappers.

### Step 2.6: Leaderboard and administration

Replace sample leaderboard data, add moderation and appeals, and build role-protected reporting with expiring exports and auditing.

### Step 2.7: Production design system

Apply one approved visual system after the information architecture and reusable components are stable. Define typography, spacing, colour, elevation, motion, icons, responsive layouts, safe areas, states, and accessibility patterns. Do not redesign each screen independently.

### Step 2.8: Verification and release

Run automated checks, field tests, supported-browser tests, Android device tests, iPhone tests, security review, privacy review, content approval, staging verification, backup restoration test, and rollback rehearsal. Automatic production deployment occurs only from the protected production branch after required checks pass.

## 9. Finale-critical path

The following order protects the demonstration first:

1. Remove misleading and obsolete production claims.
2. Fix account starting XP and verification email content.
3. Confirm all directory locations and their original coordinates, with field priority in Colombo and Galle.
4. Fix the single quiz engine and BMICH third-question failure.
5. Complete transient camera behavior and smooth guide zoom.
6. Make XP, rank, and achievement language consistent.
7. Remove duplicate navigation and layout defects.
8. Validate guest, email, and Google sign-in journeys.
9. Build and test responsive web and Android.
10. Test the iPhone web fallback and attempt direct Xcode installation.
11. Verify the canonical domain and QR destination.

The full production backend, administration portal, complete 200-question editorial programme, and mature moderation operations may require work beyond the finale. Any unfinished capability must be described honestly during judging.

## 10. Phase 2 completion evidence

Phase 2 is complete when:

- Every approved capability has a journey ID, requirement, data owner, failure states, and measurable acceptance criteria.
- The finale-critical subset is clearly separated from post-finale production work.
- Dependencies and production risks are documented.
- The project owner accepts the implementation sequence.
- Step 2.1 can begin without another product-scope decision.

## 11. Next action

Begin Step 2.1 with a read-only baseline inventory and change map. Identify every production path that awards XP, controls quiz attempts, presents simulated claims, exposes deferred features, or duplicates routing and rendering. Then implement the smallest safe stabilization patch and verify the web build before synchronizing native projects.

## 12. Step 2.1 implementation record

Work began on branch `codex/phase-2-truthful-baseline` from baseline commit `9b6792a`.

Completed in the first stabilization patch:

- New accounts now begin at 0 XP. Existing numeric XP is preserved.
- Welcome reward prompts are disabled and replaced with neutral account-ready guidance.
- Camera screens no longer show invented recognition percentages, match-confidence claims, cryptographic hashes, or ledger controls.
- Guided camera capture now requires a live frame and evaluates the approved 500-metre GPS condition without retaining the image.
- Legacy ledger storage is removed and its route returns to Home.
- Donation, petition, commercial offer, user-created event, and leaderboard pages remain visible for public preview. Their final actions are safely blocked with a clear notice until operational services are connected.
- Rewards is renamed Achievements in the primary interface.
- Automatic prototype medal awards are disabled until the approved three-medal rules are implemented.
- Every existing landmark remains visible in the directory and map. Public users must visit a landmark and pass its 500-metre location check before image verification.
- Artificial map-marker offsets were removed so markers retain their original stored latitude and longitude.
- Every landmark presents one image-verification option.
- The production web build completes successfully.

Remaining Step 2.1 work:

- Consolidate duplicate route, renderer, and event-handler implementations into one production path.
- Centralize XP, rank, quiz, and navigation constants.
- Remove inactive prototype functions after confirming that no production journey depends on them.
- verify that the remote email template contains no welcome bonus language.
- run focused journey checks for guest access, authentication, directory navigation, GPS failure states, camera capture, achievements, and rotation.
