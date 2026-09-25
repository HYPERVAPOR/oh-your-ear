import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { apiClient } from '@/api/client'
import { Avatar } from '@/components/avatar'
import { isUploadedAvatar, prepareAvatar, type AvatarProblem } from '@/lib/avatar'
import { useAuthStore } from '@/stores/auth-store'

/** One sentence per refusal, so the reader learns what to pick instead. */
const PROBLEM_KEY: Record<AvatarProblem, string> = {
  type: 'auth.avatarWrongType',
  size: 'auth.avatarTooBig',
  small: 'auth.avatarTooSmall',
  shape: 'auth.avatarTooLopsided',
  broken: 'auth.avatarUnreadable',
}

/**
 * The account's picture, and the one control that changes it: clicking the picture chooses
 * a file (there is no separate upload button — the thing being replaced is the thing you
 * click). What is checked before the request is everything the API would refuse anyway, so
 * a wrong pick costs nothing; the API is still the judge.
 *
 * The caption line under the picture is always there, empty when it has nothing to say:
 * the space a refusal needs is the space it keeps.
 */
export function AvatarPicker() {
  const { t } = useTranslation('common')
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (!user) return null

  async function upload(file: File) {
    setBusy(true)
    setMessage(null)
    try {
      const prepared = await prepareAvatar(file)
      if (prepared.problem) {
        setMessage(t(PROBLEM_KEY[prepared.problem]))
        return
      }

      const form = new FormData()
      form.append('file', new File([prepared.blob], 'avatar.jpg', { type: 'image/jpeg' }))

      const { data, error } = await apiClient.POST('/me/avatar', {
        // The generated type calls the binary part a string; what actually goes on the
        // wire is the FormData below (openapi-fetch leaves the content type to the
        // browser when the serialized body is FormData, which is what carries the
        // boundary).
        body: { file: '' },
        bodySerializer: () => form,
      })
      if (error || !data) throw new Error('upload refused')
      setUser(data)
    } catch {
      setMessage(t('auth.avatarFailed'))
    } finally {
      setBusy(false)
      // Let the same file be chosen again after a failure.
      if (input.current) input.current.value = ''
    }
  }

  async function remove() {
    setBusy(true)
    setMessage(null)
    try {
      const { error } = await apiClient.DELETE('/me/avatar')
      if (error) throw new Error('remove refused')
      // Read the account back: without the upload there may still be a provider picture.
      const { data } = await apiClient.GET('/auth/me')
      if (data) setUser(data)
    } catch {
      setMessage(t('auth.avatarFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-start gap-1.5">
      <button
        type="button"
        className="cursor-pointer disabled:cursor-default disabled:opacity-50"
        aria-label={t('auth.avatarUpload')}
        title={t('auth.avatarUpload')}
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <Avatar user={user} size="lg" />
      </button>

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg"
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
        }}
      />

      <p className="min-h-[20px] text-[13px] text-muted">
        {message ??
          (isUploadedAvatar(user.avatarUrl) && (
            <button
              type="button"
              className="cursor-pointer underline underline-offset-4 hover:text-ink disabled:cursor-default disabled:opacity-50"
              disabled={busy}
              onClick={() => void remove()}
            >
              {t('auth.avatarRemove')}
            </button>
          ))}
      </p>
    </div>
  )
}
