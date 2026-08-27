# Progress

Atlas の実装進捗を記録する唯一のドキュメント。
別セッション（Claude Code / Codex / 人間）から作業を再開するときは、まずこのファイルを読む。

## 使い方

1. 作業開始時: 「現在地」と直近フェーズのチェックリストを読む
2. 作業中: 完了した項目を `- [x]` にする
3. 作業終了時: 「現在地」と「作業ログ」を更新する
4. 仕様判断をしたら「決定ログ」に1行追加する
5. 詰まったら「未決事項 / ブロッカー」に書く

チェックリストは `docs/07-mvp-scope.md` の Definition of Done を、
`IMPLEMENTATION_PROMPT.md` の推奨実装順（Phase 1〜5）に割り付けたもの。
**チェックリストの追加は仕様追加ではない。** 要件にない項目を勝手に足さない。

---

## 現在地

- **現在フェーズ**: Phase 3 — 管理者と書き込み
- **状態**: Phase 3 実装完了（Google ログインの実地確認待ち）
- **最終更新**: 2026-08-27

`pnpm db:reset && pnpm dev` でローカル環境が立ち上がる（詳細は README「開発」）。

---

## Phase 1: プロジェクトセットアップ

- [x] TanStack Start + Cloudflare Workers プロジェクト初期化
- [x] Tailwind CSS セットアップ
- [x] shadcn/ui セットアップ
- [x] wrangler.jsonc / D1 binding (`DB`) 設定
- [x] Drizzle ORM セットアップ
- [x] schema 定義（places / visits / visit_links / profile / profile_links）
- [x] マイグレーション生成・ローカル適用
- [x] seed / dev fixtures
- [x] public map skeleton（`/` にMapLibreの世界地図が出るだけ）
- [x] 明るくミニマルな単一テーマ
- [x] 初期表示は世界全体

## Phase 2: 地図を主役にする

- [x] map places クエリ（期間フィルタ対応）
- [x] Placeを地図に表示
- [x] 広域でクラスタリング
- [x] クラスタ数字は Place 数
- [x] 個別Placeのフィルタ後Visit回数を視覚表現（サイズ等）
- [x] ズーム時にPlace名表示（ラベル衝突はMapLibreに任せる）
- [x] Place詳細サイドパネル（desktop）
- [x] Place詳細ボトムシート（mobile）
- [x] Place名・住所・訪問回数・初回・最終
- [x] Visit履歴 newest first
- [x] `?place=` 直接URL
- [x] `?place=&visit=` 直接URL
- [x] 期間プリセット（今年 / 去年 / 過去5年）
- [x] 自由なfrom/to期間指定
- [x] 期間に応じて Place / Visit count / cluster count 再計算

## Phase 3: 管理者と書き込み

- [x] Better Auth + Google OAuth
- [x] `/admin` でGoogleログイン
- [x] `ADMIN_GOOGLE_EMAIL` 完全一致による admin authorization
- [x] 全 write server function で毎回 authorization
- [x] 一般画面にログインボタンを出さない
- [x] ログイン時のみ管理UIを表示
- [x] `PlaceSearchProvider` 抽象化
- [x] 外部施設検索の実装（provider: Geoapify 候補）
- [x] 新規施設選択から Visit 追加
- [x] Place は裏側で自動作成（同一transaction）
- [x] 再訪は既存 Place へ Visit 追加
- [x] Place詳細から Visit 追加
- [x] 検索結果から Visit 追加
- [x] Visit日付必須 / タイトル任意
- [x] `Place × visitedDate` unique（重複時は既存Visit編集へ誘導）
- [x] Visit編集
- [x] Visit削除
- [x] 最後のVisit削除時に警告ダイアログ
- [x] Visit 0件なら Place を地図から除去

## Phase 4: リンク・メモ・検索

- [ ] 外部リンク複数（URL + ユーザー指定タイトル + sortOrder）
- [ ] メモ or 外部リンク必須バリデーション（アプリ層で保証）
- [ ] OGP登録時取得（server-side, SSRF対策込み）
- [ ] OGP を D1 にキャッシュ
- [ ] OGPカード表示
- [ ] OGP失敗時リンクfallback
- [ ] OGP手動再取得（管理者のみ）
- [ ] 外部リンクは別タブ
- [ ] Markdownメモ表示（sanitize必須）
- [ ] 自分のPlace検索（places.name）
- [ ] Visitタイトル/メモ検索（visits.title / noteMarkdown）
- [ ] 検索結果選択で地図ジャンプ（flyTo）＋詳細パネル

## Phase 5: 仕上げ

- [ ] プロフィール表示（公開地図に控えめに）
- [ ] プロフィール編集（`/admin`）
- [ ] Googleアイコン利用（読み取りのみ）
- [ ] PC/スマホ両対応の最終調整
- [ ] empty / error / loading states
- [ ] テスト
- [ ] deploy configuration（secrets, D1 本番, デプロイ確認）

---

## 決定ログ

| 日付 | 決定 | 理由 |
| --- | --- | --- |
| 2026-08-27 | 進捗記録を `docs/PROGRESS.md` に一本化 | 別セッションからの再開時に読む場所を1つに固定するため |
| 2026-08-27 | パッケージマネージャは pnpm | ユーザーの指定。lockfile は `pnpm-lock.yaml` のみを持ち、`package-lock.json` は作らない |
| 2026-08-27 | import alias を `@/` に一本化（`#/` は廃止） | shadcn/ui の標準に合わせ、2通りの書き方を残さないため |
| 2026-08-27 | 地図タイルの初期値は OpenFreeMap positron | APIキー不要で開発が止まらず、ライトでミニマルという仕様に合う。差し替え先は `src/lib/map-config.ts` に隔離済み |
| 2026-08-27 | shadcn/ui は `init` を使わず手動セットアップ | `init` が TTY 必須の対話プロンプトで進まないため。あわせて標準の `.dark` トークンは意図的に持たない（MVP は単一テーマ） |
| 2026-08-27 | D1 の `database_id` はプレースホルダのまま | ローカル開発では未使用。デプロイ時に実IDへ差し替える |
| 2026-08-27 | seed fixtures の `provider` は `'seed'` 固定 | 実際の外部施設検索（geoapify 等）の ID と衝突させないため |
| 2026-08-27 | `visits`/`visit_links` の FK は `ON DELETE CASCADE` | Visit削除時に links が孤児にならないようにする。Place の削除判断はアプリ層で行う |
| 2026-08-27 | コードネームを Atlas に変更 | Workers の name と D1 の database_name も `atlas` / `atlas-db` に揃えた |
| 2026-08-27 | map places は `innerJoin` で取得 | 「期間内に1件以上 Visit がある Place」だけが自然に返り、Visit 0件の Place を公開UIに出さない不変条件がクエリで満たされる |
| 2026-08-27 | Place 詳細にも期間フィルターを適用する | 期間は「地図上の集計全体」に効くという仕様に合わせた。全期間との差が出る場合はパネルに全期間の回数を併記する |
| 2026-08-27 | 地図の移動は検索/URL 由来の選択時のみ | ピンをクリックした場合はすでに見えている位置なので動かさない。パネルに隠れないよう flyTo に offset を渡す |
| 2026-08-27 | 地図上のUIは「左=操作 / 右=詳細」に分ける | Place 詳細パネルを右、期間フィルターとズームボタンを左に配置。Phase 4 の検索欄と Phase 5 のプロフィールは左側に置く前提で場所を空けてある |
| 2026-08-27 | 認証は Better Auth + Google OAuth、認可は別建て | ログインできること自体は権限を意味しない。`ADMIN_GOOGLE_EMAIL` と大文字小文字だけ吸収した完全一致で判定する |
| 2026-08-27 | `auth-schema.ts` は Better Auth CLI で生成する | 列名・型が Better Auth の期待とズレると実行時まで気づけない。手書きしない |
| 2026-08-27 | drizzle-orm を 0.45.2 へ更新 | Better Auth の drizzle adapter が `>=0.45.2` を要求するため |
| 2026-08-27 | `DEV_ADMIN_BYPASS` は廃止 | 実際の認証が入ったため役目を終えた |
| 2026-08-27 | Geoapify は Geocoding Autocomplete を使う | 施設名で引きたいため。Places API はカテゴリと範囲で引く API でテキスト検索に向かない |
| 2026-08-27 | `getById` は要求した providerPlaceId を保持する | place-details は施設としては正しいものを返すが、応答中の place_id は要求値と異なる。応答側を採用すると同じ施設の ID が呼ぶたびに変わる |
| 2026-08-27 | Place 詳細はクライアント側で取得 | 期間が変わったときだけ loader を再実行させるため（`loaderDeps` は from/to のみ）。`?place=` 直接アクセスでは1往復ぶん遅れて開く |

---

## 未決事項 / ブロッカー

- [ ] 地図タイル provider の最終決定（暫定で OpenFreeMap positron を使用中。`docs/06-technical-design.md` が候補に挙げる MapTiler を採用する場合はライセンス確認が必要）
- [x] 施設検索 provider の API キー取得（Geoapify）— 2026-08-27 完了、実 API で疎通確認済み
- [x] Google OAuth クライアント（client id / secret）の用意 — 2026-08-27 完了
- [x] `ADMIN_GOOGLE_EMAIL` に入れるアドレスの確定 — 2026-08-27 完了
- [ ] **同一施設が Geoapify から複数件返る問題**。「清澄庭園」で検索すると
      leisure.park / commercial.tickets / rental.bicycle の3件が同名で返る。
      別々に選ぶと同じ施設に対して別 Place ができてしまい、
      「同一施設は同一Place」（docs/02-concepts.md）が破れる。UIでの見せ方か
      保存時の名寄せで対処が必要

---

## 作業ログ

新しいものを上に追記する。

### 2026-08-27 — Phase 3 実装完了（Google ログインの実地確認待ち）
- `PlaceSearchProvider` 抽象化 + Geoapify provider（実 API と突合済み）+ 開発用ダミー
- `requireAdmin()` を全 write の先頭に置く構造
- D1 に対話的トランザクションが無いため、原子性は `db.batch()` で担保
- 同一施設の二重登録対策（50m 以内は自動統合、50〜250m は保存前に確認）
- 検索欄 / Visitフォーム / 管理者導線 / 削除確認
- Better Auth + Google OAuth、`/admin` を唯一の入口として実装
- 認証テーブルは `@better-auth/cli generate` で生成し `0001_auth_tables.sql` として適用

**確認したこと**
- `/api/auth/ok` が 200、`/api/auth/get-session` が未ログインで null
- `sign-in/social` が正しい Google 認可URLを返す
  （redirect_uri = `http://localhost:3000/api/auth/callback/google`）
- 未ログインでは地図に検索欄も編集導線も出ず、`isAdmin` が false

**未確認**
- ブラウザで実際に Google ログインを通すところ（要ユーザー操作）

**注意**
- `pnpm db:reset` は認証テーブルも消えるため、実行後は再ログインが必要

### 2026-08-27 — Phase 2 完了
- コードネームを Life Map から Atlas へ変更（Workers name / D1 database_name も追随）
- `src/server/places.ts`: `getMapPlaces` / `getPlaceDetail` を server function として実装
- `src/lib/date-range.ts`: 期間フィルターの型・プリセット・不正入力の除去
- `src/components/map/place-layers.ts`: クラスタ / 個別ピン / ラベルのレイヤー定義
  - クラスタの数字は `point_count`（= Place 数）。1 feature = 1 Place なので定義上ずれない
  - 個別ピンは `visitCount` で半径を補間。色分けはしない
  - ラベルは minzoom 11、`text-allow-overlap` を立てず衝突回避は MapLibre に任せる
- `src/components/place/PlacePanel.tsx`: PC はサイドパネル / スマホはボトムシート
- `src/components/filter/DateRangeFilter.tsx`: プリセット＋自由な from/to
- `/` を検索パラメータ駆動に変更（`?place=` `?visit=` `?from=` `?to=`）

**確認したこと**
- 期間フィルターで Place 集合と Visit 回数が再計算される
  （全期間 10件 → 2026年 4件 → 2023年 2件 → 2018年 2件、各 visitCount も期間内の値）
- Visit 履歴が新しい順、期間で絞った場合の統計（filtered 1 / total 4）も想定どおり
- `/` `?place=` `?place=&visit=` `?from=&to=` すべて 200

**ブラウザで確認済み**
- クラスタリング、ピンの強弱、ラベル、Place 詳細、期間フィルター、URL 共有すべて動作
- 期間フィルターのドロップダウンが画面外へはみ出す不具合を修正し、
  あわせて地図上のUIを「左=操作 / 右=詳細」に整理した

**詰まった点**
- 500 が出続けたが、原因はリネーム前の dev サーバーが 4 プロセス残っていたこと。
  `pkill -f "vite dev"` は実際のコマンドライン（`vite.js dev`）に一致しないので効かない。
  ポートを `ss -ltnp` で確認して PID で落とす。

### 2026-08-27 — Phase 1 完了
- `docs/PROGRESS.md` を作成
- create-cloudflare で TanStack Start + Workers を雛形生成し、デモ用の Header/Footer/ThemeToggle/about とダークテーマを削除
- Tailwind v4 + shadcn/ui（new-york / neutral / 単一ライトテーマ）をセットアップ
- Drizzle schema を `src/db/schema.ts` に定義し、`db/migrations/0000_init.sql` を生成・ローカル適用
- `db/seed.sql` を作成（10 places / 17 visits / 7 links、2018〜2026・国内外に分散）
- `/` に MapLibre の世界地図を表示（`src/components/map/MapView.tsx`、SSR回避のため dynamic import）
- `pnpm typecheck` / `pnpm build` / `pnpm dev` の通過を確認

**Phase 1 での積み残し（Phase 2 以降で対応）**
- 地図表示はまだタイルのみ。Place ピン・クラスタリングは未実装
- `maplibre-gl` が SSR バンドルにも入る（別チャンクで実行はされない）。サイズが問題になったら external 化を検討
- ブラウザでの実描画は未確認（curl で SSR HTML と CSS のみ検証）
