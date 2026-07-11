# @open-lens/core

The pure, deterministic Open Lens matching engine for browser, Node, and edge
runtimes. Supply one or more declarative language packs and call `analyze`.
Every annotation is anchored to the original text; overlapping rules are all
retained. The package performs no I/O, telemetry, or network requests.

```js
import { createLens } from "@open-lens/core";
import english from "@open-lens/lexicon-en";

const lens = createLens({ packs: [english] });
const result = lens.analyze({ text: "Mistakes may have been made.", language: "en" });
```

Licensed under Apache-2.0. Language packs retain their own data licenses.

## Security boundary

Language packs are **trusted input**. `surface` rules are escaped by the engine,
but `regex` rules are compiled with JavaScript `RegExp`; a malicious or poorly
designed expression can cause catastrophic backtracking and CPU denial of
service (ReDoS). “Declarative” means data-shaped, not sandboxed. Do not load an
unreviewed or user-supplied pack in-process. Audit its regexes, bound input
size, and run analysis in an isolation boundary that can enforce a deadline.
The engine's `network: false` capability does not provide a CPU sandbox.
