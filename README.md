# Baby Registry

A simple baby registry web application built with Cloudflare Pages, KV storage, and durable objects.

## Features

- Static website hosted on Cloudflare Pages
- Serverless API endpoints using Cloudflare Pages Functions
- Real-time updates of claimed items via Cloudflare durable objects

## Project Structure

```
/
├── functions/           # Cloudflare Pages Functions
│   └── api/
│       └── _middleware.js  # API request handler
├── public/             # Static assets
│   ├── data/
│   │   └── items.json  # Registry items data
│   ├── index.html      # Main page
│   ├── scripts.js      # Client-side JavaScript
│   └── styles.css      # Styling
└── wrangler.toml       # Cloudflare configuration
```

## Development

1. Install dependencies:
```bash
npm install
```

2. Run locally:
```bash
wrangler pages dev public --kv RATE_LIMIT
```

3. Visit `http://localhost:8788` in your browser

## Deployment

The project is automatically deployed to Cloudflare Pages when changes are pushed to the master branch.

### KV Namespace Setup

1. Create a KV namespace in Cloudflare Dashboard
2. Add a KV namespace binding named `RATE_LIMIT` in Pages > Settings > Bindings. Add
  - Type: KV namespace
  - Name: RATE_LIMIT
  - Value: RATE_LIMIT (Select from dropdown)

## API Endpoints

- `GET /api/config` - Get all configs
