import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'

import { getDb } from '@/db'
import { profile, profileLinks } from '@/db/schema'
import { isAllowedUrl } from '@/lib/visit-input'
import { requireAdmin } from './auth'

/**
 * 公開地図の作者情報。
 * マルチユーザーサービスではないため、MVP では実質1レコード
 * （docs/02-concepts.md）。
 */

/** 1レコードしか持たないので ID を固定する。 */
const PROFILE_ID = 'profile_1'

export type ProfileLinkView = {
  id: string
  title: string
  url: string
}

export type ProfileView = {
  displayName: string
  bio: string | null
  /** Google ログインのプロフィール画像。アプリ側では読み取りのみ。 */
  avatarUrl: string | null
  links: Array<ProfileLinkView>
}

export const getProfile = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ProfileView | null> => {
    const db = getDb()

    const row = await db.query.profile.findFirst()
    if (!row) return null

    const links = await db
      .select()
      .from(profileLinks)
      .where(eq(profileLinks.profileId, row.id))
      .orderBy(asc(profileLinks.sortOrder))

    return {
      displayName: row.displayName,
      bio: row.bio,
      avatarUrl: row.googleAvatarUrl,
      links: links.map((link) => ({
        id: link.id,
        title: link.title,
        url: link.url,
      })),
    }
  },
)

export type ProfileInput = {
  displayName: string
  bio?: string
  links: Array<{ title: string; url: string }>
}

export type UpdateProfileResult =
  | { ok: true }
  | { ok: false; errors: Array<string> }

/**
 * プロフィール編集（管理者のみ）。
 * アイコンは編集させず、ログイン中の Google アカウントのものへ揃える。
 */
export const updateProfile = createServerFn({ method: 'POST' })
  .validator((input: ProfileInput) => input)
  .handler(async ({ data }): Promise<UpdateProfileResult> => {
    const session = await requireAdmin()

    const displayName = data.displayName.trim()
    const bio = data.bio?.trim()
    const links = data.links
      .map((link) => ({ title: link.title.trim(), url: link.url.trim() }))
      .filter((link) => link.title !== '' || link.url !== '')

    const errors: Array<string> = []
    if (!displayName) errors.push('名前を入力してください。')
    for (const link of links) {
      if (!link.title) errors.push('リンクのタイトルを入力してください。')
      if (!isAllowedUrl(link.url)) {
        errors.push('リンクは http / https の URL を入力してください。')
      }
    }
    if (errors.length > 0) return { ok: false, errors: [...new Set(errors)] }

    const db = getDb()
    const now = new Date().toISOString()
    const existing = await db.query.profile.findFirst()
    const profileId = existing?.id ?? PROFILE_ID

    const statements: Array<BatchItem<'sqlite'>> = [
      existing
        ? db
            .update(profile)
            .set({
              displayName,
              bio: bio || null,
              googleAvatarUrl: session.avatarUrl ?? existing.googleAvatarUrl,
              updatedAt: now,
            })
            .where(eq(profile.id, profileId))
        : db.insert(profile).values({
            id: profileId,
            displayName,
            bio: bio || null,
            googleAvatarUrl: session.avatarUrl ?? null,
            createdAt: now,
            updatedAt: now,
          }),
      // リンクは差分更新せず入れ直す。順序の維持と削除の扱いが単純になる。
      db.delete(profileLinks).where(eq(profileLinks.profileId, profileId)),
    ]

    for (const [index, link] of links.entries()) {
      statements.push(
        db.insert(profileLinks).values({
          id: crypto.randomUUID(),
          profileId,
          title: link.title,
          url: link.url,
          sortOrder: index,
          createdAt: now,
          updatedAt: now,
        }),
      )
    }

    await db.batch(
      statements as [BatchItem<'sqlite'>, ...Array<BatchItem<'sqlite'>>],
    )

    return { ok: true }
  })
