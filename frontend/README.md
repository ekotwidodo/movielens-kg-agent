# MovieLens KG Agent — Web Frontend

An interactive Single Page Application (SPA) built with React 19, TypeScript, Vite, and Tailwind CSS for exploring the MovieLens RDF Knowledge Graph and querying the AI Agent.

## Quick Start

You can use either standard **Node.js with npm** or **Bun**.

### Using npm (Node.js >= 18)

```bash
# 1. Install dependencies
npm install

# 2. Run local development server (starts on http://localhost:3000)
npm run dev

# 3. Type-check and build production bundle
npm run build

# 4. Preview production build locally
npm run preview
```

### Using Bun

```bash
# 1. Install dependencies
bun install

# 2. Run local development server
bun run dev

# 3. Type-check and build production bundle
bun run build
```

## Features

- **Overview (`/`)**: Knowledge graph metrics, ontology overview, and system architecture.
- **AI Agent Demo (`/agent`)**: Natural language question answering with real-time SSE reasoning trace and grounded answers.
- **Movie Catalog (`/movies`)**: Infinite-scrolling movie grid with title search, genre multi-select, and tag filtering.
- **Movie Details (`/movies/:id`)**: Comprehensive movie view with metadata, ratings, and embedded neighborhood graph.
- **Graph Explorer (`/explore`)**: Interactive topological graph visualization powered by Cytoscape.js with bounded depth expansion.
- **SPARQL Console (`/sparql`)**: Direct read-only SPARQL query editor with query presets and JSON export.
- **Settings & Ingestion (`/settings`)**: Admin PIN protected interface to test/configure LLMs and upload CSV datasets to build the knowledge graph.
