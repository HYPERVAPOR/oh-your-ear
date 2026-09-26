import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { apiClient } from '@/api/client'
import { Avatar, AvatarPreview } from '@/components/avatar'
import { prepareAvatar, type AvatarProblem } from '@/lib/avatar'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

/** One sentence per refusal, so the reader learns what to pick instead. */
const PROBLEM_KEY: Record<AvatarProblem, string> = {
  type: 'auth.avatarWrongType',
  size: 'auth.avatarTooBig',
  small: 'auth.avatarTooSmall',
  shape: 'auth.avatarTooLopsided',
  broken: 'auth.avatarUnreadable',
}

/** How the three things are set out at each size: the dashboard's card, and the account page. */
const SIZES = {
  md: {
    row: 'gap-3',
    name: 'text-[15px] break-words',
    email: 'text-[14px]',
    /** The card's title is the label above this, so the name is a paragraph there. */
    tag: 'p',
  },
  lg: {
    row: 'gap-4',
    name: 'font-display text-[28px] font-medium leading-tight sm:text-[32px]',
    email: 'mt-1.5 text-[15px]',
    /** On the account page the name is what the page is about, so it is the heading. */
    tag: 'h1',
  },
} as const

/**
 * The account's own three things — picture, name, address — in one object, because the
 * dashboard's card and the account page both show them and used to spell them differently.
 *
 * The first two are editable where they are shown. Clicking the picture opens it at its own size
 * — a picture is something you look at before deciding to replace it, and a click that lands in
 * a file picker cannot be taken back. Replacing it is the button on the caption line below, which
 * is always there, so the way to change the picture is never hidden behind the picture itself.
 * Clicking the name turns it into the field it is. An account that signed up with a code has no
 * name at all, so the third case is the invitation rather than a blank.
 *
 * The name is written optimistically: the field closes and the new word is on the card while the
 * request is still on its way, and the reader hears about it only if the server refuses.
 *
 * The caption line under the three is where the picture is replaced and where a refusal is said.
 * It is always there, empty when it has nothing to say — the space a refusal needs is the space
 * it keeps — and it sits below the row rather than inside it, so that the row's own bottom edge
 * is the address line. */
export function AccountIdentity({
  size = 'md',
  className,
}: {
  size?: keyof typeof SIZES
  className?: string
}) {
  const { t } = useTranslation('common')
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [draft, setDraft] = useState('')

  if (!user) return null

  const layout = SIZES[size]
  const Name = layout.tag

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

  async function saveName() {
    const next = draft.trim()
    // Nothing to save: an empty field goes back to what it was, and what the reader sees
    // afterwards is the same invitation to add a name they started from.
    if (!user || next === '' || next === (user.name ?? '')) {
      setEditing(false)
      return
    }

    const previous = user.name ?? null
    setMessage(null)
    // The field closes and the new name is on the card now, while the request is still on its
    // way: optimism nobody can see is not optimism.
    setEditing(false)
    setUser({ ...user, name: next })

    const { data, error } = await apiClient.PUT('/me/name', { body: { name: next } })

    if (error || !data) {
      // Only the name goes back: read the account as it is now, so a picture changed while
      // this request was in flight is not undone along with it.
      const current = useAuthStore.getState().user
      if (current) setUser({ ...current, name: previous })
      setMessage(t('account.nameFailed'))
      return
    }

    setUser(data)
  }

  return (
    <div className={className}>
      {/* Bottom-aligned: the picture's edge sits on the address line's, in both sizes and places. */}
      <div className={cn('flex items-end', layout.row)}>
        <div className="flex shrink-0 flex-col items-start gap-1.5">
          <button
            type="button"
            className="cursor-pointer"
            aria-label={t('auth.avatarPreview')}
            title={t('auth.avatarPreview')}
            onClick={() => setPreviewing(true)}
          >
            <Avatar user={user} size={size} />
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
        </div>

        <div className="min-w-0">
          <Name className={cn('break-all', layout.name)}>
            {editing ? (
              <input
                autoFocus
                // The ceiling the API enforces, so the round trip that would refuse it never happens.
                maxLength={50}
                value={draft}
                // An outline, not a border, and no padding: neither takes up space, so the field
                // is exactly the size of the name it replaced — no pixel of the row moves.
                className={cn(
                  'w-full max-w-[24ch] bg-transparent text-ink outline outline-1 -outline-offset-1 outline-hairline-strong focus:outline-ink',
                  layout.name,
                )}
                aria-label={t('account.editName')}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => void saveName()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void saveName()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setEditing(false)
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className={cn(
                  'cursor-pointer text-left',
                  user.name
                    ? 'underline-offset-4 hover:underline'
                    : 'text-muted underline decoration-dotted underline-offset-4',
                )}
                title={t('account.editName')}
                onClick={() => {
                  setDraft(user.name ?? '')
                  setEditing(true)
                }}
              >
                {user.name ?? t('account.addName')}
              </button>
            )}
          </Name>

          <p className={cn('break-all text-muted', layout.email)}>{user.email}</p>
        </div>
      </div>

      <p className="mt-1.5 min-h-[20px] text-[13px] text-muted">
        {message && <span className="mr-2">{message}</span>}
        <button
          type="button"
          className="cursor-pointer underline underline-offset-4 hover:text-ink disabled:cursor-default disabled:opacity-50"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {t('auth.avatarUpload')}
        </button>
      </p>

      <AvatarPreview open={previewing} user={user} onClose={() => setPreviewing(false)} />
    </div>
  )
}
