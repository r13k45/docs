# AI Signal Ledger

Source-first AI intelligence page for GitHub Pages.

## What it does

- Aggregates recent AI research from arXiv feeds.
- Pulls AI-related news from configured RSS feeds.
- Supports Threads monitoring through RSSHub-compatible routes.
- Preserves source links, timestamps, feed names, and heuristic categorization.

## Accuracy model

This project does **not** promise infallible truth. It aims for:

- Original-source links on every item.
- Transparent update timestamp.
- Transparent source errors instead of silently fabricating data.
- Clear caveats on heuristic classification and feed latency.

For decision-critical use, verify the linked source directly.

## Local usage

```bash
npm run build:data
```

Open `index.html` with any static file server, or publish the repository on GitHub Pages.

## GitHub Pages

Recommended settings:

1. Put this project at the root of a dedicated repository.
2. Enable GitHub Pages from the `main` branch.
3. Enable the scheduled workflow in `.github/workflows/update-data.yml`.

## Data sources

- arXiv Atom API
- Selected RSS news feeds
- Threads profiles through RSSHub

Adjust the feed list in `scripts/build-data.mjs` if you want different publishers or social accounts.
