# Progress

Life Map の実装進捗を記録する唯一のドキュメント。
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

- **現在フェーズ**: Phase 2 — 地図を主役にする
- **状態**: Phase 1 完了 / Phase 2 未着手
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

- [ ] map places クエリ（期間フィルタ対応）
- [ ] Placeを地図に表示
- [ ] 広域でクラスタリング
- [ ] クラスタ数字は Place 数
- [ ] 個別Placeのフィルタ後Visit回数を視覚表現（サイズ等）
- [ ] ズーム時にPlace名表示（ラベル衝突はMapLibreに任せる）
- [ ] Place詳細サイドパネル（desktop）
- [ ] Place詳細ボトムシート（mobile）
- [ ] Place名・住所・訪問回数・初回・最終
- [ ] Visit履歴 newest first
- [ ] `?place=` 直接URL
- [ ] `?place=&visit=` 直接URL
- [ ] 期間プリセット（今年 / 去年 / 過去5年）
- [ ] 自由なfrom/to期間指定
- [ ] 期間に応じて Place / Visit count / cluster count 再計算

## Phase 3: 管理者と書き込み

- [ ] Better Auth + Google OAuth
- [ ] `/admin` でGoogleログイン
- [ ] `ADMIN_GOOGLE_EMAIL` 完全一致による admin authorization
- [ ] 全 write server function で毎回 authorization
- [ ] 一般画面にログインボタンを出さない
- [ ] ログイン時のみ管理UIを表示
- [ ] `PlaceSearchProvider` 抽象化
- [ ] 外部施設検索の実装（provider: Geoapify 候補）
- [ ] 新規施設選択から Visit 追加
- [ ] Place は裏側で自動作成（同一transaction）
- [ ] 再訪は既存 Place へ Visit 追加
- [ ] Place詳細から Visit 追加
- [ ] 検索結果から Visit 追加
- [ ] Visit日付必須 / タイトル任意
- [ ] `Place × visitedDate` unique（重複時は既存Visit編集へ誘導）
- [ ] Visit編集
- [ ] Visit削除
- [ ] 最後のVisit削除時に警告ダイアログ
- [ ] Visit 0件なら Place を地図から除去

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

---

## 未決事項 / ブロッカー

- [ ] 地図タイル provider の最終決定（暫定で OpenFreeMap positron を使用中。`docs/06-technical-design.md` が候補に挙げる MapTiler を採用する場合はライセンス確認が必要）
- [ ] 施設検索 provider の API キー取得（Geoapify 候補）
- [ ] Google OAuth クライアント（client id / secret）の用意
- [ ] `ADMIN_GOOGLE_EMAIL` に入れるアドレスの確定

---

## 作業ログ

新しいものを上に追記する。

### 2026-08-27 — Phase 1 完了
- `docs/PROGRESS.md` を作成
- create-cloudflare で TanStack Start + Workers を雛形生成し、デモ用の Header/Footer/ThemeToggle/about とダークテーマを削除
- Tailwind v4 + shadcn/ui（new-york / neutral / 単一ライトテーマ）をセットアップ
- Drizzle schema を `src/db/schema.ts` に定義し、`db/migrations/0000_init.sql` を生成・ローカル適用
- `db/seed.sql` を作成（10 places / 18 visits / 7 links、2018〜2026・国内外に分散）
- `/` に MapLibre の世界地図を表示（`src/components/map/MapView.tsx`、SSR回避のため dynamic import）
- `pnpm typecheck` / `pnpm build` / `pnpm dev` の通過を確認

**Phase 1 での積み残し（Phase 2 以降で対応）**
- 地図表示はまだタイルのみ。Place ピン・クラスタリングは未実装
- `maplibre-gl` が SSR バンドルにも入る（別チャンクで実行はされない）。サイズが問題になったら external 化を検討
- ブラウザでの実描画は未確認（curl で SSR HTML と CSS のみ検証）
