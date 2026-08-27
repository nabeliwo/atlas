# Future Ideas

MVPに入れないが、プロダクトの方向性と合うもの。

優先順位はデータが実際に溜まってから決める。

## Stats / Reflection

`/stats` 等。

候補:

- 総Place数
- 総Visit数
- 訪問した国数
- 訪問した地域数
- 一番Visit回数が多いPlace
- 今年初めて訪れたPlace数
- 最近追加したPlace
- 年ごとの新規Place数
- 「何年ぶりに訪問」
- 初訪問日
- 最終訪問日
- 長く付き合っているPlace
- 年別・期間別の振り返り

コンセプト:
入力を増やさず、蓄積データから長く使うほど価値が上がる。

## 3D Globe

MVPは平面地図。

将来:
- 世界全体では地球儀
- ズームすると通常地図
などを検討。

## Heatmap / Density

「この辺は行っている、この辺はまだ少ない」をより直感的に見る補助モード。

MVPではクラスタだけ。

## Annual recap

Spotify Wrapped的な年次振り返り。

例:
- 今年初めて行ったPlace
- 最も再訪したPlace
- 新しく訪れた国/県
- 去年との比較

## Self-hosted map tiles

無料providerから開始。

コスト、利用規約、デザイン自由度が理由になる場合のみ自前化。

## Full-text search

MVPはSQLite/D1の簡易検索。

Place/Visitが増えて必要になったら:
- SQLite FTS5
- dedicated search
などを検討。

## Map style personalization

将来:
- custom style
- visualization modes

ただしカテゴリ色分けなど、地図を情報過多にするものは慎重に。

ダークモードは作らない。明るい地図を眺めることがこのアプリの体験そのもので、
テーマの選択肢を増やしても「世界地図を眺める時間」は楽しくならない。

## Place provider migration

Geoapify等の品質が不足する場合:
- Google Places
- 別POI provider
へ差し替える。

provider abstractionを維持する。

## Data export / backup

長期間育てるデータなので重要。

将来:
- JSON export
- CSV export
- DB backup
- static archive
を検討。

これは機能的な楽しさより、長寿命プロダクトとしての安全性のため。

## Permanent URLs / slugs

MVPはid query。

必要なら:
- human readable slug
- stable public IDs
を検討。

## Accessibility and keyboard exploration

MVPでも基本対応するが、将来的に地図外のPlace一覧ビューなどを追加する可能性。

## Not planned unless concept changes

以下は現状コンセプトとズレるため、安易に追加しない。

- ダークモード
- 行きたい場所
- 旅行計画
- 完全な移動履歴
- SNSフィード
- 他ユーザーとのフォロー
- レーティング
- 写真ストレージ
