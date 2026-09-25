import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { apiClient } from '@/api/client'
import { Button, buttonVariants } from '@/components/ui/button'
import { isUploadedAvatar, scaleToAvatar } from '@/lib/avatar'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

/**
 * The two controls that change the avatar: upload one, or drop back to the account's
 * provider picture (or its generated one). The picture is squared and scaled to 256x256
 * here, before it is sent — the server stores it and never resizes anything.
 */
export function AvatarPicker() {
  const { t } = useTranslation('common')
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!user) return null

  async function upload(file: File) {
    setBusy(true)
    setFailed(false)
    try {
      const square = await scaleToAvatar(file)
      const form = new FormData()
      form.append('file', new File([square], 'avatar.jpg', { type: 'image/jpeg' }))

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
      setFailed(true)
    } finally {
      setBusy(false)
      // Let the same file be chosen again after a failure.
      if (input.current) input.current.value = ''
    }
  }

  async function remove() {
    setBusy(true)
    setFailed(false)
    try {
      const { error } = await apiClient.DELETE('/me/avatar')
      if (error) throw new Error('remove refused')
      // Read the account back: without the upload there may still be a provider picture.
      const { data } = await apiClient.GET('/auth/me')
      if (data) setUser(data)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          busy ? 'pointer-events-none opacity-50' : 'cursor-pointer',
        )}
      >
        {t('auth.avatarUpload')}
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
      </label>

      {isUploadedAvatar(user.avatarUrl) && (
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void remove()}>
          {t('auth.avatarRemove')}
        </Button>
      )}

      {failed && <p className="text-[13px] text-muted">{t('auth.avatarFailed')}</p>}
    </div>
  )
}
