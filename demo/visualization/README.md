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

### Generate Graph as PNG image in Node.js

```bash
npm run generate
```

This will create `graph.png` in the `dist` directory.

> **Note:** This uses `node-canvas`, which requires native dependencies.
> On macOS: `brew install pkg-config cairo pango libpng jpeg giflib librsvg`
> On Ubuntu/Debian: `sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`
> For pnpm v10+, run `pnpm approve-builds` or add `enable-pnpm-unsafe-build-scripts=true` to `.npmrc`.

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

- Defines a small workflow in `src/workflow.ts` using `createWorkflow` and wraps it with `withDrawing` to add drawing capabilities.
- Use `draw` method of the workflow to render it in a HTML container in `src/main.ts` using force-directed layout.

### Key files

- `src/workflow.ts`: Example workflow (events, handlers) - adding drawing capabilities
- `src/main.ts`: Renders the workflow in a HTML container using force-directed layout
- `vite.config.ts`: Vite config with React SWC plugin
