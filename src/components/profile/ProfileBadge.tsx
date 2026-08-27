import { useEffect, useRef, useState } from 'react'
import { ExternalLink, User } from 'lucide-react'

import type { ProfileView } from '@/server/profile'

/**
 * 公開地図の作者情報。
 *
 * 地図の邪魔にならない場所に小さく表示し、プロフィール画面を
 * 主役にしない（docs/04-ui-spec.md）。
 * 普段はアイコンと名前だけ、押したときに bio とリンクを出す。
 */
export function ProfileBadge({ profile }: { profile: ProfileView }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const hasDetails = Boolean(profile.bio || profile.links.length > 0)

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        aria-expanded={hasDetails ? open : undefined}
        className="flex max-w-[240px] items-center gap-2 rounded-full border border-border bg-background py-1.5 pr-3 pl-1.5 text-sm shadow-sm transition-colors hover:bg-secondary"
      >
        <Avatar profile={profile} className="size-6" />
        <span className="truncate">{profile.displayName}</span>
      </button>

      {open ? (
        <div className="absolute top-full left-0 z-20 mt-2 w-[280px] rounded-xl border border-border bg-background p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <Avatar profile={profile} className="size-10" />
            <p className="min-w-0 truncate font-medium">{profile.displayName}</p>
          </div>

          {profile.bio ? (
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">
              {profile.bio}
            </p>
          ) : null}

          {profile.links.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {profile.links.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ExternalLink className="size-3.5 shrink-0" />
                    <span className="truncate">{link.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Avatar({
  profile,
  className,
}: {
  profile: ProfileView
  className: string
}) {
  if (profile.avatarUrl) {
    return (
      <img
        src={profile.avatarUrl}
        alt=""
        // Google の画像は referrer を送ると弾かれることがある
        referrerPolicy="no-referrer"
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    )
  }

  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground`}
    >
      <User className="size-3.5" />
    </span>
  )
}
