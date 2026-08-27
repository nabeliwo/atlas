import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'

import { MapView } from '@/components/map/MapView'
import { PlacePanel } from '@/components/place/PlacePanel'
import { DateRangeFilter } from '@/components/filter/DateRangeFilter'
import { SearchBox } from '@/components/search/SearchBox'
import { Panel } from '@/components/panel/Panel'
import { VisitForm } from '@/components/visit/VisitForm'
import { SimilarPlaceConfirm } from '@/components/visit/SimilarPlaceConfirm'
import { isDateOnly, isEmptyRange, type DateRange } from '@/lib/date-range'
import type { VisitInput } from '@/lib/visit-input'
import { getIsAdmin } from '@/server/admin'
import {
  getMapPlaces,
  getPlaceDetail,
  type PlaceDetail,
  type PlaceDetailVisit,
} from '@/server/places'
import {
  createVisit,
  deleteVisit,
  findSimilarPlaces,
  updateVisit,
  type SimilarPlace,
} from '@/server/visits'
import type { PlaceCandidate } from '@/server/place-search'

/**
 * 地図の状態を URL クエリで表現する（docs/01-product-spec.md）。
 * - `?place=` で Place 詳細を開いた状態を共有できる
 * - `?visit=` で特定の Visit まで辿り着ける
 * - `?from=` / `?to=` は期間フィルター
 *
 * 追加・編集フォームは共有する対象ではないので URL には出さない。
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
  loader: async ({ deps }) => ({
    places: await getMapPlaces({ data: deps }),
    isAdmin: await getIsAdmin(),
  }),
  component: HomePage,
})

/** パネルに何を出しているか。地図は常に見えたまま切り替わる。 */
type PanelMode =
  | { kind: 'none' }
  | { kind: 'confirm-similar'; candidate: PlaceCandidate; similar: SimilarPlace }
  | { kind: 'create'; candidate?: PlaceCandidate; placeId?: string; placeName: string; placeAddress?: string | null }
  | { kind: 'edit'; visit: PlaceDetailVisit; placeName: string }

function HomePage() {
  const { places, isAdmin } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const router = useRouter()

  const range: DateRange = { from: search.from, to: search.to }
  const filtered = !isEmptyRange(range)

  const [detail, setDetail] = useState<PlaceDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [mode, setMode] = useState<PanelMode>({ kind: 'none' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [detailVersion, setDetailVersion] = useState(0)

  const selectPlace = useCallback(
    (placeId: string | undefined, visitId?: string) => {
      void navigate({
        search: (prev) => ({ ...prev, place: placeId, visit: visitId }),
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

  // 選択中の Place の詳細。`?place=` を直接開いた場合もここを通る。
  useEffect(() => {
    const placeId = search.place
    if (!placeId) {
      setDetail(null)
      return
    }

    let cancelled = false
    setDetailLoading(true)

    void getPlaceDetail({ data: { placeId, from: search.from, to: search.to } })
      .then((result) => {
        if (!cancelled) setDetail(result)
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [search.place, search.from, search.to, detailVersion])

  /** 書き込み後に地図と詳細を最新化する。 */
  const refresh = useCallback(async () => {
    await router.invalidate()
    setDetailVersion((v) => v + 1)
  }, [router])

  /** 検索で外部施設を選んだとき。同名近接があれば確認を挟む。 */
  const handleSelectCandidate = useCallback(async (candidate: PlaceCandidate) => {
    const similar = await findSimilarPlaces({ data: { candidate } })
    const first = similar[0]

    if (first) {
      setMode({ kind: 'confirm-similar', candidate, similar: first })
      return
    }
    setFormError(null)
    setMode({
      kind: 'create',
      candidate,
      placeName: candidate.name,
      placeAddress: candidate.address,
    })
  }, [])

  const handleCreate = useCallback(
    async (input: VisitInput) => {
      if (mode.kind !== 'create') return
      setSubmitting(true)
      setFormError(null)

      try {
        const result = await createVisit({
          data: {
            placeId: mode.placeId,
            candidate: mode.candidate,
            visit: input,
          },
        })

        if (result.ok) {
          setMode({ kind: 'none' })
          await refresh()
          selectPlace(result.placeId, result.visitId)
          return
        }

        if (result.reason === 'duplicate-date') {
          // 同じ日の Visit は作らず、既存の編集へ誘導する（docs/03-user-flows.md）
          setFormError(
            'その日の訪問はすでに登録されています。既存の訪問を開きました。',
          )
          setMode({ kind: 'none' })
          await refresh()
          selectPlace(result.placeId, result.visitId)
          return
        }

        setFormError(result.errors.join(' '))
      } finally {
        setSubmitting(false)
      }
    },
    [mode, refresh, selectPlace],
  )

  const handleUpdate = useCallback(
    async (input: VisitInput) => {
      if (mode.kind !== 'edit') return
      setSubmitting(true)
      setFormError(null)

      try {
        const result = await updateVisit({
          data: { visitId: mode.visit.id, visit: input },
        })

        if (result.ok) {
          setMode({ kind: 'none' })
          await refresh()
          return
        }

        setFormError(
          result.reason === 'duplicate-date'
            ? 'その日の訪問はすでに登録されています。別の日付にしてください。'
            : result.errors.join(' '),
        )
      } finally {
        setSubmitting(false)
      }
    },
    [mode, refresh],
  )

  const handleDelete = useCallback(
    async (visit: PlaceDetailVisit) => {
      const result = await deleteVisit({ data: { visitId: visit.id } })
      await refresh()

      // Visit が 0 件になった Place は地図から消えるので、パネルも閉じる
      if (result?.placeRemoved) selectPlace(undefined)
    },
    [refresh, selectPlace],
  )

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView
        places={places}
        selectedPlaceId={search.place}
        onSelectPlace={(placeId) => selectPlace(placeId)}
      />

      {/* 操作系は左に集約する。右は Place 詳細パネルが使う。 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-start gap-2 p-4">
        {/* 検索は外部施設検索を含むため、現時点では管理者にだけ見せる */}
        {isAdmin ? (
          <div className="pointer-events-auto">
            <SearchBox onSelectCandidate={handleSelectCandidate} />
          </div>
        ) : null}
        <div className="pointer-events-auto">
          <DateRangeFilter value={range} onChange={changeRange} />
        </div>
      </div>

      {mode.kind === 'confirm-similar' ? (
        <SimilarPlaceConfirm
          candidate={mode.candidate}
          similar={mode.similar}
          onClose={() => setMode({ kind: 'none' })}
          onUseExisting={() =>
            setMode({
              kind: 'create',
              placeId: mode.similar.id,
              placeName: mode.similar.name,
              placeAddress: mode.similar.address,
            })
          }
          onCreateNew={() =>
            setMode({
              kind: 'create',
              candidate: mode.candidate,
              placeName: mode.candidate.name,
              placeAddress: mode.candidate.address,
            })
          }
        />
      ) : mode.kind === 'create' ? (
        <Panel onClose={() => setMode({ kind: 'none' })}>
          <VisitForm
            placeName={mode.placeName}
            placeAddress={mode.placeAddress}
            submitLabel="保存"
            submitting={submitting}
            serverError={formError}
            onSubmit={handleCreate}
            onCancel={() => setMode({ kind: 'none' })}
          />
        </Panel>
      ) : mode.kind === 'edit' ? (
        <Panel onClose={() => setMode({ kind: 'none' })}>
          <VisitForm
            placeName={mode.placeName}
            initialValue={{
              visitedDate: mode.visit.visitedDate,
              title: mode.visit.title ?? '',
              noteMarkdown: mode.visit.noteMarkdown ?? '',
              links: [],
            }}
            submitLabel="更新"
            submitting={submitting}
            serverError={formError}
            onSubmit={handleUpdate}
            onCancel={() => setMode({ kind: 'none' })}
          />
        </Panel>
      ) : search.place ? (
        <PlacePanel
          detail={detail}
          loading={detailLoading}
          filtered={filtered}
          highlightVisitId={search.visit}
          isAdmin={isAdmin}
          onClose={() => selectPlace(undefined)}
          onAddVisit={() => {
            if (!detail) return
            setFormError(null)
            setMode({
              kind: 'create',
              placeId: detail.id,
              placeName: detail.name,
              placeAddress: detail.address,
            })
          }}
          onEditVisit={(visit) => {
            if (!detail) return
            setFormError(null)
            setMode({ kind: 'edit', visit, placeName: detail.name })
          }}
          onDeleteVisit={handleDelete}
        />
      ) : null}
    </main>
  )
}
