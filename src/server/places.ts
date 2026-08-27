import { createServerFn } from '@tanstack/react-start'
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lte,
  or,
  sql,
  type SQLWrapper,
} from 'drizzle-orm'

import { getDb } from '@/db'
import { places, visitLinks, visits } from '@/db/schema'
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

export type PlaceDetailLink = {
  id: string
  url: string
  title: string
  ogTitle: string | null
  ogDescription: string | null
  ogImageUrl: string | null
  ogSiteName: string | null
  /** null なら未取得。OGP カードではなく通常リンクで表示する。 */
  ogFetchedAt: string | null
}

export type PlaceDetailVisit = {
  id: string
  visitedDate: string
  title: string | null
  noteMarkdown: string | null
  links: Array<PlaceDetailLink>
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

export type OwnPlaceResult = {
  id: string
  name: string
  address: string | null
  visitCount: number
  /** どこがヒットしたか。UI で理由を出すために返す。 */
  matchedIn: 'place' | 'visit'
}

/**
 * 自分が登録済みの Place を検索する。
 *
 * 対象は Place 名・Visit タイトル・Visit メモ本文（docs/01-product-spec.md）。
 * MVP では LIKE で始める。件数が増えて必要になったら FTS5 等へ移す
 * （docs/05-data-model.md）。
 *
 * 公開の読み取りなので認可は不要。ただし Visit が 0 件の Place は
 * 返さない（innerJoin により自然にそうなる）。
 */
export const searchOwnPlaces = createServerFn({ method: 'GET' })
  .validator((input: { query: string }) => ({ query: String(input.query ?? '') }))
  .handler(async ({ data }): Promise<Array<OwnPlaceResult>> => {
    const query = data.query.trim()
    if (query.length < 1) return []

    const db = getDb()
    // LIKE のワイルドカードを打ち込まれても素通ししない。
    // エスケープした以上、比較側にも必ず ESCAPE 句を付ける
    // （片方だけだとバックスラッシュが literal 扱いされて挙動がずれる）。
    const pattern = `%${query.replace(/[%_\\]/g, (c) => `\\${c}`)}%`
    const matches = (column: SQLWrapper) =>
      sql`${column} like ${pattern} escape '\\'`

    const rows = await db
      .select({
        id: places.id,
        name: places.name,
        address: places.address,
        /*
         * WHERE で絞った結果を数えると「一致した Visit の数」になってしまう。
         * UI に出すのは Place の訪問回数なので、相関サブクエリで全件を数える。
         */
        visitCount: sql<number>`(select count(*) from ${visits} where ${visits.placeId} = ${places.id})`,
        placeMatch: sql<number>`max(case when ${matches(places.name)} then 1 else 0 end)`,
      })
      .from(places)
      .innerJoin(visits, eq(visits.placeId, places.id))
      .where(
        or(
          matches(places.name),
          matches(visits.title),
          matches(visits.noteMarkdown),
        ),
      )
      .groupBy(places.id)
      .limit(8)

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      visitCount: row.visitCount,
      matchedIn: row.placeMatch ? 'place' : 'visit',
    }))
  })

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

    // リンクは Visit ごとに引かず、まとめて取ってから振り分ける
    const linkRows = await db
      .select()
      .from(visitLinks)
      .where(
        inArray(
          visitLinks.visitId,
          visitRows.map((v) => v.id),
        ),
      )
      .orderBy(asc(visitLinks.sortOrder))

    const linksByVisit = new Map<string, Array<PlaceDetailLink>>()
    for (const link of linkRows) {
      const list = linksByVisit.get(link.visitId) ?? []
      list.push({
        id: link.id,
        url: link.url,
        title: link.title,
        ogTitle: link.ogTitle,
        ogDescription: link.ogDescription,
        ogImageUrl: link.ogImageUrl,
        ogSiteName: link.ogSiteName,
        ogFetchedAt: link.ogFetchedAt,
      })
      linksByVisit.set(link.visitId, list)
    }

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
      visits: visitRows.map((visit) => ({
        ...visit,
        links: linksByVisit.get(visit.id) ?? [],
      })),
    }
  })
