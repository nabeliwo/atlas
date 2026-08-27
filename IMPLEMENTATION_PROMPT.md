# Claude Code / Codex Implementation Prompt

このリポジトリにある `docs/` をすべて読んでから実装してください。

## 最重要ルール

1. `docs/00-philosophy.md` の思想を、個別機能の便利さより優先する。
2. 要件に存在しない機能を勝手に追加しない。
3. MVP対象とPost-MVPを混ぜない。
4. 地図閲覧を主役にする。
5. Placeをユーザーが直接管理するCRUD画面は作らない。
6. 一般閲覧者にはログイン・管理UIを見せない。
7. PC/スマホ双方をMVPで成立させる。
8. 外部provider（施設検索・地図タイル）は差し替え可能にする。
9. write操作はすべてserver-sideでadmin authorizationする。
10. OGP fetchにはSSRF対策を入れる。

## 推奨実装順

Phase 1:
- TanStack Start + Cloudflare Workers project setup
- D1 + Drizzle schema/migrations
- seed/dev fixtures
- public map skeleton

Phase 2:
- map place data
- clustering
- place side panel / mobile sheet
- query state `?place` / `?visit`
- date filters

Phase 3:
- Better Auth + Google OAuth
- admin email authorization
- external place search abstraction
- add Visit flow
- edit/delete

Phase 4:
- external links
- OGP fetch/cache/fallback
- Markdown rendering
- search own places/visits

Phase 5:
- profile
- responsive polish
- empty/error/loading states
- tests
- deploy configuration

## Done

`docs/07-mvp-scope.md` のDefinition of Doneが全項目満たされた時点でMVP完了とする。
統計・地球儀・ヒートマップ等には着手しない。
