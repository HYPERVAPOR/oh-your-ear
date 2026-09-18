import { apiClient } from '@/api/client'
import { useAuthStore } from '@/stores/auth-store'
import type { components } from '@/api/schema'

type PracticeRecord = components['schemas']['PracticeRecordRequest']

/**
 * Reports one answered question for signed-in users. Guests keep their score in
 * the session only, and a failed report must never disturb practice.
 */
export function recordAnswer(record: PracticeRecord) {
  if (!useAuthStore.getState().accessToken) return
  void apiClient.POST('/me/practice-records', { body: record }).catch(() => {})
}
