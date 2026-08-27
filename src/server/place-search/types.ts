/**
 * 外部施設検索 provider の境界。
 *
 * docs/06-technical-design.md より、provider は差し替え可能にする。
 * Geoapify 固有のレスポンス形をこの型より内側へ漏らさないこと。
 * DB には provider 名と providerPlaceId を保存し、同一施設の判定に使う。
 */

/** 検索結果1件。places テーブルに保存するスナップショットと同じ形にしてある。 */
export type PlaceCandidate = {
  provider: string
  providerPlaceId: string

  name: string
  latitude: number
  longitude: number

  address?: string
  countryCode?: string
  region?: string
  city?: string
  category?: string
}

export type SearchContext = {
  /** 地図の現在地。provider が対応していれば近い順に寄せる。 */
  near?: { latitude: number; longitude: number }
  limit?: number
}

export interface PlaceSearchProvider {
  /** DB の places.provider に入る識別子。 */
  readonly name: string

  search(query: string, context?: SearchContext): Promise<Array<PlaceCandidate>>

  /**
   * providerPlaceId から1件取得する。
   * 検索結果を選んでから保存するまでの間に、値を取り直したい場合に使う。
   */
  getById(providerPlaceId: string): Promise<PlaceCandidate | null>
}
