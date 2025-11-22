## Agentic Image Studio

Agentic Image Studio is a Next.js experience that lets you chat with Google’s Gemini image models (2.5 Flash Image and 3.0 Pro Preview) to generate and iteratively refine visuals. Upload a base image, describe adjustments in natural language, and receive live updates on a shared canvas.

### Prerequisites

- Node.js 20+
- A Gemini Developer API key with image-generation access

Create a `.env.local` file based on `.env.example`:

```bash
cp .env.example .env.local
```

Then add your key:

```bash
GOOGLE_API_KEY=your_google_gemini_api_key_here
```

### Scripts

```bash
npm install        # install dependencies
npm run dev        # start the development server
npm run lint       # run linting
npm run build      # create the production build
npm start          # start the production server (after build)
```

The app runs at [http://localhost:3000](http://localhost:3000) in development.

### Features

- Multi-turn chat interface with streamed history for contextual edits
- Support for Gemini 2.5 Flash Image and Gemini 3.0 Pro Preview models
- Upload any image to use as the live canvas for iterative refinement
- Toggle whether the current canvas should be used as reference for the next prompt
- Tailwind-powered responsive layout that keeps chat and canvas side-by-side

### Deployment

The project is ready for deployment on Vercel. Ensure that the `GOOGLE_API_KEY` environment variable is configured in the Vercel project settings before deploying.
