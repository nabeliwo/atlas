# CLAUDE.md

このファイルは毎セッション自動で読み込まれる。詳細は `docs/` にあるので、ここには
「知らずに作業を始めると事故になること」だけを置く。

## このプロダクト

人生で記憶に残した場所を、地図という形でコレクションする個人プロダクト。
ライフログでも旅行アプリでもない。

## 作業を始める前に

1. `docs/PROGRESS.md` — 現在地・決定ログ・未決事項。**作業後は必ず更新する**
2. `IMPLEMENTATION_PROMPT.md` — 最重要ルールと実装順
3. `docs/00-philosophy.md` 以降 — 仕様本体

## セキュリティ

> [!IMPORTANT]
> **このリポジトリは public。**

- secret・APIキー・管理者のメールアドレスを、リポジトリ内のいかなるファイルにも
  書かない。`.dev.vars.example` のようなサンプルファイルも例外ではない
- 値は `wrangler secret put` と、gitignore 済みの `.dev.vars` にだけ置く
- クライアントへ渡る値は、リポジトリの公開/非公開に関わらず公開情報になる。
  外部APIのキーは server function の内側に閉じる

## 開発

パッケージマネージャは **pnpm**（`package-lock.json` は作らない）。

```bash
pnpm install
pnpm db:reset   # ローカル D1 を作り直して migrate + seed
pnpm dev        # http://localhost:3000
```

コマンド一覧は README を参照。

## 実装の判断基準

新機能を検討するときは `docs/00-philosophy.md` の問いに戻る。

> この機能は、世界地図を眺める時間をもっと楽しくするか？

- 要件にない機能を勝手に追加しない
- 地図閲覧が主役。登録・編集はその延長
- Place はユーザーが直接管理する対象ではない。Visit が存在することで地図に現れる
- MVP と Post-MVP を混ぜない（統計・地球儀・ヒートマップ・ダークモードは対象外）
