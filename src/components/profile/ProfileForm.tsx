import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { updateProfile, type ProfileView } from '@/server/profile'

type ProfileFormProps = {
  profile: ProfileView | null
  fallbackName: string
  onSaved: () => void
}

/**
 * プロフィール編集（`/admin`）。
 * アイコンは Google ログインの画像を使うため、ここでは編集させない
 * （docs/01-product-spec.md）。
 */
export function ProfileForm({
  profile,
  fallbackName,
  onSaved,
}: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(
    profile?.displayName ?? fallbackName,
  )
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [links, setLinks] = useState(
    profile?.links.map((link) => ({ title: link.title, url: link.url })) ?? [],
  )
  const [errors, setErrors] = useState<Array<string>>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const updateLink = (index: number, patch: Partial<{ title: string; url: string }>) => {
    setLinks((prev) =>
      prev.map((link, i) => (i === index ? { ...link, ...patch } : link)),
    )
  }

  return (
    <form
      className="mt-6 border-t border-border pt-6"
      onSubmit={async (event) => {
        event.preventDefault()
        setSaving(true)
        setSaved(false)
        try {
          const result = await updateProfile({
            data: { displayName, bio, links },
          })
          if (result.ok) {
            setErrors([])
            setSaved(true)
            onSaved()
          } else {
            setErrors(result.errors)
          }
        } finally {
          setSaving(false)
        }
      }}
    >
      <h2 className="text-sm font-semibold">プロフィール</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        公開地図に表示されます。アイコンは Google アカウントのものを使います。
      </p>

      <label className="mt-4 block">
        <span className="text-sm font-medium">名前</span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="mt-3 block">
        <span className="text-sm font-medium">自己紹介</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          placeholder="任意"
          className={`${inputClass} min-h-20 resize-y`}
        />
      </label>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">外部リンク</span>
          <button
            type="button"
            onClick={() => setLinks((prev) => [...prev, { title: '', url: '' }])}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Plus className="size-3.5" />
            追加
          </button>
        </div>

        <ul className="mt-2 space-y-2">
          {links.map((link, index) => (
            <li key={index} className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  type="text"
                  value={link.title}
                  onChange={(e) => updateLink(index, { title: e.target.value })}
                  placeholder="タイトル"
                  className={inputClass}
                />
                <input
                  type="url"
                  value={link.url}
                  onChange={(e) => updateLink(index, { url: e.target.value })}
                  placeholder="https://..."
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                onClick={() => setLinks((prev) => prev.filter((_, i) => i !== index))}
                aria-label="このリンクを削除"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {errors.length > 0 ? (
        <ul className="mt-4 space-y-1">
          {errors.map((error) => (
            <li key={error} className="text-sm text-destructive">
              {error}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? '保存中…' : '保存'}
        </button>
        {saved ? (
          <span className="text-sm text-muted-foreground">保存しました</span>
        ) : null}
      </div>
    </form>
  )
}

const inputClass =
  'mt-1.5 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-foreground/40'
