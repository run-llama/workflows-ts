# Next.js AI News Report Demo

Generate downloadable news briefs with a server-side LlamaIndex workflow. This Next.js app orchestrates OpenAI web search, report writing, and PDF conversion 
and surfaces the results in a polished Tailwind UI.

## Highlights
- Multi-stage workflow (`userInputEvent → webSearchEvent → createReportEvent → finalResponseEvent`) 
- OpenAI Responses API with Zod parsing for query validation and report generation
- Server-side PDF rendering via Puppeteer with instant preview and download links
- Client UI built with Next.js App Router, Radix UI primitives, and Tailwind utilities

## Requirements
- Node.js 20+
- `OPENAI_API_KEY` available to the server (set in `.env.local`)
- Chrome-compatible environment for Puppeteer PDF rendering (works locally by default)

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env.local` in this directory:
   ```bash
   echo "OPENAI_API_KEY=your-key" > .env.local
   ```

## Run the Demo
```bash
npm run dev
```
Visit http://localhost:3000 to access the News Report Generator.

For production builds:
```bash
npm run build
npm start
```

## Workflow Overview
Core orchestration lives in `src/utils/ai-workflow.ts`:
- `userInputEvent` validates the search request with `evaluateQueryAndEnhance`
- `webSearchEvent` calls OpenAI's web search tool to gather context
- `createReportEvent` composes a markdown report with title/content fields
- `finalResponseEvent` returns either a refusal message or the generated PDF path

The route `src/app/api/report/route.ts` runs the workflow and returns the output path. A follow-up `POST /api/download` route streams the PDF back to the client.

## UI Flow
`src/app/page.tsx` collects the query, tracks workflow status, and renders results. The `FileDisplay` component provides PDF preview and download controls once a report is available.

Generated PDFs are stored in `public/outputs/pdfs`. Files served from `/outputs/pdfs/...` are accessible directly in the browser and through the download endpoint.

## Customizing
- Extend the workflow with additional events (e.g., fact checking) or middleware
- Adjust PDF styling in `src/utils/pdf-conversion.ts`
- Update UI components under `src/components` for different branding or layouts

