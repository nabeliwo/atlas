import { relations, sql } from 'drizzle-orm'
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

const timestamps = {
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
}

/**
 * Place は施設・スポットそのもの。
 * ユーザーが直接作るものではなく、Visit を追加した結果として必要なら作られる。
 * 中身は外部施設検索サービスのスナップショットで、人が書く情報は持たない。
 */
export const places = sqliteTable(
  'places',
  {
    id: text('id').primaryKey(),

    provider: text('provider').notNull(),
    providerPlaceId: text('provider_place_id').notNull(),

    name: text('name').notNull(),
    latitude: real('latitude').notNull(),
    longitude: real('longitude').notNull(),

    address: text('address'),
    countryCode: text('country_code'),
    region: text('region'),
    city: text('city'),
    category: text('category'),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('places_provider_place_id_unique').on(
      table.provider,
      table.providerPlaceId,
    ),
    index('places_name_idx').on(table.name),
  ],
)

/**
 * Visit は「特定の日にその Place へ行った」という記録。
 * このアプリでユーザーが実際に作る中心データ。
 *
 * 不変条件のうち「noteMarkdown か externalLinks のどちらかが必要」は
 * 別テーブル参照が必要で DB CHECK にできないため、アプリケーション層で保証する。
 */
export const visits = sqliteTable(
  'visits',
  {
    id: text('id').primaryKey(),
    placeId: text('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),

    /** YYYY-MM-DD。時刻は持たない（timezone で日付がずれない設計） */
    visitedDate: text('visited_date').notNull(),
    title: text('title'),
    noteMarkdown: text('note_markdown'),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('visits_place_id_visited_date_unique').on(
      table.placeId,
      table.visitedDate,
    ),
    index('visits_visited_date_idx').on(table.visitedDate),
    index('visits_place_id_idx').on(table.placeId),
  ],
)

/** Visit から外部の記憶へ戻る入口。特定サービス専用にはしない汎用モデル。 */
export const visitLinks = sqliteTable(
  'visit_links',
  {
    id: text('id').primaryKey(),
    visitId: text('visit_id')
      .notNull()
      .references(() => visits.id, { onDelete: 'cascade' }),

    url: text('url').notNull(),
    /** ユーザー指定タイトル。OGP が取れなくても表示できるよう必須。 */
    title: text('title').notNull(),

    ogTitle: text('og_title'),
    ogDescription: text('og_description'),
    ogImageUrl: text('og_image_url'),
    ogSiteName: text('og_site_name'),
    ogFetchedAt: text('og_fetched_at'),

    sortOrder: integer('sort_order').notNull().default(0),

    ...timestamps,
  },
  (table) => [index('visit_links_visit_id_idx').on(table.visitId)],
)

/** 公開地図の作者情報。マルチユーザーではないため MVP では実質1レコード。 */
export const profile = sqliteTable('profile', {
  id: text('id').primaryKey(),

  displayName: text('display_name').notNull(),
  bio: text('bio'),
  /** Google ログインのプロフィール画像。読み取り専用。 */
  googleAvatarUrl: text('google_avatar_url'),

  ...timestamps,
})

export const profileLinks = sqliteTable(
  'profile_links',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profile.id, { onDelete: 'cascade' }),

    title: text('title').notNull(),
    url: text('url').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),

    ...timestamps,
  },
  (table) => [index('profile_links_profile_id_idx').on(table.profileId)],
)

export const placesRelations = relations(places, ({ many }) => ({
  visits: many(visits),
}))

export const visitsRelations = relations(visits, ({ one, many }) => ({
  place: one(places, {
    fields: [visits.placeId],
    references: [places.id],
  }),
  links: many(visitLinks),
}))

export const visitLinksRelations = relations(visitLinks, ({ one }) => ({
  visit: one(visits, {
    fields: [visitLinks.visitId],
    references: [visits.id],
  }),
}))

export const profileRelations = relations(profile, ({ many }) => ({
  links: many(profileLinks),
}))

export const profileLinksRelations = relations(profileLinks, ({ one }) => ({
  profile: one(profile, {
    fields: [profileLinks.profileId],
    references: [profile.id],
  }),
}))

export type Place = typeof places.$inferSelect
export type Visit = typeof visits.$inferSelect
export type VisitLink = typeof visitLinks.$inferSelect
export type Profile = typeof profile.$inferSelect
export type ProfileLink = typeof profileLinks.$inferSelect
