---
inclusion: always
---

# Steering 01 — Zero-Server Client-Side Architecture & COOP/COEP Isolation

## Architectural Mandate
StitchCut is a **100% Zero-Server, Local-First** browser application. User video and audio bytes must never leave the local machine.

## Mandatory Rules
1. **Zero Cloud Uploads or Telemetry**:
   - Never add `fetch()`, `XMLHttpRequest`, `WebSocket`, or `navigator.sendBeacon` calls that transmit user `File`, `Blob`, `ArrayBuffer`, or `AudioBuffer` payloads to any remote origin.
   - Only same-origin static asset fetches (`/ffmpeg/ffmpeg-core.js`, `/ffmpeg/ffmpeg-core.wasm`, `/sample-demo.mp4`) are permitted.
2. **Cross-Origin Isolation Parity (`COOP` / `COEP`)**:
   - Both `vite.config.ts` (`server.headers` and `preview.headers`) and `vercel.json` (`headers`) **must** emit:
     - `Cross-Origin-Opener-Policy: same-origin`
     - `Cross-Origin-Embedder-Policy: require-corp`
   - Never embed cross-origin `<script>`, `<img>`, `<video>`, or font stylesheets lacking `Cross-Origin-Resource-Policy: cross-origin`, as `require-corp` will block them and break `window.crossOriginIsolated`.
3. **Graceful Diagnostic Degradation**:
   - `src/App.tsx` and `src/components/IsolationBanner.tsx` must surface clear diagnostic state whenever `window.crossOriginIsolated === false` rather than failing silently during WASM worker startup.
