# MVP Scope

## Definition of Done

以下がすべて動けばMVP完成。

## Public

- [ ] `/` で世界地図を表示
- [ ] 初期表示は世界全体
- [ ] 明るくミニマルな単一テーマ
- [ ] Placeを地図に表示
- [ ] 広域でクラスタリング
- [ ] クラスタ数字はPlace数
- [ ] 個別PlaceのVisit回数を視覚表現
- [ ] ズーム時にPlace名表示
- [ ] 期間プリセット
- [ ] 自由なfrom/to期間指定
- [ ] 期間に応じてPlace/Visit count/cluster count再計算
- [ ] 自分のPlace検索
- [ ] Visitタイトル/メモ検索
- [ ] 検索結果選択で地図ジャンプ
- [ ] Place詳細サイドパネル（desktop）
- [ ] Place詳細ボトムシート（mobile）
- [ ] Place名・住所・訪問回数・初回・最終
- [ ] Visit履歴 newest first
- [ ] Markdownメモ表示
- [ ] OGPカード表示
- [ ] OGP失敗時リンクfallback
- [ ] 外部リンクは別タブ
- [ ] `?place=` 直接URL
- [ ] `?place=&visit=` 直接URL
- [ ] プロフィール表示
- [ ] PC/スマホ両対応

## Admin

- [ ] `/admin` でGoogleログイン
- [ ] 許可Googleアカウントだけadmin
- [ ] 一般画面にログインボタンを出さない
- [ ] ログイン時のみ管理UIを表示
- [ ] 外部施設検索
- [ ] 新規施設選択からVisit追加
- [ ] Placeは裏側で自動作成
- [ ] 再訪は既存PlaceへVisit追加
- [ ] Place詳細からVisit追加
- [ ] 検索結果からVisit追加
- [ ] Visit日付必須
- [ ] Visitタイトル任意
- [ ] VisitメモMarkdown
- [ ] 外部リンク複数
- [ ] メモ or 外部リンク必須バリデーション
- [ ] `Place × visitedDate` unique
- [ ] OGP登録時取得
- [ ] OGP手動再取得
- [ ] Visit編集
- [ ] Visit削除
- [ ] 最後のVisit削除時に警告
- [ ] Visit 0件ならPlaceを地図から除去
- [ ] プロフィール編集
- [ ] Googleアイコン利用

## Explicitly Not MVP

- 統計画面
- 3D地球儀
- ヒートマップ
- ダークモード
- Placeカテゴリ別ピン
- Place自体のユーザーメモ
- Place自体の外部リンク
- 写真アップロード
- GoogleフォトAPI統合
- ブログ本文取り込み
- 自動GPS記録
- Timeline import
- 行きたい場所
- 旅行というdomain model
- 評価 / 星
- private/public Visit
- マルチユーザー化
- 旅行計画
