import { createServerFn } from '@tanstack/react-start'
import { and, eq, gte, lte, ne, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'

import { getDb } from '@/db'
import { distanceInMeters, normalizePlaceName } from '@/lib/geo'
import { places, visitLinks, visits } from '@/db/schema'
import {
  normalizeVisitInput,
  validateVisitInput,
  type VisitInput,
} from '@/lib/visit-input'
import { requireAdmin } from './auth'
import { getPlaceSearchProvider, type PlaceCandidate } from './place-search'
import { fetchOgp } from './ogp/fetch-ogp'

/**
 * write 系はすべてここに置く。
 * 例外なく requireAdmin() を先頭で呼ぶこと（docs/06-technical-design.md）。
 *
 * D1 は対話的トランザクションを持たないため、複数文の原子性は db.batch() で担保する。
 * Place の作成と Visit の作成が別々に成功して片方だけ残る、という状態を作らない。
 */

export type SaveVisitResult =
  | { ok: true; placeId: string; visitId: string }
  /** 同じ Place の同じ日に既に Visit がある。新規作成せず既存の編集へ誘導する。 */
  | { ok: false; reason: 'duplicate-date'; placeId: string; visitId: string }
  | { ok: false; reason: 'invalid'; errors: Array<string> }

type CreateVisitPayload = {
  /** 既存 Place への再訪 */
  placeId?: string
  /** 未登録施設からの追加。Place は裏側で作られる。 */
  candidate?: PlaceCandidate
  visit: VisitInput
}

function now() {
  return new Date().toISOString()
}

/**
 * 同一施設とみなす距離のしきい値。
 *
 * Geoapify は OSM 由来のため、1つの実在の場所に対して複数のフィーチャを返す。
 * 例: 「清澄庭園」で leisure.park / commercial.tickets / rental.bicycle の
 * 3件が同名で返り、別々に選ぶと同じ場所に複数の Place ができてしまう。
 * これは「同一施設は同一Place」（docs/02-concepts.md）に反する。
 *
 * ただし実測では、同名の2フィーチャが 133m 離れている例があった
 * （清澄庭園の leisure.park と rental.bicycle）。しきい値を 150m 以上に
 * 広げれば拾えるが、都心では同名の別店舗が 150m 以内に共存しうるため、
 * 誤って統合してしまう。誤統合は地図から気づきにくく、直すには DB を
 * 手で触る必要があり、取り違えより厄介。
 *
 * そこで二段構えにする。
 *   - 50m 以内: ほぼ確実に同一施設なので黙って統合する
 *   - 50〜250m: 判断できないので、保存前にユーザーへ確認する
 */
const SAME_PLACE_RADIUS_METERS = 50
const CONFIRM_SAME_PLACE_RADIUS_METERS = 250

/** 緯度1度 ≒ 111km。しきい値をカバーする程度に粗く箱で絞ってから距離を測る。 */
const BBOX_DELTA_DEGREES = 0.004

/**
 * リンクの OGP をまとめて取得する。
 *
 * 取得の失敗は Visit の保存失敗にしない（docs/06-technical-design.md）。
 * リンク自体は保存し、カードは fallback 表示になる。
 * 1リンクずつ直列に待つと保存が遅くなるので並行に投げる。
 */
async function resolveOgp(links: Array<{ url: string; title: string }>) {
  return Promise.all(
    links.map(async (link) => {
      const ogp = await fetchOgp(link.url).catch(() => null)
      return {
        ...link,
        ogTitle: ogp?.title ?? null,
        ogDescription: ogp?.description ?? null,
        ogImageUrl: ogp?.imageUrl ?? null,
        ogSiteName: ogp?.siteName ?? null,
        // 取得を試みた事実を残す。null のままなら未試行と区別できる。
        ogFetchedAt: ogp ? new Date().toISOString() : null,
      }
    }),
  )
}

/**
 * providerPlaceId は違うが、実質同じ施設を指している既存 Place を探す。
 * SQLite に地理関数が無いため、緯度経度の矩形で候補を絞ってから距離を計算する。
 */
async function findSamePlaceNearby(
  db: ReturnType<typeof getDb>,
  candidate: PlaceCandidate,
  radiusMeters: number = SAME_PLACE_RADIUS_METERS,
) {
  const nearby = await db
    .select()
    .from(places)
    .where(
      and(
        gte(places.latitude, candidate.latitude - BBOX_DELTA_DEGREES),
        lte(places.latitude, candidate.latitude + BBOX_DELTA_DEGREES),
        gte(places.longitude, candidate.longitude - BBOX_DELTA_DEGREES),
        lte(places.longitude, candidate.longitude + BBOX_DELTA_DEGREES),
      ),
    )

  const targetName = normalizePlaceName(candidate.name)

  return (
    nearby.find(
      (place) =>
        normalizePlaceName(place.name) === targetName &&
        distanceInMeters(place, candidate) <= radiusMeters,
    ) ?? null
  )
}

/**
 * Visit を追加する。
 * 未登録施設が渡された場合は Place を同じ batch の中で作る。
 * ユーザーから見て「Place を作る」操作は存在しない。
 */
export const createVisit = createServerFn({ method: 'POST' })
  .validator((input: CreateVisitPayload) => input)
  .handler(async ({ data }): Promise<SaveVisitResult> => {
    await requireAdmin()

    const errors = validateVisitInput(data.visit)
    if (errors.length > 0) {
      return { ok: false, reason: 'invalid', errors: errors.map((e) => e.message) }
    }

    const input = normalizeVisitInput(data.visit)
    const db = getDb()
    const statements: Array<BatchItem<'sqlite'>> = []

    let placeId = data.placeId

    if (!placeId) {
      const candidate = data.candidate
      if (!candidate) {
        return { ok: false, reason: 'invalid', errors: ['場所が指定されていません。'] }
      }

      // 同一施設は同一 Place。既に登録済みなら再利用する。
      const existing = await db.query.places.findFirst({
        where: and(
          eq(places.provider, candidate.provider),
          eq(places.providerPlaceId, candidate.providerPlaceId),
        ),
      })

      // providerPlaceId が違っても、同名かつ至近距離なら同じ施設とみなす
      const sameFacility = existing ?? (await findSamePlaceNearby(db, candidate))

      if (sameFacility) {
        placeId = sameFacility.id
      } else {
        /*
         * 保存する直前に provider から取り直す。
         *
         * 検索は「検索語に一致した名前」を返すため、例えば「渋谷PARCO」で
         * 引くと 'Shibuya Parco' になる。詳細取得は正規の名前
         * （渋谷パルコ）を返すので、地図に残る名前が安定する。
         *
         * クライアントから渡された候補をそのまま信用せずに済む、という
         * 副次的な効果もある。取得に失敗したら候補をそのまま使う。
         */
        const snapshot =
          (await getPlaceSearchProvider()
            .getById(candidate.providerPlaceId)
            .catch(() => null)) ?? candidate

        placeId = crypto.randomUUID()
        statements.push(
          db.insert(places).values({
            id: placeId,
            provider: candidate.provider,
            providerPlaceId: candidate.providerPlaceId,
            name: snapshot.name,
            latitude: snapshot.latitude,
            longitude: snapshot.longitude,
            address: snapshot.address,
            countryCode: snapshot.countryCode,
            region: snapshot.region,
            city: snapshot.city,
            category: snapshot.category,
            createdAt: now(),
            updatedAt: now(),
          }),
        )
      }
    }

    // 1 Place につき1日1Visit。重複は作らず、既存を編集させる。
    const duplicate = await db.query.visits.findFirst({
      where: and(
        eq(visits.placeId, placeId),
        eq(visits.visitedDate, input.visitedDate),
      ),
    })
    if (duplicate) {
      return {
        ok: false,
        reason: 'duplicate-date',
        placeId,
        visitId: duplicate.id,
      }
    }

    const visitId = crypto.randomUUID()
    statements.push(
      db.insert(visits).values({
        id: visitId,
        placeId,
        visitedDate: input.visitedDate,
        title: input.title,
        noteMarkdown: input.noteMarkdown,
        createdAt: now(),
        updatedAt: now(),
      }),
    )

    const resolved = await resolveOgp(input.links)
    for (const [index, link] of resolved.entries()) {
      statements.push(
        db.insert(visitLinks).values({
          id: crypto.randomUUID(),
          visitId,
          url: link.url,
          title: link.title,
          ogTitle: link.ogTitle,
          ogDescription: link.ogDescription,
          ogImageUrl: link.ogImageUrl,
          ogSiteName: link.ogSiteName,
          ogFetchedAt: link.ogFetchedAt,
          sortOrder: index,
          createdAt: now(),
          updatedAt: now(),
        }),
      )
    }

    await db.batch(statements as [BatchItem<'sqlite'>, ...Array<BatchItem<'sqlite'>>])

    return { ok: true, placeId, visitId }
  })

/**
 * Visit を編集する。
 * リンクは差分更新せず、一度消してから入れ直す。
 * 並び順の維持と削除の扱いが単純になり、件数も高々数件のため。
 */
export const updateVisit = createServerFn({ method: 'POST' })
  .validator((input: { visitId: string; visit: VisitInput }) => input)
  .handler(async ({ data }): Promise<SaveVisitResult> => {
    await requireAdmin()

    const errors = validateVisitInput(data.visit)
    if (errors.length > 0) {
      return { ok: false, reason: 'invalid', errors: errors.map((e) => e.message) }
    }

    const input = normalizeVisitInput(data.visit)
    const db = getDb()

    const current = await db.query.visits.findFirst({
      where: eq(visits.id, data.visitId),
    })
    if (!current) {
      return { ok: false, reason: 'invalid', errors: ['対象の訪問が見つかりません。'] }
    }

    // 日付を変更した結果、同じ Place の別 Visit と衝突する場合
    const duplicate = await db.query.visits.findFirst({
      where: and(
        eq(visits.placeId, current.placeId),
        eq(visits.visitedDate, input.visitedDate),
        ne(visits.id, data.visitId),
      ),
    })
    if (duplicate) {
      return {
        ok: false,
        reason: 'duplicate-date',
        placeId: current.placeId,
        visitId: duplicate.id,
      }
    }

    // URL が変わっていないリンクは OGP を取り直さない。
    // 外部サイトへの不要なリクエストを減らすため。
    const existingLinks = await db
      .select()
      .from(visitLinks)
      .where(eq(visitLinks.visitId, data.visitId))
    const ogpByUrl = new Map(existingLinks.map((link) => [link.url, link]))

    const newUrls = input.links.filter((link) => !ogpByUrl.has(link.url))
    const fetched = new Map(
      (await resolveOgp(newUrls)).map((link) => [link.url, link]),
    )

    const statements: Array<BatchItem<'sqlite'>> = [
      db
        .update(visits)
        .set({
          visitedDate: input.visitedDate,
          title: input.title ?? null,
          noteMarkdown: input.noteMarkdown ?? null,
          updatedAt: now(),
        })
        .where(eq(visits.id, data.visitId)),
      db.delete(visitLinks).where(eq(visitLinks.visitId, data.visitId)),
    ]

    for (const [index, link] of input.links.entries()) {
      const ogp = ogpByUrl.get(link.url) ?? fetched.get(link.url)
      statements.push(
        db.insert(visitLinks).values({
          id: crypto.randomUUID(),
          visitId: data.visitId,
          url: link.url,
          title: link.title,
          ogTitle: ogp?.ogTitle ?? null,
          ogDescription: ogp?.ogDescription ?? null,
          ogImageUrl: ogp?.ogImageUrl ?? null,
          ogSiteName: ogp?.ogSiteName ?? null,
          ogFetchedAt: ogp?.ogFetchedAt ?? null,
          sortOrder: index,
          createdAt: now(),
          updatedAt: now(),
        }),
      )
    }

    await db.batch(statements as [BatchItem<'sqlite'>, ...Array<BatchItem<'sqlite'>>])

    return { ok: true, placeId: current.placeId, visitId: data.visitId }
  })

export type DeleteVisitResult = {
  placeId: string
  /** この削除で Place が地図から消えたか。UI はパネルを閉じる判断に使う。 */
  placeRemoved: boolean
}

/**
 * Visit を削除する。
 * 残 Visit が 0 件になった Place は削除する（docs/05-data-model.md）。
 * 孤児 Place を残さないことで、地図クエリと検索が単純なままになる。
 */
export const deleteVisit = createServerFn({ method: 'POST' })
  .validator((input: { visitId: string }) => input)
  .handler(async ({ data }): Promise<DeleteVisitResult | null> => {
    await requireAdmin()

    const db = getDb()
    const current = await db.query.visits.findFirst({
      where: eq(visits.id, data.visitId),
    })
    if (!current) return null

    const [remaining] = await db
      .select({ count: sql<number>`count(*)` })
      .from(visits)
      .where(and(eq(visits.placeId, current.placeId), ne(visits.id, data.visitId)))

    const placeRemoved = (remaining?.count ?? 0) === 0

    const statements: Array<BatchItem<'sqlite'>> = [
      db.delete(visits).where(eq(visits.id, data.visitId)),
    ]
    if (placeRemoved) {
      statements.push(db.delete(places).where(eq(places.id, current.placeId)))
    }

    await db.batch(statements as [BatchItem<'sqlite'>, ...Array<BatchItem<'sqlite'>>])

    return { placeId: current.placeId, placeRemoved }
  })

export type SimilarPlace = {
  id: string
  name: string
  address: string | null
  distanceMeters: number
  visitCount: number
}

/**
 * 保存前の確認用。
 * 同名で 50〜250m 以内にある既存 Place を返す。自動では統合できない距離なので、
 * 「同じ場所として追加するか、別の場所として登録するか」をユーザーに選ばせる。
 * 該当が無ければ空配列を返し、フォームは確認を挟まずに保存へ進む。
 */
export const findSimilarPlaces = createServerFn({ method: 'GET' })
  .validator((input: { candidate: PlaceCandidate }) => input)
  .handler(async ({ data }): Promise<Array<SimilarPlace>> => {
    await requireAdmin()

    const db = getDb()
    const candidate = data.candidate

    // providerPlaceId が完全一致するなら、そもそも確認は要らない
    const exact = await db.query.places.findFirst({
      where: and(
        eq(places.provider, candidate.provider),
        eq(places.providerPlaceId, candidate.providerPlaceId),
      ),
    })
    if (exact) return []

    const near = await findSamePlaceNearby(
      db,
      candidate,
      CONFIRM_SAME_PLACE_RADIUS_METERS,
    )
    // 50m 以内は createVisit が黙って統合するので、確認は不要
    if (!near || distanceInMeters(near, candidate) <= SAME_PLACE_RADIUS_METERS) {
      return []
    }

    const [stats] = await db
      .select({ count: sql<number>`count(*)` })
      .from(visits)
      .where(eq(visits.placeId, near.id))

    return [
      {
        id: near.id,
        name: near.name,
        address: near.address,
        distanceMeters: Math.round(distanceInMeters(near, candidate)),
        visitCount: stats?.count ?? 0,
      },
    ]
  })

/**
 * OGP の手動再取得（管理者のみ）。
 * リンク先のページが更新された場合や、登録時に取得できなかった場合に使う。
 */
export const refetchOgp = createServerFn({ method: 'POST' })
  .validator((input: { linkId: string }) => input)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    await requireAdmin()

    const db = getDb()
    const link = await db.query.visitLinks.findFirst({
      where: eq(visitLinks.id, data.linkId),
    })
    if (!link) return { ok: false }

    const ogp = await fetchOgp(link.url)
    if (!ogp) return { ok: false }

    await db
      .update(visitLinks)
      .set({
        ogTitle: ogp.title ?? null,
        ogDescription: ogp.description ?? null,
        ogImageUrl: ogp.imageUrl ?? null,
        ogSiteName: ogp.siteName ?? null,
        ogFetchedAt: new Date().toISOString(),
        updatedAt: now(),
      })
      .where(eq(visitLinks.id, data.linkId))

    return { ok: true }
  })

/** 外部施設検索。API キーは server 側に閉じ、クライアントへ渡さない。 */
export const searchExternalPlaces = createServerFn({ method: 'GET' })
  .validator((input: { query: string }) => ({ query: String(input.query ?? '') }))
  .handler(async ({ data }): Promise<Array<PlaceCandidate>> => {
    await requireAdmin()

    if (data.query.trim().length < 2) return []

    const provider = getPlaceSearchProvider()
    return provider.search(data.query, { limit: 8 })
  })
