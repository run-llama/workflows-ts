# Workflow Visualization Demo

This demo showcases two different ways to visualize `@llamaindex/workflow-core` graphs:

1. **Browser Visualization**: Interactive web-based graph using Sigma.js
2. **Node.js Image Generation**: Generate static PNG images using node-canvas

## Prerequisites

- **Node.js**: v20 or newer
- **npm** (bundled with Node.js)

## Installation

From the repo root:

```bash
cd demo/visualization
npm install
```

---

## 🌐 Browser Visualization

Interactive web-based workflow visualization using Sigma.js for real-time graph rendering.

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

### What it does

- Defines a workflow in `src/workflow.ts` using `createWorkflow` and wraps it with `withDrawing` to add drawing capabilities
- Uses the `draw` method to render the workflow in an HTML container using force-directed layout
- Provides interactive graph navigation, zoom, and pan capabilities

### Key files

- `src/workflow.ts`: Example workflow (events, handlers) with drawing capabilities
- `src/viz-browser.ts`: Browser visualization entry point
- `src/style.css`: Styling for the visualization
- `index.html`: HTML container for the visualization
- `vite.config.ts`: Vite config with React SWC plugin

---

## 🖼️ Node.js Image Generation

Generate static PNG images of workflow graphs using node-canvas for documentation, reports, or automated workflows.

### Generate Graph as PNG image

```bash
npm run generate
```

This will create `workflow.png` in the current directory.

> **Note:** This uses `node-canvas`, which requires native dependencies.
>
> **On macOS:**
>
> ```bash
> brew install pkg-config cairo pango libpng jpeg giflib librsvg
> ```
>
> **On Ubuntu/Debian:**
>
> ```bash
> sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
> ```
>
> **For pnpm v10+:** Run `pnpm approve-builds` or add `enable-pnpm-unsafe-build-scripts=true` to `.npmrc`.

### What it does

- Uses the same workflow definition from `src/workflow.ts`
- Wraps the workflow with `withDrawingNode` for Node.js image generation
- Generates a high-quality PNG image with configurable dimensions and layout
- Perfect for automated documentation, CI/CD pipelines, or batch processing

### Key files

- `src/workflow.ts`: Shared workflow definition (events, handlers)
- `src/viz-node.ts`: Node.js image generation entry point
- `package.json`: Contains the `generate` script

---

## Shared Components

Both examples use the same underlying workflow definition:

- **`src/workflow.ts`**: Contains the example workflow with events and handlers that both browser and Node.js examples can use
