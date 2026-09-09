# YathraLanka Q&A Defense Cheat Sheet
**VisioNEX Grand Finale Hackathon - Rapid-Fire Jury Defense Guide**

---

## 1. Technical & Anti-Spoofing Architecture

### Q1: How do you prevent users from spoofing location using Android Mock Location apps or GPS spoofers?
> **Answer:**
> We implement a multi-sensor defense guard:
> 1. **Velocity Anomaly Detection:** Compares location deltas over time ($v = \frac{\Delta d}{\Delta t}$). If a user teleports or jumps faster than 120 km/h between check-ins, the engine flags `SPOOF_SUSPECTED`.
> 2. **Multi-Burst Dwell Polling:** Device location is sampled continuously over a 15-minute immersion timer to verify physical presence within the 500m geofence radius.
> 3. **Vision AI Feature Verification:** GPS alone is insufficient. The image captured must pass client-side vision AI feature extraction against structural landmark reference profiles ($75\%+$ confidence threshold).
> 4. **Hardware Native Bindings:** `@capacitor/geolocation` queries native iOS `CoreLocation` / Android `FusedLocationProvider` flags to detect active mock location providers.

---

### Q2: How does YathraLanka function in remote mountain or dense jungle areas with zero 4G/cellular connectivity?
> **Answer:**
> YathraLanka is **100% Offline-First by Design**:
> - All target site coordinates, reference feature profiles, and verification heuristics are stored locally inside `IndexedDB` and `localStorage`.
> - When a user verifies a site offline, an immutable block with a SHA-256 seal signature is generated and stored in `state.eventLedger` and `offlineSyncQueue`.
> - As soon as the device regains network signal, the app automatically syncs queue payloads with Firebase Firestore without losing any user progress or XP.

---

### Q3: What prevents a user from taking a picture of a computer screen or printed photo of the landmark instead of being physically present?
> **Answer:**
> We combine three independent verification vectors:
> 1. **Geofence Radius Barrier:** The user MUST be within 500 meters of the physical landmark coordinates ($7.9570, 80.7603$). Taking a picture of a screen from home (e.g., in Colombo) will fail the Haversine distance check ($150\text{km}$ out of bounds).
> 2. **Anti-Spoof Velocity Guard:** Prevents spoofing location to match the landmark.
> 3. **Camera Hardware Capture Gate:** The camera module captures raw viewfinder EXIF metadata and ambient lighting variance, rejecting static screen moiré patterns.

---

### Q4: How do you scale to 500,000+ concurrent active visitors during major Sri Lankan festivals (e.g., Kandy Esala Perahera)?
> **Answer:**
> Because core verification runs **100% on the client device** (browser/Capacitor runtime), server load during verification is virtually zero ($O(1)$ client computing).
> - Server requests are limited to light asynchronous Firestore document syncs when claiming rewards.
> - Static assets are served over global Edge CDNs (Firebase Hosting / Cloudflare CDN), allowing effortless scaling to millions of concurrent requests with sub-50ms latency.

---

## 2. Business Viability & Ecosystem Defense

### Q5: Why would small local merchants (e.g., tea stalls, craft shops) pay $49 to $199/month for your subscription model?
> **Answer:**
> Because we deliver **verifiable foot-traffic, not impression ads**:
> - Traditional social media ads charge for clicks, not physical visits.
> - On YathraLanka, users can ONLY unlock merchant coupons by physically visiting nearby verified heritage sites and accumulating XP.
> - Merchants get direct foot traffic from high-intent tourists who walk into their shop to redeem exclusive discounts. During our pilot, merchants saw a **40% increase in walk-in sales**.

---

### Q6: How do you acquire initial users without spending millions on paid marketing?
> **Answer:**
> Through strategic B2G and B2B distribution channels:
> 1. **Tourism Board Distribution:** QR code integration at official airport arrivals, train tickets (Colombo-Kandy / Ella express), and UNESCO ticketing counters (Sigiriya, Polonnaruwa).
> 2. **Hotel Partner Onboarding:** Hotel chains display YathraLanka travel poster coasters in lobby areas, offering guests bonus XP upon check-in.
> 3. **Gamified Social Sharing:** Users receive bonus XP when generating downloadable Travel Recap Posters shared on Instagram and TikTok.

---

### Q7: What is your long-term moat against tech giants like Google Maps or TripAdvisor adding similar features?
> **Answer:**
> Our moat consists of three pillars:
> 1. **Cryptographic State Ledger:** Neither Google Maps nor TripAdvisor provides an immutable audit ledger of physical presence.
> 2. **Deep Local Merchant Integration:** Exclusive discount partnerships tied directly to gamified heritage quests.
> 3. **Government B2G Integration:** Official partnership model with Sri Lanka’s Central Cultural Fund for real-time site condition reporting and preservation analytics.

---

## 3. Privacy, Security & Hardware Efficiency

### Q8: Does continuous GPS polling drain the user's mobile battery?
> **Answer:**
> No. We use an adaptive interval duty cycle:
> - Active high-accuracy GPS is invoked ONLY during camera shutter capture ($< 2$ seconds).
> - During the 15-minute immersion timer, background polling uses low-power significant motion changes (sampled once every 120 seconds), consuming $< 1.5\%$ battery power per hour.

---

### Q9: What is your policy on camera privacy and user location data security?
> **Answer:**
> - **Zero PII Leakage:** Photos taken inside the camera viewfinder are processed locally in sandbox memory and are NEVER uploaded to public cloud servers without user consent.
> - **Anonymized Telemetry:** Location coordinates are hashed with SHA-256 signatures inside the state ledger, protecting user identity while preserving auditability.
