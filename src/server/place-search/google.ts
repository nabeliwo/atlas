import type {
  PlaceCandidate,
  PlaceSearchProvider,
  PlaceSuggestion,
  SearchContext,
} from './types'

/**
 * Google Places API (New) を使う provider。
 *
 * OpenStreetMap には個人経営の店が載っていないことが多く、
 * 「記憶に残った場所」ほど取りこぼしやすかったため乗り換えた
 * （docs/06-technical-design.md「検索品質が不十分ならGoogle Places等へ差し替える」）。
 *
 * コスト設計:
 *   名前と住所は autocomplete の予測テキストから取る。追加課金は発生しない。
 *   displayName は Pro SKU（$17/1,000回・無料枠5,000）なので使わない。
 *   詳細取得は location と types だけ要求し、Essentials SKU
 *   （$5/1,000回・無料枠10,000）に収める。
 *   候補一覧では詳細を引かず、ユーザーが選んだ1件だけ確定させる。
 *
 * 実 API と突き合わせ済み（2026-08-28）。
 */
export class GooglePlaceSearchProvider implements PlaceSearchProvider {
  readonly name = 'google'

  constructor(private readonly apiKey: string) {}

  async search(
    query: string,
    context?: SearchContext,
  ): Promise<Array<PlaceSuggestion>> {
    const trimmed = query.trim()
    if (!trimmed) return []

    const body: Record<string, unknown> = {
      input: trimmed,
      languageCode: 'ja',
      regionCode: 'JP',
    }

    if (context?.near) {
      // 地図で見ている場所の近くを優先する（順位付けのみで、絞り込みではない）
      body.locationBias = {
        circle: {
          center: {
            latitude: context.near.latitude,
            longitude: context.near.longitude,
          },
          radius: 20_000,
        },
      }
    }

    const response = await fetch(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      },
    )
    if (!response.ok) {
      throw new Error(`Google Places autocomplete failed: ${response.status}`)
    }

    const data = (await response.json()) as AutocompleteResponse
    const limit = context?.limit ?? 8

    return (data.suggestions ?? [])
      .map((suggestion) => toSuggestion(suggestion))
      .filter((s): s is PlaceSuggestion => s !== null)
      .slice(0, limit)
  }

  async resolve(suggestion: PlaceSuggestion): Promise<PlaceCandidate | null> {
    const id = encodeURIComponent(suggestion.providerPlaceId)
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${id}?languageCode=ja`,
      {
        headers: {
          'X-Goog-Api-Key': this.apiKey,
          // Essentials に収まるフィールドだけを要求する。増やすと SKU が上がる。
          'X-Goog-FieldMask': 'location,types,addressComponents',
        },
        signal: AbortSignal.timeout(8000),
      },
    )
    if (!response.ok) return null

    const place = (await response.json()) as PlaceDetails
    const location = place.location
    if (
      typeof location?.latitude !== 'number' ||
      typeof location?.longitude !== 'number'
    ) {
      return null
    }

    const components = place.addressComponents ?? []

    return {
      ...suggestion,
      latitude: location.latitude,
      longitude: location.longitude,
      // 住所は autocomplete 側の表記の方が日本語として読みやすいので差し替えない
      category: place.types?.[0] ?? suggestion.category,
      countryCode: findComponent(components, 'country')?.shortText?.toUpperCase(),
      region: findComponent(components, 'administrative_area_level_1')?.longText,
      city:
        findComponent(components, 'locality')?.longText ??
        findComponent(components, 'administrative_area_level_2')?.longText,
    }
  }
}

type AutocompleteSuggestion = {
  placePrediction?: {
    placeId?: string
    structuredFormat?: {
      mainText?: { text?: string }
      secondaryText?: { text?: string }
    }
    text?: { text?: string }
  }
}

type AutocompleteResponse = { suggestions?: Array<AutocompleteSuggestion> }

type AddressComponent = {
  longText?: string
  shortText?: string
  types?: Array<string>
}

type PlaceDetails = {
  location?: { latitude?: number; longitude?: number }
  types?: Array<string>
  addressComponents?: Array<AddressComponent>
}

function toSuggestion(
  suggestion: AutocompleteSuggestion,
): PlaceSuggestion | null {
  const prediction = suggestion.placePrediction
  if (!prediction?.placeId) return null

  const structured = prediction.structuredFormat
  // mainText が施設名、secondaryText が住所。predictions は既に日本語。
  const name = structured?.mainText?.text ?? prediction.text?.text
  if (!name) return null

  return {
    provider: 'google',
    providerPlaceId: prediction.placeId,
    name,
    address: structured?.secondaryText?.text,
  }
}

function findComponent(
  components: Array<AddressComponent>,
  type: string,
): AddressComponent | undefined {
  return components.find((component) => component.types?.includes(type))
}
