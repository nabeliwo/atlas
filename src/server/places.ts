import { createServerFn } from '@tanstack/react-start'
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'

import { getDb } from '@/db'
import { places, visits } from '@/db/schema'
import { parseDateRange, type DateRange } from '@/lib/date-range'

/** 地図に描画する1件分。返す量を絞る（詳細はパネルを開いたときに取りに行く）。 */
export type MapPlace = {
  id: string
  name: string
  latitude: number
  longitude: number
  /** 期間フィルター適用後の Visit 回数。ピンの視覚的な強さに使う。 */
  visitCount: number
}

function visitedDateFilter(range: DateRange) {
  const conditions = [
    range.from ? gte(visits.visitedDate, range.from) : undefined,
    range.to ? lte(visits.visitedDate, range.to) : undefined,
  ].filter((c) => c !== undefined)

  return conditions.length > 0 ? and(...conditions) : undefined
}

/**
 * 地図に出す Place 一覧。
 *
 * innerJoin にしているのが重要で、これにより
 * 「期間内に1件以上 Visit がある Place」だけが返る。
 * Visit 0件の Place を公開UIに出さないという不変条件が、そのまま満たされる。
 */
export const getMapPlaces = createServerFn({ method: 'GET' })
  .validator((input: DateRange) => parseDateRange(input))
  .handler(async ({ data: range }): Promise<Array<MapPlace>> => {
    const db = getDb()

    const rows = await db
      .select({
        id: places.id,
        name: places.name,
        latitude: places.latitude,
        longitude: places.longitude,
        visitCount: sql<number>`count(${visits.id})`,
      })
      .from(places)
      .innerJoin(visits, eq(visits.placeId, places.id))
      .where(visitedDateFilter(range))
      .groupBy(places.id)

    return rows
  })

export type PlaceDetailVisit = {
  id: string
  visitedDate: string
  title: string | null
  noteMarkdown: string | null
}

export type PlaceDetail = {
  id: string
  name: string
  address: string | null
  latitude: number
  longitude: number
  /** 期間フィルター適用後の統計 */
  visitCount: number
  firstVisitedDate: string | null
  lastVisitedDate: string | null
  /** 全期間の Visit 数。期間で絞られていることをUIで伝えるために返す。 */
  totalVisitCount: number
  /** 新しい順（docs/02-concepts.md） */
  visits: Array<PlaceDetailVisit>
}

/**
 * Place 詳細。
 * 期間フィルターは「地図上の集計全体」に効くので、詳細パネルの統計と
 * Visit 履歴にも同じ range を適用する。
 */
export const getPlaceDetail = createServerFn({ method: 'GET' })
  .validator((input: { placeId: string } & DateRange) => ({
    placeId: String(input.placeId),
    ...parseDateRange(input),
  }))
  .handler(async ({ data }): Promise<PlaceDetail | null> => {
    const db = getDb()
    const range = { from: data.from, to: data.to }

    const place = await db.query.places.findFirst({
      where: eq(places.id, data.placeId),
    })
    if (!place) return null

    const visitRows = await db
      .select({
        id: visits.id,
        visitedDate: visits.visitedDate,
        title: visits.title,
        noteMarkdown: visits.noteMarkdown,
      })
      .from(visits)
      .where(and(eq(visits.placeId, data.placeId), visitedDateFilter(range)))
      .orderBy(desc(visits.visitedDate))

    // Visit が1件も無い Place は公開UIに存在しない扱いにする
    if (visitRows.length === 0) return null

    const [totals] = await db
      .select({ total: sql<number>`count(*)` })
      .from(visits)
      .where(eq(visits.placeId, data.placeId))

    const [oldest] = await db
      .select({ visitedDate: visits.visitedDate })
      .from(visits)
      .where(and(eq(visits.placeId, data.placeId), visitedDateFilter(range)))
      .orderBy(asc(visits.visitedDate))
      .limit(1)

    return {
      id: place.id,
      name: place.name,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      visitCount: visitRows.length,
      firstVisitedDate: oldest?.visitedDate ?? null,
      lastVisitedDate: visitRows[0]?.visitedDate ?? null,
      totalVisitCount: totals?.total ?? visitRows.length,
      visits: visitRows,
    }
  })
