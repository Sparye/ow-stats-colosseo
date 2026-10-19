import { createRootRoute, createRouter, type RouterHistory } from '@tanstack/react-router'
import {
  parseMatchupSearch,
  stringifyMatchupSearch,
  type MatchupSearch,
} from './domain/matchupSearch'
import { MatchupPage } from './matchup/MatchupPage'

export const rootRoute = createRootRoute({
  // parseSearch below has already turned the query string into a valid MatchupSearch.
  validateSearch: (search: Record<string, unknown>) => search as MatchupSearch,
  component: MatchupPage,
})

export function createAppRouter(options: { history?: RouterHistory } = {}) {
  return createRouter({
    routeTree: rootRoute,
    // Plain `players=A-1,B-2` params instead of TanStack's default JSON encoding,
    // so shared links stay short and readable.
    parseSearch: (query) => parseMatchupSearch(query),
    stringifySearch: (search) => stringifyMatchupSearch({ ...parseMatchupSearch(''), ...search }),
    history: options.history,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
