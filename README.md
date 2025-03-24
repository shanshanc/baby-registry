# Baby Registry

A simple baby registry web application built with Cloudflare Pages and KV storage.

## Features

- Static website hosted on Cloudflare Pages
- Serverless API endpoints using Cloudflare Pages Functions
- KV storage for managing item claims
- Real-time updates of claimed items

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
wrangler pages dev public --kv CLAIMS
```

3. Visit `http://localhost:8788` in your browser

## Deployment

The project is automatically deployed to Cloudflare Pages when changes are pushed to the master branch.

### KV Namespace Setup

1. Create a KV namespace in Cloudflare Dashboard
2. Add a KV namespace binding named `CLAIMS` in Pages > Settings > Bindings. Add
  - Type: KV namespace
  - Name: CLAIMS
  - Value: CLAIMS (Select from dropdown)

## API Endpoints

- `GET /api/claims` - Get all claimed items
- `POST /api/claim` - Claim an item
  ```json
  {
    "item": "item-id",
    "claimer": "name"
  }
  ``` 