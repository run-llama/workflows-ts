---
"@llama-flow/core": patch
---

feat: add `withSnapshot` middleware API

Add snapshot API, for human in the loop feature. The API is designed for cross JavaScript platform, including node.js, browser, and serverless platform such as cloudflare worker and edge runtime

- `workflow.createContext(): Context`
- `context.snapshot(): Promise<[requestEvent, snapshot]>`
- `workflow.resume(data, snapshot)`
