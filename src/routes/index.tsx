import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { MapView } from '@/components/map/MapView'
import { PlacePanel } from '@/components/place/PlacePanel'
import { DateRangeFilter } from '@/components/filter/DateRangeFilter'
import { isDateOnly, isEmptyRange, type DateRange } from '@/lib/date-range'
import { getMapPlaces, getPlaceDetail, type PlaceDetail } from '@/server/places'

/**
 * 地図の状態を URL クエリで表現する（docs/01-product-spec.md）。
 * - `?place=` で Place 詳細を開いた状態を共有できる
 * - `?visit=` で特定の Visit まで辿り着ける
 * - `?from=` / `?to=` は期間フィルター
 */
type MapSearch = {
  place?: string
  visit?: string
  from?: string
  to?: string
}

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): MapSearch => ({
    place: typeof search.place === 'string' ? search.place : undefined,
    visit: typeof search.visit === 'string' ? search.visit : undefined,
    from: isDateOnly(search.from) ? search.from : undefined,
    to: isDateOnly(search.to) ? search.to : undefined,
  }),
  // 期間が変わったときだけ地図データを取り直す。Place の選択では取り直さない。
  loaderDeps: ({ search }) => ({ from: search.from, to: search.to }),
  loader: ({ deps }) => getMapPlaces({ data: deps }),
  component: HomePage,
})

/**
 * 公開URL `/` はそのまま地図。
 * 誰でも閲覧でき、一般閲覧者には管理者向けUIを一切見せない。
 */
function HomePage() {
  const places = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const range: DateRange = { from: search.from, to: search.to }
  const filtered = !isEmptyRange(range)

  const [detail, setDetail] = useState<PlaceDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const selectPlace = useCallback(
    (placeId: string | undefined) => {
      void navigate({
        search: (prev) => ({ ...prev, place: placeId, visit: undefined }),
        replace: true,
      })
    },
    [navigate],
  )

  const changeRange = useCallback(
    (next: DateRange) => {
      void navigate({
        search: (prev) => ({ ...prev, from: next.from, to: next.to }),
        replace: true,
      })
    },
    [navigate],
  )

  // 選択中の Place の詳細を取りに行く。
  // `?place=` を直接開いた場合もここを通る。
  useEffect(() => {
    const placeId = search.place
    if (!placeId) {
      setDetail(null)
      return
    }

    let cancelled = false
    setDetailLoading(true)

    void getPlaceDetail({ data: { placeId, ...range } })
      .then((result) => {
        if (!cancelled) setDetail(result)
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })

    return () => {
      cancelled = true
    }
    // range は from/to のプリミティブに依存させる
  }, [search.place, search.from, search.to])

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView
        places={places}
        selectedPlaceId={search.place}
        onSelectPlace={selectPlace}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end p-4">
        <div className="pointer-events-auto">
          <DateRangeFilter value={range} onChange={changeRange} />
        </div>
      </div>

      {search.place ? (
        <PlacePanel
          detail={detail}
          loading={detailLoading}
          filtered={filtered}
          highlightVisitId={search.visit}
          onClose={() => selectPlace(undefined)}
        />
      ) : null}
    </main>
  )
}
