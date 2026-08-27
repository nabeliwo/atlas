import { env } from 'cloudflare:workers'

import { FixturePlaceSearchProvider } from './fixture'
import { GeoapifyPlaceSearchProvider } from './geoapify'
import { GooglePlaceSearchProvider } from './google'
import type { PlaceSearchProvider } from './types'

export type {
  PlaceCandidate,
  PlaceSearchProvider,
  PlaceSuggestion,
  SearchContext,
} from './types'

/**
 * 使用する provider を1箇所で決める。
 *
 * 既定は Google Places。OpenStreetMap（Geoapify）は個人経営の店の
 * 収録率が低く、「記憶に残った場所」ほど取りこぼしていたため乗り換えた。
 * Geoapify の実装は残してあるので、PLACE_SEARCH_PROVIDER=geoapify で戻せる。
 *
 * キーが無い場合、開発では固定データのダミーを使う。本番でキーが無いのは
 * 設定漏れなので、黙ってダミーへフォールバックせずエラーにする。
 *
 * 既存の Place は provider 名を持っているので、乗り換えても表示は壊れない。
 */
export function getPlaceSearchProvider(): PlaceSearchProvider {
  const apiKey = env.PLACE_SEARCH_API_KEY

  if (apiKey) {
    return env.PLACE_SEARCH_PROVIDER === 'geoapify'
      ? new GeoapifyPlaceSearchProvider(apiKey)
      : new GooglePlaceSearchProvider(apiKey)
  }

  if (import.meta.env.DEV) return new FixturePlaceSearchProvider()

  throw new Error(
    'PLACE_SEARCH_API_KEY is not configured. Set it with `wrangler secret put PLACE_SEARCH_API_KEY`.',
  )
}
