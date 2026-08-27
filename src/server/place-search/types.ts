/**
 * 外部施設検索 provider の境界。
 *
 * docs/06-technical-design.md より、provider は差し替え可能にする。
 * provider 固有のレスポンス形をこの型より内側へ漏らさないこと。
 * DB には provider 名と providerPlaceId を保存し、同一性の判定に使う。
 *
 * 検索と確定を2段階に分けている。Google の autocomplete のように
 * 「候補一覧には座標を含めず、選んだ1件だけ詳細を取りに行く」API があり、
 * これは料金的にも正しい形（候補の件数ぶん詳細を引くと課金が跳ねる）。
 */

/** 検索結果の1件。座標はまだ持たない。 */
export type PlaceSuggestion = {
  provider: string
  providerPlaceId: string

  name: string
  /** 候補を見分けるための補助情報。住所など。 */
  address?: string
  category?: string
}

/** places テーブルに保存するスナップショット。 */
export type PlaceCandidate = PlaceSuggestion & {
  latitude: number
  longitude: number

  countryCode?: string
  region?: string
  city?: string
}

export type SearchContext = {
  /** 地図の現在地。provider が対応していれば近い順に寄せる。 */
  near?: { latitude: number; longitude: number }
  limit?: number
}

export interface PlaceSearchProvider {
  /** DB の places.provider に入る識別子。 */
  readonly name: string

  search(
    query: string,
    context?: SearchContext,
  ): Promise<Array<PlaceSuggestion>>

  /**
   * 候補を保存できる形まで確定させる。
   *
   * suggestion をそのまま受け取るのは、provider によっては
   * 名前が検索結果側にしか無いため（Google の displayName は上位SKUで、
   * autocomplete の予測テキストから取れば追加コストが要らない）。
   *
   * 確定できなければ null。呼び出し側は保存を中止する。
   */
  resolve(suggestion: PlaceSuggestion): Promise<PlaceCandidate | null>
}
