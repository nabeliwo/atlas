# Data Model

D1 (SQLite) + Drizzle を想定。

具体的なカラム型は実装時にDrizzle/D1へ合わせて調整してよいが、概念と制約は変えない。

## places

```ts
type Place = {
  id: string
  provider: string
  providerPlaceId: string

  name: string
  latitude: number
  longitude: number

  address?: string
  countryCode?: string
  region?: string
  city?: string
  category?: string

  createdAt: string
  updatedAt: string
}
```

### Constraints

- UNIQUE(provider, providerPlaceId)
- latitude/longitude required
- Place情報は外部施設検索結果のスナップショット
- ユーザー編集用メモ・リンクは持たない

## visits

```ts
type Visit = {
  id: string
  placeId: string

  visitedDate: string // YYYY-MM-DD
  title?: string
  noteMarkdown?: string

  createdAt: string
  updatedAt: string
}
```

### Constraints

- UNIQUE(placeId, visitedDate)
- placeId FK -> places.id
- `noteMarkdown != empty OR externalLinks.count > 0`

最後の条件はDB CHECKだけではlinks別テーブルを参照できないため、アプリケーションレイヤーで必ず保証する。

## visit_links

```ts
type VisitLink = {
  id: string
  visitId: string

  url: string
  title: string

  ogTitle?: string
  ogDescription?: string
  ogImageUrl?: string
  ogSiteName?: string
  ogFetchedAt?: string

  sortOrder: number

  createdAt: string
  updatedAt: string
}
```

### Constraints

- visitId FK -> visits.id
- URL required
- title required
- sortOrderでユーザー指定順を保持

## profile

MVPでは1レコード。

```ts
type Profile = {
  id: string

  displayName: string
  bio?: string
  googleAvatarUrl?: string

  createdAt: string
  updatedAt: string
}
```

## profile_links

```ts
type ProfileLink = {
  id: string
  profileId: string

  title: string
  url: string
  sortOrder: number

  createdAt: string
  updatedAt: string
}
```

## auth tables

Better Auth等、採用ライブラリの推奨schemaに従う。

ただしアプリ側では「管理者1名のみ」という制約を別途持つ。

例:
- `ADMIN_GOOGLE_EMAIL` をsecret/envで指定
- OAuth成功後にemail一致を必ず確認
- 一致しないGoogleアカウントには管理権限を与えない

## Delete behavior

推奨:

- Visit削除
- 同一transaction内で残Visit数確認
- 0件ならPlaceを削除

理由:
- DBに孤児Placeを残さず、検索も単純になる

ただし、外部providerPlaceIdの履歴保持など明確な理由が出た場合はsoft/orphan保持でもよい。
UI仕様としては「Visit 0件のPlaceは存在しない」にする。

## Query requirements

### Map query

入力:
- optional from
- optional to
- viewport/bounds or zoomに応じた最適化は将来検討

返却:
- place id
- name
- lat/lng
- filtered visit count

### Place detail

- Place
- total/filtered visit stats（UI文脈に応じる）
- Visits newest first
- VisitLinks sortOrder順

### Search own data

検索対象:
- places.name
- visits.title
- visits.noteMarkdown

MVPではLIKE等から始めてよい。
件数増加時にSQLite FTS5などへ移行可能。

## Date

`visitedDate` は時刻を持たない。

DB上も日付文字列（ISO YYYY-MM-DD）として扱える設計を優先。

timezone変換で日付がずれる構造を避ける。
