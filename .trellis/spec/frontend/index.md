# React Native Application Guidelines

MusicFree is a single React Native application. The TypeScript application layer
owns screens, reusable UI, state, playback orchestration, plugins, persistence,
and typed wrappers around native modules.

## Guides

| Guide | Use it for |
| --- | --- |
| [Directory Structure](./directory-structure.md) | Choosing the owning module for new code |
| [Component Guidelines](./component-guidelines.md) | Screens, reusable UI, responsive layout, and lists |
| [Hook Guidelines](./hook-guidelines.md) | Reactive subscriptions, effects, and query hooks |
| [State Management](./state-management.md) | Local state, Jotai, managers, and persisted config |
| [Core Services](./core-services.md) | Playback, plugins, i18n, config, and native boundaries |
| [Type Safety](./type-safety.md) | Route, media, config, and bridge contracts |
| [Quality Guidelines](./quality-guidelines.md) | Formatting, tests, accessibility, and verification |

## Pre-Development Checklist

1. Read `directory-structure.md` and the guide for the layer being changed.
2. For UI work, read `component-guidelines.md`, `hook-guidelines.md`, and
   `state-management.md`.
3. For core or native-facing work, also read `core-services.md`,
   `type-safety.md`, and `.trellis/spec/native/index.md`.
4. Read `quality-guidelines.md` before choosing validation commands.
5. Read `.trellis/spec/guides/index.md` for shared reuse and cross-layer checks.
