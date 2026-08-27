import { useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'

import { refetchOgp } from '@/server/visits'
import type { PlaceDetailLink } from '@/server/places'

type ExternalLinkCardProps = {
  link: PlaceDetailLink
  isAdmin: boolean
  onRefetched: () => void
}

/**
 * Visit から外部の記憶へ戻る入口。
 *
 * OGP が取れていれば画像つきカード、取れていなければ
 * ユーザー指定タイトルと hostname のシンプルなリンクにする
 * （docs/04-ui-spec.md）。どちらも常に別タブで開く。
 */
export function ExternalLinkCard({
  link,
  isAdmin,
  onRefetched,
}: ExternalLinkCardProps) {
  const [refetching, setRefetching] = useState(false)

  const hasCard = Boolean(link.ogTitle || link.ogImageUrl || link.ogSiteName)
  const label = link.ogTitle ?? link.title
  const site = link.ogSiteName ?? hostnameOf(link.url)

  return (
    <div className="relative">
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-lg border border-border transition-colors hover:bg-secondary"
      >
        {hasCard ? (
          <>
            {link.ogImageUrl ? (
              <img
                src={link.ogImageUrl}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="aspect-[1.91/1] w-full bg-secondary object-cover"
              />
            ) : null}
            <div className="p-3">
              <p className="line-clamp-2 text-sm font-medium">{label}</p>
              {link.ogDescription ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {link.ogDescription}
                </p>
              ) : null}
              <p className="mt-1.5 text-xs text-muted-foreground">{site}</p>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 p-3">
            <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block truncate text-sm">{link.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {site}
              </span>
            </span>
          </div>
        )}
      </a>

      {isAdmin ? (
        <button
          type="button"
          disabled={refetching}
          onClick={async () => {
            setRefetching(true)
            try {
              await refetchOgp({ data: { linkId: link.id } })
              onRefetched()
            } finally {
              setRefetching(false)
            }
          }}
          aria-label="OGP を再取得"
          title="OGP を再取得"
          className="absolute right-2 top-2 rounded-md bg-background/90 p-1.5 text-muted-foreground shadow-sm transition-colors hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={refetching ? 'size-3.5 animate-spin' : 'size-3.5'} />
        </button>
      ) : null}
    </div>
  )
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
