import createClient from 'openapi-fetch'

import { useAuthStore } from '@/stores/auth-store'

import type { paths } from './schema'

export const apiClient = createClient<paths>({
  baseUrl: '/api/v1',
})

apiClient.use({
  onRequest({ request }) {
    const token = useAuthStore.getState().accessToken
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`)
    }
    return request
  },
})

export type ApiClient = typeof apiClient
