# 🥁 Sick Beat Machine

A tiny browser beatbox built with the Web Audio API:

- 4 tracks: **Kick**, **Snare**, **Hat**, **Bass**
- 16‑step sequencer with **swing**
- Simple **FX rack**: low‑pass, feedback delay, soft drive
- **Shuffle/Clear**, **Save/Load** patterns (LocalStorage)
- **Record** to WebM (via `MediaRecorder`)

## Run locally

Just open `index.html` in a modern browser (Chrome, Edge, Firefox). If the AudioContext is blocked, click anywhere and press **Start**.

## GitHub Pages deploy (no build step)

Push this repo to GitHub and enable **Pages** → Deploy from **GitHub Actions**.

A workflow is included and will publish to Pages on pushes to `main`.

## Controls

- **Space** toggles Start/Stop
- **BPM**, **Swing** sliders
- Channel controls for volume & basic params
- FX: LPF cutoff, Delay mix/time, Drive

## License

MIT
