import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import type { createAppRouter } from './router'
import { TeamOrderProvider } from './settings/teamOrder'

type Props = {
  router: ReturnType<typeof createAppRouter>
  queryClient: QueryClient
}

export function App({ router, queryClient }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <TeamOrderProvider>
        <RouterProvider router={router} />
      </TeamOrderProvider>
    </QueryClientProvider>
  )
}
