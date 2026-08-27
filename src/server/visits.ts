import { createServerFn } from '@tanstack/react-start'
import { and, eq, ne, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'

import { getDb } from '@/db'
import { places, visitLinks, visits } from '@/db/schema'
import {
  normalizeVisitInput,
  validateVisitInput,
  type VisitInput,
} from '@/lib/visit-input'
import { requireAdmin } from './auth'
import { getPlaceSearchProvider, type PlaceCandidate } from './place-search'

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

      if (existing) {
        placeId = existing.id
      } else {
        placeId = crypto.randomUUID()
        statements.push(
          db.insert(places).values({
            id: placeId,
            provider: candidate.provider,
            providerPlaceId: candidate.providerPlaceId,
            name: candidate.name,
            latitude: candidate.latitude,
            longitude: candidate.longitude,
            address: candidate.address,
            countryCode: candidate.countryCode,
            region: candidate.region,
            city: candidate.city,
            category: candidate.category,
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

    for (const [index, link] of input.links.entries()) {
      statements.push(
        db.insert(visitLinks).values({
          id: crypto.randomUUID(),
          visitId,
          url: link.url,
          title: link.title,
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
      statements.push(
        db.insert(visitLinks).values({
          id: crypto.randomUUID(),
          visitId: data.visitId,
          url: link.url,
          title: link.title,
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

/** 外部施設検索。API キーは server 側に閉じ、クライアントへ渡さない。 */
export const searchExternalPlaces = createServerFn({ method: 'GET' })
  .validator((input: { query: string }) => ({ query: String(input.query ?? '') }))
  .handler(async ({ data }): Promise<Array<PlaceCandidate>> => {
    await requireAdmin()

    if (data.query.trim().length < 2) return []

    const provider = getPlaceSearchProvider()
    return provider.search(data.query, { limit: 8 })
  })
