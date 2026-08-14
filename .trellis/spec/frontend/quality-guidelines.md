# Quality Guidelines

## Scope And Design

- Make the smallest change that correctly satisfies the current requirement.
- Reuse existing components, managers, hooks, and constants before adding an
  abstraction. Add one when current repetition or an ownership boundary makes
  it simpler than local changes.
- Do not mix unrelated refactors, formatting churn, or business behavior into a
  layout or bug-fix task.

## Formatting

- TypeScript/TSX uses four-space indentation, semicolons, double quotes under
  ESLint, braces with spaces, and trailing commas for multiline constructs.
- Work with existing line endings; do not normalize whole files incidentally.
- Use the `@/` alias for application imports where surrounding code does.

## Tests

- Put focused pure-helper tests next to the implementation as `*.test.ts`.
  `src/core/bilibiliRecognitionUtils.test.ts` and
  `src/utils/lyricMatch.test.ts` are current examples.
- Test observable behavior, boundary values, cancellation, and cleanup. Avoid
  tests that only reproduce the implementation.
- For layout work, combine pure sizing/state tests with Android screenshots and
  rotation checks; unit tests alone do not establish visual correctness.

## Validation Commands

- Type check: `npx tsc --noEmit`
- Tests: `npx jest --runInBand`
- Read-only lint check: `npx eslint src --ext .js,.jsx,.ts,.tsx`
- Android Kotlin compilation: run `gradlew.bat :app:compileDebugKotlin` from
  `android/`

The repository `npm run lint` command includes `--fix`; do not use it as a
read-only check when unrelated files may be dirty.

## Review Checklist

- Portrait and landscape content do not overlap or clip.
- Safe areas and keyboard-visible states remain usable.
- Effects, timers, subscriptions, native jobs, and temporary files are cleaned
  up.
- User-facing strings are translated and icon-only actions remain accessible.
- The working tree contains only task-related changes.
