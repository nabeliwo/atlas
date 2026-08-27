import { env } from 'cloudflare:workers'

import { FixturePlaceSearchProvider } from './fixture'
import { GeoapifyPlaceSearchProvider } from './geoapify'
import type { PlaceSearchProvider } from './types'

export type { PlaceCandidate, PlaceSearchProvider, SearchContext } from './types'

/**
 * 使用する provider を1箇所で決める。
 *
 * PLACE_SEARCH_API_KEY があれば Geoapify、無ければ開発用のダミーを使う。
 * ダミーへのフォールバックは開発時に限る。本番でキーが無いのは設定漏れなので、
 * 黙ってダミーを返さずエラーにする。
 */
export function getPlaceSearchProvider(): PlaceSearchProvider {
  const apiKey = env.PLACE_SEARCH_API_KEY

  if (apiKey) return new GeoapifyPlaceSearchProvider(apiKey)

  if (import.meta.env.DEV) return new FixturePlaceSearchProvider()

  throw new Error(
    'PLACE_SEARCH_API_KEY is not configured. Set it with `wrangler secret put PLACE_SEARCH_API_KEY`.',
  )
}
