# Bootstrap Project Guidelines

## Goal

Replace Trellis's generic spec scaffold with source-backed guidance for the
MusicFree React Native application.

## Scope

- Document the TypeScript application structure and conventions.
- Document Android/native bridge boundaries and validation.
- Remove backend/database templates because this repository has no backend.
- Keep the pre-populated shared thinking guides.

## Confirmed Architecture

- Single React Native 0.76 application with TypeScript in `src/`.
- Route screens live in `src/pages`; reusable UI lives in `src/components`.
- Domain services and persistence live in `src/core`.
- Jotai, React local state, manager hooks, and MMKV are the established state
  mechanisms.
- Native capabilities use typed `src/native` wrappers and manually registered
  Android Kotlin packages.

## Completion Checklist

- [x] Frontend guidelines describe real source patterns.
- [x] Native bridge guidelines describe real Kotlin and TypeScript patterns.
- [x] Non-applicable backend/database templates are removed.
- [x] Guidelines include concrete file references and anti-patterns.
- [x] Index files match the final spec structure.

## Acceptance Criteria

- No template placeholder or `To fill` status remains in project specs.
- Future tasks can select relevant frontend/native guides directly.
- Product source code is unchanged by this bootstrap task.
