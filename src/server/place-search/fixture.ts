import type {
  PlaceCandidate,
  PlaceSearchProvider,
  PlaceSuggestion,
  SearchContext,
} from './types'

/**
 * API キーなしで開発を進めるためのダミー provider。
 * 開発時のみ使い、本番では使わない（index.ts の選択ロジックを参照）。
 *
 * seed に入っている Place とは別の施設を返すようにしてある。
 * 「未登録の施設を検索して Visit を追加する」導線を試すため。
 */
export class FixturePlaceSearchProvider implements PlaceSearchProvider {
  readonly name = 'fixture'

  async search(
    query: string,
    context?: SearchContext,
  ): Promise<Array<PlaceSuggestion>> {
    const q = query.trim().toLowerCase()
    if (!q) return []

    return FIXTURES.filter((candidate) =>
      [candidate.name, candidate.address, candidate.city]
        .filter((v): v is string => typeof v === 'string')
        .some((value) => value.toLowerCase().includes(q)),
    ).slice(0, context?.limit ?? 8)
  }

  async resolve(suggestion: PlaceSuggestion): Promise<PlaceCandidate | null> {
    return (
      FIXTURES.find(
        (c) => c.providerPlaceId === suggestion.providerPlaceId,
      ) ?? null
    )
  }
}

const FIXTURES: Array<PlaceCandidate> = [
  {
    provider: 'fixture',
    providerPlaceId: 'fixture:sumida-aquarium',
    name: 'すみだ水族館',
    latitude: 35.7101,
    longitude: 139.8107,
    address: '東京都墨田区押上1-1-2 東京スカイツリータウン・ソラマチ 5F・6F',
    countryCode: 'JP',
    region: '東京都',
    city: '墨田区',
    category: 'aquarium',
  },
  {
    provider: 'fixture',
    providerPlaceId: 'fixture:nezu-museum',
    name: '根津美術館',
    latitude: 35.6614,
    longitude: 139.7203,
    address: '東京都港区南青山6-5-1',
    countryCode: 'JP',
    region: '東京都',
    city: '港区',
    category: 'museum',
  },
  {
    provider: 'fixture',
    providerPlaceId: 'fixture:onomichi-senkoji',
    name: '千光寺',
    latitude: 34.4109,
    longitude: 133.1962,
    address: '広島県尾道市東土堂町15-1',
    countryCode: 'JP',
    region: '広島県',
    city: '尾道市',
    category: 'temple',
  },
  {
    provider: 'fixture',
    providerPlaceId: 'fixture:kamogawa-delta',
    name: '鴨川デルタ',
    latitude: 35.0303,
    longitude: 135.7714,
    address: '京都府京都市左京区下鴨宮河町',
    countryCode: 'JP',
    region: '京都府',
    city: '京都市',
    category: 'park',
  },
  {
    provider: 'fixture',
    providerPlaceId: 'fixture:rijksmuseum',
    name: 'Rijksmuseum',
    latitude: 52.36,
    longitude: 4.8852,
    address: 'Museumstraat 1, 1071 XX Amsterdam',
    countryCode: 'NL',
    region: 'Noord-Holland',
    city: 'Amsterdam',
    category: 'museum',
  },
  {
    provider: 'fixture',
    providerPlaceId: 'fixture:vondelpark',
    name: 'Vondelpark',
    latitude: 52.3579,
    longitude: 4.8686,
    address: 'Amsterdam, Netherlands',
    countryCode: 'NL',
    region: 'Noord-Holland',
    city: 'Amsterdam',
    category: 'park',
  },
  {
    provider: 'fixture',
    providerPlaceId: 'fixture:blue-bottle-mint-plaza',
    name: 'Blue Bottle Coffee Mint Plaza',
    latitude: 37.7825,
    longitude: -122.4094,
    address: '54 Mint St, San Francisco, CA 94103',
    countryCode: 'US',
    region: 'California',
    city: 'San Francisco',
    category: 'cafe',
  },
  {
    provider: 'fixture',
    providerPlaceId: 'fixture:park-guell',
    name: 'Park Güell',
    latitude: 41.4145,
    longitude: 2.1527,
    address: "08024 Barcelona, Spain",
    countryCode: 'ES',
    region: 'Catalunya',
    city: 'Barcelona',
    category: 'park',
  },
]
