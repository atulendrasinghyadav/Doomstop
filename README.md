# DoomStop

> **A speed bump between you and the next hundred posts.**

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Privacy: Zero Telemetry](https://img.shields.io/badge/Privacy-100%25%20Local-2a9d8f.svg)](#privacy--permissions)
[![Dependencies: None](https://img.shields.io/badge/Dependencies-Zero-success.svg)](#technical-architecture)
[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey.svg)](#license)

**DoomStop** is a lightweight, privacy-first Chromium extension designed to break compulsive infinite-scroll loops on social media and feed-driven websites.

Unlike traditional site blockers that permanently lock you out—preventing quick lookups or messaging—DoomStop targets the *unbroken binge session*. It tracks your scroll depth and active browsing time, gently desaturates the screen into greyscale as you approach your limits, and enforces a mandatory recovery break when you scroll too long.

---

## ✨ Features

- 📜 **Scroll & Time Tracking**
  - Tracks both active time and cumulative scroll depth.
  - One "screen" equals 900 px of scrolling (`PX_PER_SCREEN`).
  - Active time increments only when the tab is visible and has received user interaction within the last 15 seconds.
  - Captures scrolling on nested, virtualized containers used by modern feeds (e.g., TikTok, Instagram Reels, YouTube Shorts).
  - Ignores artificial teleport jumps (> 20,000 px).

- 🎨 **Gentle Greyscale Desaturation**
  - As you pass 50% of your session or daily limit, the page gradually loses its vibrant colors.
  - By 100% of the limit, the page is completely greyscale, delivering a calm, subconscious stopping cue before any hard interruption.

- 🛑 **Mandatory Break Lockout**
  - When your allowed daily time is exceeded, DoomStop enforces a mandatory recovery lockout (default: 30 minutes).
  - Displays a calming full-screen block: *"You have been scrolling for too long — Time to put the screen away and read a book."*
  - Automatically pauses all running `<video>` and `<audio>` elements.
  - Suppresses clicks, keyboard inputs, selections, and background scrolling with a `not-allowed` cursor.
  - Offers a single interactive escape hatch: **"Leave this site"** (safely closes the tab or navigates to a fresh new tab).
  - Synchronized across all open tabs and newly opened windows.

- 🔓 **Post-Break Freedom**
  - After completing your mandatory break, the lockout lifts automatically.
  - Opening or scrolling on watched sites does not immediately re-block you, keeping you in control.

- ⚡ **Single-Page Application (SPA) Aware**
  - Continuously monitors route changes without requiring page reloads.
  - Allows you to target specific paths (e.g. `youtube.com/shorts`) while keeping the rest of the site (e.g. regular videos, search) unrestricted.

- 📊 **Quick Glance Popup & Badge**
  - Toolbar icon badge displays today's total active minutes (e.g., `12m`).
  - Clean popup displays total daily time, a progress bar (which turns amber at 80% capacity), and a per-site breakdown sorted by time spent.
  - Master on/off toggle for immediate control.

- 🔒 **100% Private & Offline**
  - **Zero telemetry, zero analytics, and zero network calls.**
  - No accounts, cloud servers, or third-party trackers.
  - Only requests the `storage` permission.
  - Settings sync privately across your browser profiles via `chrome.storage.sync`.

---

## 📸 How It Works

```
  ┌─────────────────────────────────────────────────────────┐
  │                   Active Browsing                       │
  │   - Counts active time (visible + recent input < 15s)   │
  │   - Tracks scroll depth across all containers           │
  └───────────────────────────┬─────────────────────────────┘
                              │
                              ▼
  ┌─────────────────────────────────────────────────────────┐
  │                 50% - 100% of Limit                     │
  │   - Progressive greyscale fade kicks in                 │
  │   - Subconscious friction without blocking              │
  └───────────────────────────┬─────────────────────────────┘
                              │
                              ▼
  ┌─────────────────────────────────────────────────────────┐
  │                  Limit Reached (Break)                  │
  │   - Page paused, media stopped, inputs locked           │
  │   - Mandatory 30-min countdown: "Read a book"           │
  │   - Action: "Leave this site"                           │
  └───────────────────────────┬─────────────────────────────┘
                              │
                              ▼
  ┌─────────────────────────────────────────────────────────┐
  │                     Break Complete                      │
  │   - Lockout lifted; sites accessible without re-block   │
  └─────────────────────────────────────────────────────────┘
```

---

## 🌐 Default Watched Sites

DoomStop comes pre-configured with common infinite-scroll feeds:

- `reddit.com`
- `x.com`
- `twitter.com`
- `instagram.com`
- `facebook.com`
- `tiktok.com`
- `threads.net`
- `youtube.com/shorts` *(targets only Shorts, keeping standard YouTube unblocked)*
- `linkedin.com/feed` *(targets only the feed, keeping messages and profiles unblocked)*

### Rule Matching Syntax

- **Domain-wide rule (`example.com`)**: Matches `example.com` and all subdomains (e.g., `old.reddit.com`, `new.reddit.com`).
- **Path-specific rule (`example.com/feed`)**: Matches URLs on that host whose path begins with that prefix (e.g., `youtube.com/shorts` matches `https://www.youtube.com/shorts/xyz`).
- Matching is case-insensitive, ignores leading `www.`, and normalizes trailing slashes.

---

## 🚀 Installation

DoomStop works with any Chromium-based desktop browser (**Google Chrome**, **Brave**, **Microsoft Edge**, **Arc**, **Opera**).

1. **Clone or Download** this repository:
   ```bash
   git clone https://github.com/your-username/DoomStop.git
   ```
   *(or download and extract the ZIP file)*

2. Open your browser's extensions management page:
   - **Chrome**: `chrome://extensions/`
   - **Brave**: `brave://extensions/`
   - **Edge**: `edge://extensions/`

3. In the top-right corner, switch on **Developer mode**.

4. Click the **Load unpacked** button in the top-left corner.

5. Select the `DoomStop` folder containing `manifest.json`.

6. *(Recommended)* Click the puzzle piece icon in your toolbar and **pin DoomStop** for quick access.

---

## ⚙️ Configuration & Options

Access settings by right-clicking the DoomStop toolbar icon and selecting **Options**, or clicking **Settings** in the extension popup.

| Setting | Default | Range | Description |
|---|---|---|---|
| **Master Switch** | `On` | On / Off | Enable or pause the extension instantly. |
| **Watched Sites** | Default 9 sites | Custom list | List of sites and paths to monitor (one per line). |
| **Screens per Session** | `50` | `0` to `1000` | Max scroll distance before a pause (1 screen = 900 px). Set to `0` to disable. |
| **Minutes per Day** | `30` | `0` to `1440` | Total active minutes allowed across all watched sites before lockout. Set to `0` to disable. |
| **Break Lockout Duration** | `30` | `1` to `120` | Mandatory lockout length (in minutes) when allowed time is exceeded. |
| **Greyscale Fade** | `On` | On / Off | Progressively desaturates the page between 50% and 100% of limits. |

---

## 🔒 Privacy & Permissions

DoomStop is strictly local and respects your privacy:

- **Permissions requested:**
  - `storage`: Required to save user preferences (`sync` storage) and aggregate daily statistics and active lockouts (`local` storage).
- **Host access (`http://*/*`, `https://*/*`):**
  - Necessary so user-defined custom sites work immediately without re-prompting for new permissions.
  - The content script checks the domain at `document_start`. If the site is not on your watched list, the script **exits immediately** with zero performance overhead.
- **What is NOT collected:**
  - No page content, no passwords, no form entries, no browsing history.
  - No network requests, tracking beacons, analytics, or remote CDNs.

---

## 🛠️ Technical Architecture

DoomStop is built with vanilla web technologies under **Chrome Manifest V3**:

```
DoomStop/
├── manifest.json      # Extension metadata, permissions, content script declarations
├── defaults.js        # Shared constants, rule normalizers, and storage helpers
├── background.js      # Service worker: serializes stats writes, updates badge, handles tab actions
├── content.js         # Page script: scroll tracking, input locking, greyscale filter, shadow DOM overlay
├── popup.html         # Toolbar popup interface
├── popup.js           # Popup logic: today's summary, progress bar, site breakdown
├── options.html       # Options & settings configuration page
├── options.js         # Settings logic: validation, storage sync, default restoration
├── ui.css             # Shared UI design system and color tokens
├── icons/             # Extension icons (16px, 48px, 128px)
└── docs/              # Detailed specifications and engineering rules
    ├── PRD.md         # Product Requirements Document
    └── Rules.md       # Product behavior & engineering rules
```

### Engineering Highlights

- **Zero Build Step**: Pure JavaScript, HTML, and CSS. No Webpack, Vite, or external dependencies required.
- **Shadow DOM Isolation**: The lockout overlay is rendered inside an attached Shadow DOM with a constructable `CSSStyleSheet` to prevent site CSS leakage or interference.
- **Trusted Types Compatible**: UI elements are constructed using `document.createElement()` and `append()` rather than `innerHTML`.
- **Serialized Background Writes**: State updates are queued sequentially in `background.js` to prevent race conditions across concurrent tabs.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
