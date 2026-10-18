# Static SPA calling OverFast directly from the browser

Colosseo is a static Vite + React + TypeScript app using TanStack Router (Matchup state lives in typed URL search params) and TanStack Query (each Player is fetched and cached independently). It has no backend: the browser calls the OverFast API directly, which works because OverFast sends `Access-Control-Allow-Origin: *`. We rejected TanStack Start and other server-rendered frameworks because a proxy server would add hosting cost and an extra network hop, and OverFast already caches heavily. Calls also come from each visitor's own IP, so no single server hits OverFast's rate limits.

## Consequences

If OverFast stops allowing cross-origin requests, or we need to hide an API key, we'll need a proxy. Keep every OverFast call behind one client module so that change only touches one place.
