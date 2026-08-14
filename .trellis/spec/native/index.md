# Native Integration Guidelines

MusicFree uses React Native with Expo modules and several manually registered
Android bridge packages.

## Guides

| Guide | Use it for |
| --- | --- |
| [Directory Structure](./directory-structure.md) | Locating native implementations and JS wrappers |
| [Bridge Guidelines](./bridge-guidelines.md) | Promise contracts, validation, cancellation, and registration |
| [Quality Guidelines](./quality-guidelines.md) | Platform compatibility and native verification |

## Pre-Development Checklist

1. Read all three native guides for bridge or platform changes.
2. Also read `.trellis/spec/frontend/core-services.md` and
   `.trellis/spec/frontend/type-safety.md`.
3. Verify both the native module and its TypeScript wrapper.
