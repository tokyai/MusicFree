# Directory Structure

## Application Boundaries

- `src/entry/` bootstraps the application and mounts global providers. Keep
  one-time listeners in `BootstrapComponent`, as demonstrated by
  `src/entry/bootstrap/BootstrapComponent.tsx`.
- `src/core/router/routes.tsx` is the registry for top-level screens. Route
  names and typed parameters live in `src/core/router/index.ts`.
- `src/pages/<feature>/` owns route-level UI, page-local hooks, atoms, and
  components. Examples include `src/pages/searchPage/` and
  `src/pages/artistDetail/`.
- `src/components/` owns reusable UI and reusable composed views. Primitive
  controls belong in `src/components/base/`; overlays belong in
  `src/components/panels/` or `src/components/dialogs/`.
- `src/core/` owns long-lived application services and orchestration such as
  `trackPlayer.ts`, `pluginManager.ts`, `appConfig.ts`, and `lyricManager.ts`.
- `src/hooks/` contains reusable hooks that do not belong to one page.
- `src/native/` contains typed JavaScript wrappers for native modules.
- `src/utils/` contains side-effect-light helpers. Pure matching and parsing
  helpers are tested next to the implementation.
- `src/types/` contains ambient domain declarations and shared contracts;
  `src/constants/` contains stable UI and domain constants.
- `android/` and `ios/` contain platform projects. Android custom modules use
  packages under `android/app/src/main/java/fun/upup/musicfree/`.

## Placement Rules

- Co-locate page-specific components, atoms, and hooks under their page.
- Promote code to `src/components`, `src/hooks`, or `src/utils` only after it
  has a real cross-page consumer or represents an established shared boundary.
- Add top-level routes in both `ROUTE_PATH` and `src/core/router/routes.tsx`.
- Keep native implementation and its typed `src/native` wrapper in the same
  change.

## Avoid

- Do not import one page's private component or store from another page.
- Do not put persistent business state in a visual component when a core
  manager or config store already owns it.
- Do not add generic folders or abstractions for hypothetical future use.
