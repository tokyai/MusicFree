# Type Safety

## Project Reality

The project extends the React Native TypeScript configuration, uses the `@/`
alias, enables `skipLibCheck`, and currently leaves `noImplicitAny` disabled.
New code should still make public and cross-layer contracts explicit.

## Contracts

- Put shared media/domain declarations under `src/types/` and keep namespace
  shapes compatible with existing `IMusic`, `IAlbum`, `IArtist`, and `ICommon`
  consumers.
- Add route names and parameter types together in
  `src/core/router/index.ts`; use `useNavigate()` and `useParams()` at screens.
- Add persisted setting keys to `src/types/core/config.d.ts`.
- Keep translation data synchronized with `src/types/core/i18n/index.d.ts` and
  every language JSON file.
- Define TypeScript interfaces for native module methods and return values in
  `src/native/<module>/index.ts`.

## Narrowing

- Narrow nullable plugin, route, and native values before use. Platform-specific
  wrappers should reject or report unsupported platforms explicitly.
- Use `unknown` at new untyped external boundaries and narrow it before domain
  use. Existing `any` casts around legacy plugin and navigation APIs are not a
  pattern to expand.
- Use `@ts-expect-error` only for a known compatibility boundary, such as a
  persisted legacy value migration, and include a short reason.

## Verification

Run `npx tsc --noEmit` after changing TypeScript, global declarations, route
contracts, configuration, i18n types, or native wrappers.
