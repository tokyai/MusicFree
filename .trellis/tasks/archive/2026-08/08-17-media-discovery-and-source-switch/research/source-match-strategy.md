# Strict Cross-Source Match Strategy

## Identity boundary

MusicFree identifies one source record by `platform@id`. IDs are opaque and
source-local, so an old ID must never be reused with a new platform. A
successful migration replaces the complete target identity returned by the
target plugin.

## Candidate discovery

1. Search the selected target plugin for `title + artist`.
2. If no candidate passes the identity gate, retry with `title`.
3. Deduplicate candidates by their target `platform@id`.

## Strict identity gate

- Normalize Unicode width/case, whitespace, punctuation, artist separators,
  and `feat`/`ft` syntax before comparison.
- Extract meaningful edition qualifiers such as live, remix, acoustic,
  instrumental/accompaniment, cover, DJ, edit, and version. If either side has
  a qualifier, the qualifier sets must be compatible.
- Rank candidates by title similarity, artist overlap, duration proximity, and
  album similarity. Duration and album are supporting evidence, not enough to
  override a title/artist or edition conflict.
- Require an acceptance threshold and a minimum lead over the runner-up. An
  ambiguous result is a failure, not an automatic replacement.

## Playability gate

After identity matching, accept a candidate only when it already contains a
usable URL/source or the selected plugin can resolve one supported quality.
The resolved URL may expire and is used for validation only; persist the
plugin's target music item, not the transient validation response.

## Commit behavior

- Build replacements in memory and write the completed success set once.
- On normal completion, keep failed originals and commit successful matches.
- On explicit user cancellation, discard the in-memory success set.
- Preserve playlist position metadata, but do not copy source-specific IDs,
  URLs, qualities, cache fields, or opaque plugin payloads from the old item.
- Skip a replacement that would duplicate a target item already present in
  the favorites list or selected earlier in the same batch.
