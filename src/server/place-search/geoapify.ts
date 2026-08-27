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
 * 実 API との突き合わせ済み（2026-08-27）。確認した挙動:
 *
 * - autocomplete の place_id は、同一クエリを繰り返しても同じ値が返る。
 *   ただし Geoapify 側のデータ更新をまたいだ安定性までは確認できていない。
 * - place-details は施設としては正しいもの（名前・座標が一致）を返すが、
 *   レスポンス中の place_id は要求した値と異なる。
 *   そのため getById では要求された ID を保持し、応答側の place_id を採用しない。
 *   採用すると、同じ施設の providerPlaceId が呼ぶたびに変わってしまう。
 * - autocomplete は datasource.raw を返さないため、osm_id による
 *   同一性判定は使えない（place-details だけが raw を持つ）。
 * - 日本の住所では state が null になることがあるので、region は欠けうる。
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
      .map((feature) => toCandidate(feature))
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
    if (!first) return null

    const candidate = toCandidate(first, providerPlaceId)
    if (!candidate) return null

    // 応答の place_id は要求した値と一致しないため、要求側の ID を正とする
    return { ...candidate, providerPlaceId }
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
    suburb?: string
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
function toCandidate(
  feature: GeoapifyFeature,
  fallbackPlaceId?: string,
): PlaceCandidate | null {
  const p = feature.properties
  const providerPlaceId = p?.place_id ?? fallbackPlaceId
  if (!p || !providerPlaceId) return null
  if (typeof p.lat !== 'number' || typeof p.lon !== 'number') return null

  // 施設名が無い（住所だけの）結果は、表示名として formatted を使う
  const name = p.name ?? p.address_line1 ?? p.formatted
  if (!name) return null

  return {
    provider: 'geoapify',
    providerPlaceId,
    name,
    latitude: p.lat,
    longitude: p.lon,
    address: p.formatted,
    countryCode: p.country_code?.toUpperCase(),
    region: p.state ?? p.county ?? p.suburb,
    city: p.city,
    category: p.categories?.[0] ?? p.category,
  }
}
