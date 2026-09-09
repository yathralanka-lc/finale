# YathraLanka Technical Architecture & Technology Stack
**VisioNEX Grand Finale Hackathon - Technical Defense Document**

---

## 1. System Architecture Overview

YathraLanka is an enterprise-grade, offline-first gamified cultural preservation and photographic verification platform. It combines mobile hardware sensor fusion (GPS, Gyroscope, Camera), client-side vision AI heuristics, anti-spoofing velocity detection, and an immutable event sourcing cryptographic ledger to guarantee authentic proof-of-presence at Sri Lanka’s heritage checkpoints.

```mermaid
graph TD
    subgraph Client Layer (Cross-Platform Mobile & Web)
        UI[Cyberpunk / Heritage UI & Glassmorphic HUD]
        Router[Single Page Router & State Manager]
        StageDemo[Stage Demo Override Switcher Drawer]
    end

    subgraph Native Bridge Layer (Capacitor Runtime)
        CapGeo[@capacitor/geolocation]
        CapCam[@capacitor/camera]
        CapMap[@capacitor/google-maps]
    end

    subgraph Core Verification Engine
        HavEngine[Haversine Geofencing Engine]
        VelGuard[Velocity Anti-Spoofing & Sensor Fusion Guard]
        VisModel[Dual-Model Vision Inspection Engine]
        DwellPoller[Immersion Dwell-Time Polling Loop]
    end

    subgraph Storage & Ledger System
        LocalQueue[IndexedDB / LocalStorage Sync Queue]
        EventLedger[Immutable Cryptographic Event Ledger]
        FBAuth[Firebase Authentication]
        Firestore[Firestore Cloud State Sync]
    end

    UI --> Router
    Router --> CapGeo
    Router --> CapCam
    Router --> CapMap
    CapGeo --> HavEngine
    CapGeo --> VelGuard
    CapCam --> VisModel
    HavEngine --> VisModel
    VelGuard --> VisModel
    VisModel --> EventLedger
    VisModel --> LocalQueue
    LocalQueue -->|Online Recovery| Firestore
    Router --> FBAuth
    StageDemo -.->|Live Stage Overrides| VisModel
```

---

## 2. Core Functional Architecture & Technical Specifications

### A. Geolocation & Haversine Distance Engine
The location engine computes exact spherical surface distance between user coordinates ($P_u$) and target landmark coordinates ($P_t$) using the Haversine formula:

$$a = \sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1) \cdot \cos(\phi_2) \cdot \sin^2\left(\frac{\Delta \lambda}{2}\right)$$

$$c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1-a}\right)$$

$$d = R \cdot c$$

Where $R = 6,371,000\text{m}$ (Earth's radius), $\phi$ is latitude in radians, and $\lambda$ is longitude in radians.
- **Dynamic Geofence Radius:** $500\text{m}$ standard radius (configurable per site density).
- **Coordinate Delta Precision:** Sub-10 meter resolution provided via dual-constellation GPS/GLONASS positioning.

### B. Anti-Spoofing & Sensor Fusion Guard
To prevent GPS spoofing apps and position manipulation:
1. **Velocity Anomaly Detection:** Compares consecutive location updates:
   $$v = \frac{\Delta d}{\Delta t} \cdot 3.6 \quad [\text{km/h}]$$
   If $v > 120\text{ km/h}$ between updates without verified transit intervals, the system flags `SPOOF_SUSPECTED`.
2. **Dwell-Time Hardware Polling:** Continuous background polling (every 120s) verifies the device remains stationary within site coordinates during the 15-minute immersion timer.
3. **Image Metadata Integrity:** Captures camera hardware metadata and validates timestamps against the device hardware clock.

### C. Dual-Model Vision Inspection Architecture
The verification engine applies multi-factor visual analysis to inspect captured evidence photos against historical reference feature baselines:
- **Client-Side Feature Extraction:** Analyzes perceptual color histograms, structural sharpness metrics, and spatial framing bounding ratios.
- **Verification States:**
  - `PASSED`: Feature match confidence $\ge 75\%$ AND Distance delta $\le 500\text{m}$ AND Anti-Spoofing CLEAN.
  - `FAILED_VISION`: Device within $500\text{m}$ radius BUT feature match confidence $< 75\%$.
  - `OUT_OF_BOUNDS`: Feature match confidence $\ge 75\%$ BUT device distance delta $> 500\text{m}$.
  - `SPOOF_SUSPECTED`: Unrealistic velocity jump or mock location flag detected.

### D. Immutable Event Sourcing Ledger
Every verification attempt generates an unalterable, signed block appended to `state.eventLedger`:
```json
{
  "eventId": "EVT-20260820-9A7F",
  "timestamp": "2026-08-20T20:47:00.000Z",
  "siteId": "sigiriya",
  "siteName": "Sigiriya Rock Fortress",
  "userCoords": { "latitude": 7.9570, "longitude": 80.7603, "accuracy": 4.8 },
  "targetCoords": { "latitude": 7.9570, "longitude": 80.7603 },
  "distanceDeltaMeters": 14,
  "visionScore": 96,
  "status": "PASSED",
  "imageMetadata": { "sizeBytes": 184200, "mimeType": "image/jpeg", "hash": "SHA256-a8f3b9c1d2e4" },
  "signature": "0x4a8f9c1d2e3f4b5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f"
}
```
- **Cryptographic Seal Signature:** Formed by hashing payload tuples with a 256-bit tamper-evident HMAC key.

---

## 3. Technology Stack & Key Dependencies

| Component Layer | Technology / Framework | Function & Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | HTML5, Modern Vanilla JS (ES Modules), CSS3 | High-performance SPA with zero framework bundle overhead |
| **Build & Dev Tooling** | Vite v5.4.21 | Ultra-fast HMR and optimized production bundling |
| **Native Runtime Bridge** | Capacitor v6.0.0 (`@capacitor/core`) | Native iOS & Android hardware binding bridge |
| **Geolocation Hardware** | `@capacitor/geolocation` v6.1.1 | High-accuracy GPS sensor bindings |
| **Camera Hardware** | `@capacitor/camera` v6.0.0 | High-resolution device camera capture |
| **Interactive Map Engine** | `@capacitor/google-maps` v6.0.0 / Leaflet fallback | Hardware-accelerated native map rendering |
| **Backend & Sync** | Firebase v12.15.0 (Auth & Firestore) | User authentication, cloud persistence, and leaderboard sync |
| **Offline Storage** | IndexedDB & LocalStorage | Offline-first sync queue and immutable event ledger |

---

## 4. UI/UX & Live Demo Controls Architecture

1. **Cyberpunk / Heritage HUD Viewfinder:**
   - Real-time animated reticle grid, laser scanner sweep line animation, dynamic GPS distance delta readout, and live Match Confidence progress rings.
2. **Stage Demo Developer Drawer (`Ctrl + Shift + D` / Stage Button):**
   - Enables live stage demo simulation of GPS locks (Sigiriya 0.01km, Mihintale 0.02km, Galle Fort 2.6km), preset photographic verifications, and instant edge-case testing without requiring physical presence at remote Sri Lankan landmarks.
3. **Cryptographic Audit Ledger Explorer Screen (`renderLedger()`):**
   - Provides live audit statistics, filterable log tables (`PASSED`, `OUT_OF_BOUNDS`, `SPOOF_SUSPECTED`), and clickable cryptographic seal details for jury inspection.
