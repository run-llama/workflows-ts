---
"@llama-flow/docs": patch
"@llama-flow/core": minor
---

feat: add stream helper

In this release, we built-in some stream helper (inspired from (TC39 Async Iterator Helpers)[https://github.com/tc39/proposal-async-iterator-helpers])

- move `@llama-flow/core/stream/until` into `stream.until`
- move `@llama-flow/core/stream/filter` into `stream.filter`
- move `@llama-flow/core/stream/consumer` into `stream.toArray()`
- add `stream.take(limit)
- add `stream.toArray()`

```diff
- import { collect } from "@llama-flow/core/stream/consumer";
- import { until } from "@llama-flow/core/stream/until";
- import { filter } from "@llama-flow/core/stream/filter";

-  const results = await collect(
-    until(
-      filter(
-        stream,
-        (ev) =>
-          processedValidEvent.include(ev) || processedInvalidEvent.include(ev),
-      ),
-      () => {
-        return results.length >= totalItems;
-      },
-    ),
-  );
+  const results = await stream
+    .filter(
+      (ev) =>
+        processedValidEvent.include(ev) || processedInvalidEvent.include(ev),
+    )
+    .take(totalItems)
+    .toArray();
```
