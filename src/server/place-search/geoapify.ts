import type {
  PlaceCandidate,
  PlaceSearchProvider,
  SearchContext,
} from './types'

/**
 * Geoapify の Geocoding Autocomplete を使う provider。
 *
 * 施設名で引きたいので Places API ではなく autocomplete を使う。
 * Places API はカテゴリと範囲で引く API で、テキスト検索には向かない。
 *
 * !!! 未検証 !!!
 * このファイルは API キーが無い状態で書いたため、実レスポンスとの
 * 突き合わせができていない。キーを入手したら以下を必ず確認すること。
 *   - features[].properties のフィールド名（place_id / formatted / lat / lon など）
 *   - place-details での取得が place_id で引けるか
 * 想定と違う場合はこのファイルだけを直せばよい（境界は types.ts で閉じている）。
 */
export class GeoapifyPlaceSearchProvider implements PlaceSearchProvider {
  readonly name = 'geoapify'

  constructor(private readonly apiKey: string) {}

  async search(
    query: string,
    context?: SearchContext,
  ): Promise<Array<PlaceCandidate>> {
    const trimmed = query.trim()
    if (!trimmed) return []

    const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete')
    url.searchParams.set('text', trimmed)
    url.searchParams.set('limit', String(context?.limit ?? 8))
    url.searchParams.set('lang', 'ja')
    url.searchParams.set('apiKey', this.apiKey)

    if (context?.near) {
      // 地図で見ている場所の近くを優先する
      const { longitude, latitude } = context.near
      url.searchParams.set('bias', `proximity:${longitude},${latitude}`)
    }

    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) {
      throw new Error(`Geoapify search failed: ${response.status}`)
    }

    const body = (await response.json()) as GeoapifyResponse
    return (body.features ?? [])
      .map(toCandidate)
      .filter((c): c is PlaceCandidate => c !== null)
  }

  async getById(providerPlaceId: string): Promise<PlaceCandidate | null> {
    const url = new URL('https://api.geoapify.com/v2/place-details')
    url.searchParams.set('id', providerPlaceId)
    url.searchParams.set('lang', 'ja')
    url.searchParams.set('apiKey', this.apiKey)

    const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) return null

    const body = (await response.json()) as GeoapifyResponse
    const first = body.features?.[0]
    return first ? toCandidate(first) : null
  }
}

type GeoapifyFeature = {
  properties?: {
    place_id?: string
    name?: string
    formatted?: string
    address_line1?: string
    lat?: number
    lon?: number
    country_code?: string
    state?: string
    county?: string
    city?: string
    categories?: Array<string>
    category?: string
  }
}

type GeoapifyResponse = {
  features?: Array<GeoapifyFeature>
}

/**
 * provider 固有の形をここで domain model に落とす。
 * 欠けているフィールドがあっても落ちないようにし、
 * 座標と ID という必須要素が無いものだけを捨てる。
 */
function toCandidate(feature: GeoapifyFeature): PlaceCandidate | null {
  const p = feature.properties
  if (!p?.place_id) return null
  if (typeof p.lat !== 'number' || typeof p.lon !== 'number') return null

  // 施設名が無い（住所だけの）結果は、表示名として formatted を使う
  const name = p.name ?? p.address_line1 ?? p.formatted
  if (!name) return null

  return {
    provider: 'geoapify',
    providerPlaceId: p.place_id,
    name,
    latitude: p.lat,
    longitude: p.lon,
    address: p.formatted,
    countryCode: p.country_code?.toUpperCase(),
    region: p.state ?? p.county,
    city: p.city,
    category: p.categories?.[0] ?? p.category,
  }
}
