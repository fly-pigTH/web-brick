# web-brick 🧱

**Build LEGO® sets brick-by-brick in your browser** — following the real official
instruction steps, in 3D.

**[▶ Play now](https://fly-pigTH.github.io/web-brick/)**

- 🧩 Step-by-step assembly extracted from community LDraw OMR files (`0 STEP` markers)
- 👆 Click the glowing ghost part to install it · Space = finish current step
- 🤖 Auto-build mode · 💥 exploded view · full orbit camera
- ⚡ Pure static site: Three.js + one GLB (all part geometry) + one JSON (poses/colors/steps) per set

| Set | Parts | Steps |
|---|---|---|
| 42107 Ducati Panigale V4 R | 642 | 105 |
| 42056 Porsche 911 GT3 RS | 3,111 | 373 |
| 8880 Super Car (1994) | 1,418 | 216 |

## Add your own set

Sets are converted offline from LDraw OMR files (`export_web.py`, part of the
upcoming ldraw2mujoco toolkit). Drop the output folder into `sets/` and add an
entry to `sets/index.json`.

## Credits & legal

- Part geometry: the [LDraw parts library](https://www.ldraw.org) (CC-BY 2.0) —
  30 years of community measurement work
- Set models: [LDraw OMR](https://library.ldraw.org/omr) community recreations
  (CC-BY 2.0), 42107 by Philippe Hurbain
- Rendering: [Three.js](https://threejs.org) (MIT)
- App code: MIT

LEGO® is a trademark of the LEGO Group, which does not sponsor, authorize or
endorse this project.
