import { QueryClient } from '@tanstack/react-query'

/**
 * The app's one query cache, in a module of its own so that ending a session can empty it
 * (see `logout` in the auth store): everything in this cache belongs to the account that
 * was on screen.
 *
 * It cannot live in `api/client.ts` next door — that module reads the auth store, and the
 * store is the thing that has to import this one. Keeping it here is what makes the
 * dependency one-way.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})
