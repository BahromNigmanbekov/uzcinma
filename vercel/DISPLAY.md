# Display and player controls

The home hero fills one stable viewport (100svh, with a 100vh fallback). On screens at least 768px wide, the title introduction also fits that viewport. Logos and titles have bounded space; the preview is shortened, and **To‘liq ma’lumot** opens the complete description and metadata.

Every native select is enhanced by `select-menu.js`, including dynamically created admin fields. The original select remains the form source. Menus support arrows, Home/End, type-ahead, Enter and Escape and are mounted inside an active fullscreen element or dialog.

Phone video gestures:
- One tap pauses/resumes; two taps on either side seek ten seconds.
- Pinch with two fingers to zoom from 1× to 4×. Drag with one finger to pan once zoomed.
- **Tiklash** resets the picture. Settings also offer fit/fill and a zoom slider.
- Zoom changes only the video transform. It does not request another source or resolution.
- Where the browser cannot fullscreen the custom player, a page fullscreen view retains the same controls and gestures.

TV mode detects common Smart TV user agents. It is also available in **Sayt haqida → Televizor rejimi** and the mobile menu. The choice is stored on that device. Direction keys move focus, OK activates, and Back/Escape closes menus, settings, fullscreen or the title in that order. Standard media keys control playback. Higher contrast focus and larger controls apply only in TV mode.

Validation: `npm test`, `npm run build`, `node tests/display.browser.mjs`, `node tests/series.browser.mjs`, `node tests/credits.browser.mjs`. The display suite uses a local isolated database and real video, exercises two-finger CDP touch input and 1080p/4K TV user agents. This is browser emulation, not certification for every TV firmware.
