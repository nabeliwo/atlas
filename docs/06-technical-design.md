# Technical Design

## Selected stack

- Framework: TanStack Start
- Runtime / Hosting: Cloudflare Workers
- Database: Cloudflare D1
- ORM: Drizzle ORM
- Map rendering: MapLibre GL JS
- Styling: Tailwind CSS
- UI primitives: shadcn/ui
- Auth: Better Auth + Google OAuth を第一候補
- Image storage: MVPでは不要
- External content: URL参照のみ
- OGP: Worker/server-sideで取得しD1キャッシュ

## Why Cloudflare

安価、できれば無料で運用することを優先しつつ、技術的に面白い構成を選ぶ。

2026-08時点のCloudflare公式料金では、Workers Freeは100,000 requests/day、D1 Freeは5 million rows read/day、100,000 rows written/day、5GB storage。個人プロダクトのMVPとして十分大きな余裕がある。

Refs:
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/

## TanStack Start on Workers

CloudflareはTanStack Start向け公式Workersガイドを提供している。

Cloudflare bindingsはserver-side codeから `cloudflare:workers` の `env` 経由で利用できる。

初期セットアップ候補:

```bash
npm create cloudflare@latest -- atlas --framework=tanstack-start
```

Ref:
- https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/

## Auth

第一候補: Better Auth + Google OAuth。

Better AuthにはTanStack Start統合ガイドとGoogle social providerサポートがある。

Refs:
- https://better-auth.com/docs/integrations/tanstack
- https://better-auth.com/docs/concepts/oauth

### Admin authorization

Authenticationだけでは不足。

必ず「このGoogleアカウントが唯一の管理者か」を判定する。

推奨:
- Cloudflare secret `ADMIN_GOOGLE_EMAIL`
- session emailと完全一致
- 管理系server functionで毎回authorization

一般閲覧者向けのログインUIは作らない。

## Facility search

MVPは無料優先。

当初はGeoapify（OpenStreetMap）を採用したが、個人経営の店の収録率が低く、
「記憶に残した場所」ほど取りこぼすことが分かったため Google Places API (New)
へ移行した（2026-08-28）。下の「検索品質が不十分ならGoogle Places等へ
差し替える」を実際に行使した形。

Google Places は SKU 単位の無料枠があり、Autocomplete と
Place Details Essentials がそれぞれ 10,000 calls/month。
施設名は autocomplete の予測テキストから取れるため、上位SKUの
displayName を使わずに済む。詳細取得は location と types だけを要求する。

外部検索は管理者のみが叩けるため、公開サイトでも課金は管理者の操作量に
比例する。あわせてGoogle Cloud側で日次の割り当て上限を無料枠未満に設定し、
超過が構造的に起きないようにしている。

Geoapifyの実装は残してあり、`PLACE_SEARCH_PROVIDER=geoapify` で戻せる。

Refs:
- https://developers.google.com/maps/billing-and-pricing/pricing
- https://www.geoapify.com/pricing/

### Abstraction requirement

検索providerは差し替え可能にする。

```ts
interface PlaceSearchProvider {
  search(query: string, context?: SearchContext): Promise<PlaceCandidate[]>
  getById(id: string): Promise<PlaceCandidate | null>
}
```

DBでは:
- provider
- providerPlaceId
を保存。

Geoapify固有レスポンスをdomain modelに漏らさない。

検索品質が不十分ならGoogle Places等へ差し替える。

## Map tiles

MapLibre自体とタイルproviderを分離する。

MVP:
- 無料サービスを利用
- 後から差し替え/自前ホスト可能にする

候補の一つとしてMapTiler Freeはpersonal/non-commercial用途向け無料プランを提供するが、公開形態や将来用途とのライセンス整合を実装前に確認する。

Ref:
- https://www.maptiler.com/cloud/pricing/

タイルprovider固有URLはconfigへ閉じ込める。

## MapLibre

必須:
- point source
- clustering
- cluster count = Place count
- filtered visit countに応じたpoint styling
- labels at appropriate zoom
- flyTo/easeTo for search/direct URL

期間変更時にGeoJSON/source dataを更新する。

## OGP fetching

Worker server-sideでURLをfetch。

### Security requirements

SSRF対策必須。

最低限:
- http/httpsのみ
- localhost禁止
- private IP ranges禁止
- link-local / metadata IP禁止
- redirect後も再検証
- response size limit
- timeout
- content-type考慮
- HTML全体を保存しない
- metaだけ抽出

Workers Freeは1 invocation 10ms CPU制約があるため、HTML parser選定や処理量に注意。

OGP取得がFree CPU制約で不安定な場合:
- fetch + 軽量meta抽出
- 必要ならPaid移行
を検討。

OGP失敗はVisit保存失敗にしない。
リンク自体は保存し、カードはfallback表示。

## Markdown

VisitメモはMarkdown。

表示時:
- sanitize必須
- arbitrary HTMLは無効化または安全なsubset
- XSSを防止

入力は軽量textarea + preview程度で十分。
本格WYSIWYGは不要。

## API / server functions

TanStack Startのserver functionsまたはserver routesを利用。

公開read:
- map places
- place detail
- search own places
- profile

管理write:
- create visit (+ maybe place)
- update visit
- delete visit
- refetch OGP
- update profile

すべてのwrite server-sideでadmin authorization。

## Caching

MVPでは過剰最適化しない。

候補:
- profile/public map readはHTTP cacheを検討
- OGPはDBキャッシュ
- external place searchは短期cache可能だが必須ではない

## Observability

最低限:
- Cloudflare Workers logs
- failed OGP fetch logs
- place provider request errors
- auth errors

Sentry等はMVP必須ではない。

## Costs

目標:
- Cloudflare Workers/D1: Free tier内
- place search: Free tier
- map tiles: Free plan
- R2: 不使用

有料化を検討する順:
1. 施設検索品質が不足
2. 地図タイルの利用規約/上限
3. Workers CPU/traffic
4. DB scale

## Environment variables / secrets

例:

```txt
DATABASE binding: DB

GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
ADMIN_GOOGLE_EMAIL
BETTER_AUTH_SECRET

PLACE_SEARCH_API_KEY
MAP_STYLE_URL / MAP_TILE_API_KEY
```

SecretsはWrangler/Cloudflare secretsに置き、クライアントへ露出させないものを明確に分ける。
