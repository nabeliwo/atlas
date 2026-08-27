import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'

import { MapView } from '@/components/map/MapView'
import { PlacePanel } from '@/components/place/PlacePanel'
import { DateRangeFilter } from '@/components/filter/DateRangeFilter'
import { SearchBox } from '@/components/search/SearchBox'
import { ProfileBadge } from '@/components/profile/ProfileBadge'
import { Panel } from '@/components/panel/Panel'
import { VisitForm } from '@/components/visit/VisitForm'
import { SimilarPlaceConfirm } from '@/components/visit/SimilarPlaceConfirm'
import { isDateOnly, isEmptyRange, type DateRange } from '@/lib/date-range'
import type { VisitInput } from '@/lib/visit-input'
import { getIsAdmin } from '@/server/admin'
import { getProfile } from '@/server/profile'
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
import type { PlaceSuggestion } from '@/server/place-search'

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
  loader: async ({ deps }) => {
    // 互いに独立なので直列に待たない
    const [places, isAdmin, profile] = await Promise.all([
      getMapPlaces({ data: deps }),
      getIsAdmin(),
      getProfile(),
    ])
    return { places, isAdmin, profile }
  },
  component: HomePage,
})

/** パネルに何を出しているか。地図は常に見えたまま切り替わる。 */
type PanelMode =
  | { kind: 'none' }
  | { kind: 'confirm-similar'; suggestion: PlaceSuggestion; similar: SimilarPlace }
  | {
      kind: 'create'
      suggestion?: PlaceSuggestion
      placeId?: string
      placeName: string
      placeAddress?: string | null
    }
  | { kind: 'edit'; visit: PlaceDetailVisit; placeName: string }

function HomePage() {
  const { places, isAdmin, profile } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const router = useRouter()

  const range: DateRange = { from: search.from, to: search.to }
  const filtered = !isEmptyRange(range)

  // loader が返した集合から数えるだけなので、クエリは増やさない
  const visitTotal = places.reduce((sum, place) => sum + place.visitCount, 0)

  const [detail, setDetail] = useState<PlaceDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailFailed, setDetailFailed] = useState(false)
  const [mode, setMode] = useState<PanelMode>({ kind: 'none' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formNotice, setFormNotice] = useState<string | null>(null)
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
    setDetailFailed(false)

    void getPlaceDetail({ data: { placeId, from: search.from, to: search.to } })
      .then((result) => {
        if (!cancelled) setDetail(result)
      })
      .catch(() => {
        if (!cancelled) setDetailFailed(true)
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
  const handleSelectCandidate = useCallback(async (suggestion: PlaceSuggestion) => {
    setFormError(null)
    setFormNotice(null)
    setSearchError(null)

    let similar: Array<SimilarPlace> = []
    try {
      similar = await findSimilarPlaces({ data: { suggestion } })
    } catch {
      // 確認できなくても追加自体は続けられるようにする
      setSearchError('登録済みの場所との照合に失敗しました。')
    }

    const first = similar[0]
    if (first) {
      setMode({ kind: 'confirm-similar', suggestion, similar: first })
      return
    }

    setMode({
      kind: 'create',
      suggestion,
      placeName: suggestion.name,
      placeAddress: suggestion.address,
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
            suggestion: mode.suggestion,
            visit: input,
          },
        })

        if (result.ok) {
          setMode({ kind: 'none' })
          setFormNotice(null)
          await refresh()
          selectPlace(result.placeId, result.visitId)
          return
        }

        if (result.reason === 'duplicate-date') {
          // 同じ日の Visit は作らず、既存の編集へ誘導する（docs/03-user-flows.md）。
          // 期間フィルターに関係なく引き当てたいので range は渡さない。
          const existing = await getPlaceDetail({
            data: { placeId: result.placeId },
          })
          const target = existing?.visits.find((v) => v.id === result.visitId)

          if (existing && target) {
            setFormError(null)
            setFormNotice(
              'その日の訪問はすでに登録されています。既存の記録を開きました。編集して保存できます。',
            )
            setMode({ kind: 'edit', visit: target, placeName: existing.name })
            selectPlace(result.placeId, result.visitId)
            return
          }

          setFormError('その日の訪問はすでに登録されています。')
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
          setFormNotice(null)
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

  /** 検索から外部施設を選ぶ処理は外部APIに依存するので、失敗を握りつぶさない */
  const [searchError, setSearchError] = useState<string | null>(null)

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView
        places={places}
        selectedPlaceId={search.place}
        onSelectPlace={(placeId) => selectPlace(placeId)}
      />

      {/* 操作系は左に集約する。右は Place 詳細パネルが使う。 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-start gap-2 p-4">
        {/*
          検索は誰でも使える。登録済みの Place を引く用途は公開機能で、
          外部施設検索のセクションだけが管理者に出る。
        */}
        <div className="pointer-events-auto">
          <SearchBox
            isAdmin={isAdmin}
            onSelectOwnPlace={(placeId) => selectPlace(placeId)}
            onSelectCandidate={handleSelectCandidate}
          />
        </div>
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <DateRangeFilter value={range} onChange={changeRange} />
          {/*
            期間で絞ったときだけ件数を出す。全期間では地図そのものが
            答えなので、常時出すとクロームが増えるだけになる。
          */}
          {filtered ? (
            <p className="rounded-full bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
              {places.length === 0
                ? 'この期間の訪問はありません'
                : `${places.length}か所・${visitTotal}回の訪問`}
            </p>
          ) : null}
        </div>

        {/*
          まだ1件も無いとき、地図に何も出ないままだと状態が伝わらない。
          期間で0件になった場合はフィルターの件数表示が理由を示すので、
          ここでは全期間で空のときだけ出す。
        */}
        {!filtered && places.length === 0 ? (
          <p className="pointer-events-auto rounded-lg border border-border bg-background/95 px-3 py-2 text-sm text-muted-foreground shadow-sm">
            {isAdmin
              ? '訪れた場所を検索して、最初の記録を追加してみてください。'
              : 'まだ記録された場所がありません。'}
          </p>
        ) : null}

        {/* 作者情報。地図の邪魔にならないよう、操作系の下に小さく置く。 */}
        {profile ? (
          <div className="pointer-events-auto">
            <ProfileBadge profile={profile} />
          </div>
        ) : null}
      </div>

      {mode.kind === 'confirm-similar' ? (
        <SimilarPlaceConfirm
          suggestion={mode.suggestion}
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
              suggestion: mode.suggestion,
              placeName: mode.suggestion.name,
              placeAddress: mode.suggestion.address,
            })
          }
        />
      ) : mode.kind === 'create' ? (
        <Panel defaultExpanded onClose={() => setMode({ kind: 'none' })}>
          <VisitForm
            placeName={mode.placeName}
            placeAddress={mode.placeAddress}
            submitLabel="保存"
            submitting={submitting}
            serverError={formError ?? searchError}
            notice={formNotice}
            onSubmit={handleCreate}
            onCancel={() => setMode({ kind: 'none' })}
          />
        </Panel>
      ) : mode.kind === 'edit' ? (
        <Panel defaultExpanded onClose={() => setMode({ kind: 'none' })}>
          <VisitForm
            placeName={mode.placeName}
            initialValue={{
              visitedDate: mode.visit.visitedDate,
              title: mode.visit.title ?? '',
              noteMarkdown: mode.visit.noteMarkdown ?? '',
              links: mode.visit.links.map((link) => ({
                url: link.url,
                title: link.title,
              })),
            }}
            submitLabel="更新"
            submitting={submitting}
            serverError={formError}
            notice={formNotice}
            onSubmit={handleUpdate}
            onCancel={() => setMode({ kind: 'none' })}
          />
        </Panel>
      ) : search.place ? (
        <PlacePanel
          detail={detail}
          loading={detailLoading}
          failed={detailFailed}
          filtered={filtered}
          highlightVisitId={search.visit}
          isAdmin={isAdmin}
          onClose={() => selectPlace(undefined)}
          onAddVisit={() => {
            if (!detail) return
            setFormError(null)
            setFormNotice(null)
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
            setFormNotice(null)
            setMode({ kind: 'edit', visit, placeName: detail.name })
          }}
          onDeleteVisit={handleDelete}
          onRefresh={() => setDetailVersion((v) => v + 1)}
        />
      ) : null}
    </main>
  )
}
