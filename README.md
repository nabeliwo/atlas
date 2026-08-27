# Atlas

人生で記憶に残した場所を、地図という形でコレクションする個人プロダクト。

公開URL: https://atlas.nabeliwo.workers.dev

このリポジトリの実装前提は `docs/` 以下にまとまっています。Claude Code / Codex は、まず以下の順で読んでください。

1. `docs/00-philosophy.md`
2. `docs/01-product-spec.md`
3. `docs/02-concepts.md`
4. `docs/03-user-flows.md`
5. `docs/04-ui-spec.md`
6. `docs/05-data-model.md`
7. `docs/06-technical-design.md`
8. `docs/07-mvp-scope.md`
9. `docs/08-future-ideas.md`

実装の進捗は `docs/PROGRESS.md` に記録しています。
作業を始める前にそこを読み、作業が終わったら必ず更新してください。

> [!IMPORTANT]
> **このリポジトリは public です。**
> secret・APIキー・管理者のメールアドレスをコミットしないでください。
> 値は `wrangler secret put` と、gitignore 済みの `.dev.vars` にだけ置きます。

## 開発

```bash
pnpm install              # 初回のみ
cp .dev.vars.example .dev.vars   # secret を埋める（Phase 3 以降で必要）
pnpm db:migrate           # ローカル D1 にマイグレーション適用
pnpm db:seed              # 開発用 fixtures 投入
pnpm dev                  # http://localhost:3000
```

`.dev.vars` は gitignore 済みです。必要な値と取得方法は `.dev.vars.example`
のコメントに書いてあります。地図の閲覧だけなら secret なしで動きます。

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | 開発サーバー |
| `pnpm build` | 本番ビルド |
| `pnpm typecheck` | 型チェック |
| `pnpm db:generate` | schema から SQL マイグレーション生成 |
| `pnpm db:migrate` | ローカル D1 へ適用（`:remote` で本番） |
| `pnpm db:seed` | 開発用 fixtures 投入 |
| `pnpm db:reset` | ローカル D1 を作り直して migrate + seed |
| `pnpm cf-typegen` | `wrangler.jsonc` から Env の型を再生成 |


## デプロイ

Cloudflare Workers + D1。初回だけ次の準備が要ります。

### 1. 本番の D1 を作る

```bash
npx wrangler login
npx wrangler d1 create atlas-db
```

出力された `database_id` を `wrangler.jsonc` の
`d1_databases[0].database_id` に貼り替えます。

> [!WARNING]
> **ローカル D1 の保存先は `database_id` ごとに分かれています。**
> ID を変更すると、ローカルの参照先が空の別データベースに切り替わり、
> `no such table: places` で落ちます。変更後は必ず
> `pnpm db:migrate && pnpm db:seed` をやり直してください。
> 変更前のデータは `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`
> に別ファイルとして残っています。

`wrangler d1 create` は `wrangler.jsonc` に**別のバインディングを追記する**
ことがあります。アプリは `env.DB` を参照するので、既存の `DB` バインディングに
ID を入れる形へ統合してください。バインディングが2つあると本番でDBに繋がりません。

```bash
pnpm db:migrate:remote     # 本番 D1 にマイグレーション適用
```

seed は開発用の fixtures なので本番には投入しません。

### 2. secrets を登録する

`.dev.vars` はローカル専用です。本番へは個別に登録します。

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put ADMIN_GOOGLE_EMAIL
npx wrangler secret put PLACE_SEARCH_API_KEY
```

`BETTER_AUTH_URL` は secret ではなく `wrangler.jsonc` の `vars` にあります。
**デプロイ先の実際の URL と一致している必要があります。** ここが違うと
OAuth のコールバックが成立しません。

workers.dev のサブドメイン（`nabeliwo` の部分）は Worker ごとではなく
**Cloudflare アカウント全体に1つ**です。変更するとアカウント上の
すべての Worker の URL が変わります。

### 3. デプロイ

```bash
pnpm run deploy
```

`pnpm deploy` は pnpm 自身のコマンドと衝突するため、`run` が必要です。

### 4. Google OAuth のリダイレクト URI を追加する

Google Cloud Console の OAuth クライアントに、本番の URL を追加します。

```
https://atlas.nabeliwo.workers.dev/api/auth/callback/google
```

実際の値は次で確認できます（`redirect_uri` を見る）。

```bash
curl -s -X POST https://atlas.nabeliwo.workers.dev/api/auth/sign-in/social \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://atlas.nabeliwo.workers.dev' \
  -d '{"provider":"google","callbackURL":"/admin"}'
```

ローカル用の `http://localhost:3000/api/auth/callback/google` は
残したままで構いません。

### デプロイ後の確認

- `/` に地図が出る（データが無ければ空の世界地図）
- `/api/auth/ok` が `{"ok":true}` を返す
- `/admin` から Google ログインできる
- ログイン後に地図で訪問を追加できる

## 実装方針

- 要件にない機能を勝手に追加しない
- 「旅行アプリ」「チェックインアプリ」「ライフログアプリ」に寄せない
- 地図閲覧が主役。登録・編集はその延長
- Place はユーザーが直接管理する対象ではなく、Visit が存在することで地図上に現れる
- 公開閲覧は誰でも可能。追加・編集・削除は管理者だけ
- MVP を完成させてから統計・地球儀などの拡張に進む
