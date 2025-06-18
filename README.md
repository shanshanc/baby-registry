# Baby Registry

A simple baby registry web application built with Cloudflare Pages and Workers. It dynamically fetches registry data from a Google Sheet, displays it to users, and allows them to claim items.

## How it Works

The project consists of two main components:

1.  **Cloudflare Pages Application**: The user-facing frontend, built with static HTML, CSS, and JavaScript. It's responsible for displaying the registry items. It also includes serverless Functions that act as a backend API.
2.  **Cloudflare Worker (Sync Worker)**: A scheduled worker that runs daily. It fetches the latest registry data from a Google Sheet and populates a Cloudflare KV namespace. This ensures the registry data on the website is always up-to-date.

## Project Structure

```
/
├── functions/              # Cloudflare Pages Functions
│   └── api/
│       ├── _middleware.js  # Main API request handler
│       ├── googleSheets.js # Google Sheets API client
│       └── utils.js        # Utility functions
├── public/                 # Static assets for the frontend
│   ├── js/                 # Client-side JavaScript
│   ├── data/
│   │   └── items.js        # Fallback/default registry items
│   ├── index.html          # Main page
│   └── styles.css          # Styling
├── workers/
│   └── sync-worker.js      # Worker to sync data from Google Sheets
├── wrangler.toml           # Configuration for the Pages application
└── wrangler.sync.toml      # Configuration for the Sync Worker
```

## Development

To run the application locally, you'll need two terminals.

**1. Run the Pages Application:**

```bash
wrangler pages dev public --kv=RATE_LIMIT --port=8788
```

You will also need a `.dev.vars` file in the root directory with the following content:

```
GOOGLE_SHEET_ID="your-sheet-id"
GOOGLE_SHEET_RANGE="apiDev!A2:H"
BASE_URL_ITEMS_DEV="http://127.0.0.1:8787/items"
```

**2. Run the Sync Worker (for data fetching):**

To test the data synchronization from Google Sheets, you can run the sync worker locally:

```bash
wrangler dev workers/sync-worker.js --env development --test-scheduled
```

## Configuration

The application relies on several environment variables and secrets.

### `wrangler.toml` (Pages App)

-   `kv_namespaces`:
    -   `RATE_LIMIT`: Used for API rate limiting.
-   `vars`: (for `[env.development]`)
    -   `GOOGLE_SHEET_ID`: The ID of your Google Sheet.
    -   `GOOGLE_SHEET_RANGE`: The sheet and range for registry data (dev).
    -   `BASE_URL_ITEMS_DEV`: The local URL for the worker that serves registry items.
-   **Secrets** (must be set in Cloudflare dashboard for production):
    -   `GOOGLE_SHEET_ID`: The production Google Sheet ID.
    -   `BASE_URL_ITEMS_PROD`: The production URL for the worker that serves registry items.

### `wrangler.sync.toml` (Sync Worker)

-   `kv_namespaces`:
    -   `CLAIMS`: Stores claimed item data from the Google Sheet.
-   `vars`:
    -   `SHEET_ID`: The ID of your Google Sheet.
-   **Secrets**:
    -   `GOOGLE_SERVICE_ACCOUNT`: A JSON service account key with access to the Google Sheet. This must be created in Google Cloud and added as a secret using `wrangler secret put`.

## Deployment

This project is configured for automatic deployment from a GitHub repository. Pushing new commits to the designated branch will trigger a deployment of both the Cloudflare Pages application and the Sync Worker.

### Cloudflare Setup

Before your first deployment, you need to connect your GitHub repository to a Cloudflare Pages project. As part of the setup, ensure the following are configured in your Cloudflare dashboard:

1.  **KV Namespace Bindings**:
    -   In the Pages project settings, bind the `RATE_LIMIT` and `CLAIMS` KV namespaces.

2.  **Environment Variables & Secrets**:
    -   In your Pages project settings, go to **Settings > Environment variables**.
    -   Add the production secrets for the Pages Application:
        -   `GOOGLE_SHEET_ID`
        -   `BASE_URL_ITEMS_PROD`
    -   Add the secret for the Sync Worker:
        -   `GOOGLE_SERVICE_ACCOUNT`

Once configured, any `git push` to your repository will automatically build and deploy the project.

## API Endpoints
-   `GET /api/config`: Retrieves basic configuration for the frontend, like API endpoints and refresh intervals. Other API endpoints are routed dynamically within `_middleware.js`.
