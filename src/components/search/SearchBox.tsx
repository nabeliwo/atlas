import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, Search, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { searchExternalPlaces } from '@/server/visits'
import { searchOwnPlaces, type OwnPlaceResult } from '@/server/places'
import type { PlaceCandidate } from '@/server/place-search'

type SearchBoxProps = {
  /** 管理者だけが外部施設検索を使える。 */
  isAdmin: boolean
  /** 登録済みの Place を選んだとき。地図を寄せて詳細を開く。 */
  onSelectOwnPlace: (placeId: string) => void
  /** 外部施設を選んだとき。Visit 追加フォームへ進む。 */
  onSelectCandidate: (candidate: PlaceCandidate) => void
}

/**
 * 検索欄。
 *
 * 「自分の Places」と「外部施設検索」の2セクションを1つのUIで扱う
 * （docs/04-ui-spec.md）。結果は視覚的に分離する。
 *
 * 自分の Place 検索は誰でも使える。外部施設検索は新しい Visit を
 * 追加するための導線なので、管理者のときだけ問い合わせる。
 */
export function SearchBox({
  isAdmin,
  onSelectOwnPlace,
  onSelectCandidate,
}: SearchBoxProps) {
  const [query, setQuery] = useState('')
  const [own, setOwn] = useState<Array<OwnPlaceResult>>([])
  const [results, setResults] = useState<Array<PlaceCandidate>>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef(new Map<number, HTMLButtonElement>())

  /**
   * キーボードで辿るための、セクションをまたいだ通し番号。
   * 「登録した場所」→「施設を検索」の順で並べる（画面の並びと一致させる）。
   */
  const [activeIndex, setActiveIndex] = useState(-1)

  // 自分のデータは自前のDBなので、1文字から即座に引く
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 1) {
      setOwn([])
      return
    }

    let cancelled = false
    const timer = setTimeout(() => {
      void searchOwnPlaces({ data: { query: trimmed } })
        .then((found) => {
          if (!cancelled) setOwn(found)
        })
        .catch(() => {
          if (!cancelled) setOwn([])
        })
    }, 150)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  // 外部APIは打鍵ごとに叩かない（無料枠の消費を抑える）
  useEffect(() => {
    const trimmed = query.trim()
    if (!isAdmin || trimmed.length < 2) {
      setResults([])
      setFailed(false)
      return
    }

    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      void searchExternalPlaces({ data: { query: trimmed } })
        .then((found) => {
          if (cancelled) return
          setResults(found)
          setFailed(false)
        })
        .catch(() => {
          if (!cancelled) setFailed(true)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(timer)
      setLoading(false)
    }
  }, [query, isAdmin])

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

  type Item =
    | { kind: 'own'; place: OwnPlaceResult }
    | { kind: 'candidate'; candidate: PlaceCandidate }

  const items: Array<Item> = [
    ...own.map((place) => ({ kind: 'own' as const, place })),
    ...(isAdmin
      ? results.map((candidate) => ({ kind: 'candidate' as const, candidate }))
      : []),
  ]

  const choose = (item: Item) => {
    if (item.kind === 'own') onSelectOwnPlace(item.place.id)
    else onSelectCandidate(item.candidate)
    setOpen(false)
    setQuery('')
  }

  // 候補が入れ替わったら選択位置を戻す
  useEffect(() => {
    setActiveIndex(-1)
  }, [query])

  // キーボードで動かしたとき、選択中の項目が隠れないようにする
  useEffect(() => {
    if (activeIndex < 0) return
    itemRefs.current.get(activeIndex)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (items.length === 0) return
      event.preventDefault()
      setOpen(true)

      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((prev) => {
        const next = prev + delta
        // 端で止めずに巻き戻す。候補が少ないので行き止まりの方が煩わしい。
        if (next < 0) return items.length - 1
        if (next >= items.length) return 0
        return next
      })
      return
    }

    if (event.key === 'Enter') {
      const item = items[activeIndex]
      if (!item) return
      // 選択中の候補があるときだけ、フォーム送信より優先して確定する
      event.preventDefault()
      choose(item)
    }
  }

  const showResults = open && query.trim().length >= 1

  return (
    <div className="relative w-[min(320px,calc(100vw-2rem))]" ref={rootRef}>
      <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3.5 py-2 shadow-sm">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
          role="combobox"
          aria-expanded={showResults}
          aria-controls="search-results"
          aria-activedescendant={
            activeIndex >= 0 ? `search-item-${activeIndex}` : undefined
          }
          placeholder="場所を検索"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {loading ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="検索をクリア"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {showResults ? (
        <div
          id="search-results"
          role="listbox"
          className="absolute top-full left-0 z-20 mt-2 max-h-[70dvh] w-full overflow-y-auto rounded-xl border border-border bg-background shadow-lg"
        >
          <p className="sticky top-0 border-b border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground">
            登録した場所
          </p>
          {own.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              一致する場所はありません。
            </p>
          ) : (
            <ul>
              {own.map((place, index) => (
                <li key={place.id}>
                  <button
                    type="button"
                    id={`search-item-${index}`}
                    role="option"
                    aria-selected={activeIndex === index}
                    ref={(node) => {
                      if (node) itemRefs.current.set(index, node)
                      else itemRefs.current.delete(index)
                    }}
                    onPointerMove={() => setActiveIndex(index)}
                    onClick={() => choose({ kind: 'own', place })}
                    className={cn(
                      'flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors',
                      activeIndex === index ? 'bg-secondary' : 'hover:bg-secondary',
                    )}
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {place.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        訪問 {place.visitCount} 回
                        {place.matchedIn === 'visit' ? '・記録が一致' : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!isAdmin ? null : (
          <>
          <p className="sticky top-0 border-y border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground">
            施設を検索
          </p>

          {failed ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              検索に失敗しました。時間をおいて試してください。
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              {loading ? '検索中…' : '見つかりませんでした。'}
            </p>
          ) : (
            <ul>
              {results.map((candidate, offset) => {
                const index = own.length + offset
                return (
                <li key={candidate.providerPlaceId}>
                  <button
                    type="button"
                    id={`search-item-${index}`}
                    role="option"
                    aria-selected={activeIndex === index}
                    ref={(node) => {
                      if (node) itemRefs.current.set(index, node)
                      else itemRefs.current.delete(index)
                    }}
                    onPointerMove={() => setActiveIndex(index)}
                    onClick={() => choose({ kind: 'candidate', candidate })}
                    className={cn(
                      'flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors',
                      activeIndex === index ? 'bg-secondary' : 'hover:bg-secondary',
                    )}
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {candidate.name}
                      </span>
                      {/*
                        同じ施設が複数返ることがあるため、住所とカテゴリを
                        併記して人間が見分けられるようにする。
                      */}
                      {candidate.address ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {candidate.address}
                        </span>
                      ) : null}
                      {candidate.category ? (
                        <span className="mt-0.5 inline-block rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {candidate.category}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
                )
              })}
            </ul>
          )}
          </>
          )}
        </div>
      ) : null}
    </div>
  )
}
