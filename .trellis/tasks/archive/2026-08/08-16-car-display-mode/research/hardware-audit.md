# Target head-unit sizing audit

## Known physical parameters

- Native panel: 1920×1080 pixels
- Diagonal: 14.6 inches
- Aspect ratio: 16:9
- Calculated pixel density: `sqrt(1920² + 1080²) / 14.6 ≈ 150.9 PPI`
- Pixel pitch: approximately 0.168 mm

## Why physical pixels are not enough

React Native `Dimensions.get("window")` reports density-independent logical units. The same panel can expose different logical sizes depending on Android's configured density:

| Android density | Approx. logical landscape size | Short edge |
| ---: | ---: | ---: |
| 1.5 | 1280×720dp | 720dp |
| 2 | 960×540dp | 540dp |
| 2.5 | 768×432dp | 432dp |
| 3 | 640×360dp | 360dp |

The car-mode contract is intentionally defined over the 360/480/600dp cases. At 540dp the existing base fonts are already close to or above the medium minima; at 360dp the minima correct the known undersized values. A fixed branch for 1920×1080 would therefore be less reliable than using runtime logical dimensions.

## Recommendation

Use the `medium` tier initially on this 14.6-inch panel. Switch to `large` only if the installed head unit reports a short edge near 360–480dp and the normal viewing distance still makes text hard to scan. Do not auto-select based on the physical diagonal; keep the manual switch and tier selection.

## Verification data to capture on the device

Before screenshot testing, record:

```ts
Dimensions.get("window");
```

and Android density (`adb shell wm density` when ADB is available). Validate both tiers at the reported logical size, especially the right-hand music table and the width of panels/dialogs.
