# UI Specification

## 全体原則

- 地図が常に主役
- 明るくミニマル
- UIクロームを増やしすぎない
- 管理者UIはログイン時だけ現れる
- 一般閲覧者には「管理できるアプリ」であることを極力感じさせない
- PC/スマホ両方をMVPで正式対応

## Desktop

### Map

画面の大部分を地図が占める。

主要UI:
- プロフィール
- 検索
- 期間フィルター
- 管理者のみ: Visit追加導線
- Placeクラスタ/ピン

### Place panel

Place選択時にサイドパネル。

地図自体は残す。

推奨順:

1. Place名
2. 住所
3. 訪問回数 / 初回 / 最終
4. 管理者のみ「訪問を追加」
5. Visit履歴（新しい順）

Visit表示:
- 日付
- 任意タイトル
- Markdownメモ
- 外部OGPカード群
- 管理者のみ編集アクション

## Mobile

Place詳細はボトムシート。

地図を完全に別画面へ切り替えない。

シート高さは内容に応じて調整可能にし、Visit本文を読む場合は十分広げられるようにする。

追加/編集フォームも同じボトムシート内で切り替える。

## Search

検索は1つのUIから:

- 自分のPlaces
- 外部施設検索

を扱う。

結果セクションは視覚的に分離する。

例:
- Your places
- Search places

既存Place選択:
- 地図ズーム
- 詳細パネル

外部施設選択:
- Visit追加

## Clustering

広域:
- クラスタ
- 数字 = Place数

近距離:
- 個別ピン

個別ピン:
- Visit回数が多いほど視覚的に強くする
- 色分けでカテゴリを表現しない

## Place labels

広域では非表示。

一定ズーム以上でPlace名を表示。

ラベル衝突はMapLibre側のレイアウト機能を利用する。

## Profile

地図の邪魔にならない場所に小さく表示。

含む:
- Googleアイコン
- 名前
- 短いbio
- 外部リンク

プロフィール画面を主役にしない。

## Admin affordances

管理者ログイン時のみ:
- 検索から新規Visit作成
- Place詳細に「訪問を追加」
- Visit編集
- Visit削除
- `/admin` へのプロフィール編集導線

一般ユーザーには:
- ログインボタン
- Edit
- Add
- Delete
を一切表示しない。

## Form

Visitフォーム:
- visited date
- title
- Markdown note
- external links repeater

外部リンク行:
- URL
- title

URL入力後にOGP取得できる設計。

保存時:
- noteが空
- linksが0件
ならエラー。

## OGP card

可能なら:
- image
- title
- site name
- optional description

カード全体をクリック可能にし、`target=_blank` 相当で外部へ。

OGP失敗時:
- ユーザー指定タイトル
- URL/hostname
のシンプルリンク。

## Theme

MVPは単一テーマ。

ライト、明るい、ミニマル。

ダークモードは実装しない。
