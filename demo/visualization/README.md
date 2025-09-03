### Workflow Visualization Demo

A minimal Vite + TypeScript + React demo that visualizes an example `@llamaindex/workflow-core` graph using `@llamaindex/workflow-viz` and Sigma.js.

### Prerequisites

- **Node.js**: v20 or newer
- **npm** (bundled with Node.js)

### Install

From the repo root:

```bash
cd demo/visualization
npm install
```

### Run in development

```bash
npm run dev
```

Then open the dev server at [http://localhost:5173](http://localhost:5173) (Vite will print the exact URL/port; it may choose a different port if 5173 is taken).

### Build for production

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

Open the preview server at [http://localhost:4173](http://localhost:4173) (or the port shown in the terminal).

### What this demo does

- Defines a small workflow in `src/workflow.ts` using `createWorkflow` and wraps it with `withGraph` to expose its graph.
- Converts the workflow graph to a Sigma-compatible graph via `toSigma` and renders it in `src/main.ts`.
- Applies a force-directed layout (`graphology-layout-force`) so the graph auto-arranges on load.

### Key files

- `src/workflow.ts`: Example workflow (events, handlers, and graph wiring)
- `src/main.ts`: Bootstraps Sigma, layout, and renders the graph
- `vite.config.ts`: Vite config with React SWC plugin
