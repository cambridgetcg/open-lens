# @open-lens/lexicon-en

The declarative English Open Lens language pack. It contains technique records
and reviewed detection rules compiled from the repository's `lexicon/` source.
The pack module itself makes no network requests. When supplied to an engine,
its regex rules are compiled as JavaScript `RegExp` objects.

Third-party packs are trusted input, not sandboxed plugins: unreviewed regexes
can cause ReDoS. Audit them and bound or isolate execution before use.

This data package is licensed under CC-BY-SA-4.0. The engine is distributed
separately under Apache-2.0 as `@open-lens/core`.
