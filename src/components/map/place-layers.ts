import type { FeatureCollection, Point } from 'geojson'
import type {
  CircleLayerSpecification,
  GeoJSONSourceSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl'

import type { MapPlace } from '@/server/places'

export const PLACES_SOURCE_ID = 'places'
export const CLUSTER_LAYER_ID = 'places-cluster'
export const CLUSTER_COUNT_LAYER_ID = 'places-cluster-count'
export const PLACE_LAYER_ID = 'places-point'
export const PLACE_LABEL_LAYER_ID = 'places-label'

/**
 * 色が持つ意味は1つだけ ―― 「記憶の厚み」。
 *
 * docs/04-ui-spec.md は「色分けでカテゴリを表現しない」と定める。
 * 種別には色を使わない一方で、同じ色相の濃淡で訪問回数を表すのは
 * 「Visit回数が多いほど視覚的に強くする」という同ドキュメントの要求に沿う。
 *
 * サイズと色の二重符号化にしているのは、小さいピンではサイズ差が
 * 読み取りにくいため。どちらか一方でも意味が伝わる。
 */
const PIN_1_VISIT = '#7aadc6'
const PIN_3_VISITS = '#4e8fae'
const PIN_6_VISITS = '#2f6f8f'
const PIN_12_VISITS = '#17475f'

/** 選択中は色ではなく輪郭で示す。色は回数の意味に使い切っているため。 */
const PIN_STROKE_SELECTED = '#17475f'

export type PlaceFeatureProperties = {
  id: string
  name: string
  visitCount: number
}

export function toFeatureCollection(
  places: Array<MapPlace>,
): FeatureCollection<Point, PlaceFeatureProperties> {
  return {
    type: 'FeatureCollection',
    features: places.map((place) => ({
      type: 'Feature',
      id: place.id,
      geometry: {
        type: 'Point',
        coordinates: [place.longitude, place.latitude],
      },
      properties: {
        id: place.id,
        name: place.name,
        visitCount: place.visitCount,
      },
    })),
  }
}

export function placesSource(
  data: FeatureCollection,
): GeoJSONSourceSpecification {
  return {
    type: 'geojson',
    data,
    // feature-state で選択状態を扱うため、Place id を feature id に昇格させる
    promoteId: 'id',
    cluster: true,
    clusterRadius: 48,
    // これ以上ズームしたらクラスタを解いて個別ピンにする
    clusterMaxZoom: 12,
  }
}

export const clusterLayer: CircleLayerSpecification = {
  id: CLUSTER_LAYER_ID,
  type: 'circle',
  source: PLACES_SOURCE_ID,
  filter: ['has', 'point_count'],
  paint: {
    // 個別ピンと同じ「多いほど濃い」規則を、束ねた Place 数にも適用する
    'circle-color': [
      'step',
      ['get', 'point_count'],
      PIN_3_VISITS,
      10,
      PIN_6_VISITS,
      30,
      PIN_12_VISITS,
    ],
    'circle-opacity': 0.9,
    // point_count は「束ねられた Place の数」。Visit 数ではない。
    'circle-radius': ['step', ['get', 'point_count'], 15, 5, 20, 20, 26],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#ffffff',
  },
}

export const clusterCountLayer: SymbolLayerSpecification = {
  id: CLUSTER_COUNT_LAYER_ID,
  type: 'symbol',
  source: PLACES_SOURCE_ID,
  filter: ['has', 'point_count'],
  layout: {
    'text-field': ['get', 'point_count_abbreviated'],
    'text-font': ['Noto Sans Bold'],
    'text-size': 12,
    'text-allow-overlap': true,
  },
  paint: {
    'text-color': '#ffffff',
  },
}

/** 個別ピン。Visit 回数が多いほど大きくする（docs/04-ui-spec.md）。 */
export const placeLayer: CircleLayerSpecification = {
  id: PLACE_LAYER_ID,
  type: 'circle',
  source: PLACES_SOURCE_ID,
  filter: ['!', ['has', 'point_count']],
  paint: {
    // 訪問回数が多いほど濃い。1回でも地図の下地から浮く明度に留めてある。
    'circle-color': [
      'interpolate',
      ['linear'],
      ['get', 'visitCount'],
      1, PIN_1_VISIT,
      3, PIN_3_VISITS,
      6, PIN_6_VISITS,
      12, PIN_12_VISITS,
    ],
    'circle-opacity': 0.9,
    'circle-radius': [
      'interpolate',
      ['linear'],
      ['get', 'visitCount'],
      1, 6,
      2, 8,
      5, 12,
      10, 16,
    ],
    'circle-stroke-color': [
      'case',
      ['boolean', ['feature-state', 'selected'], false],
      PIN_STROKE_SELECTED,
      '#ffffff',
    ],
    'circle-stroke-width': [
      'case',
      ['boolean', ['feature-state', 'selected'], false],
      3.5,
      2,
    ],
  },
}

/**
 * Place 名。広域では出さず、一定ズーム以上で表示する。
 * ラベル衝突の回避は MapLibre のレイアウトに任せる（text-allow-overlap を立てない）。
 */
export const placeLabelLayer: SymbolLayerSpecification = {
  id: PLACE_LABEL_LAYER_ID,
  type: 'symbol',
  source: PLACES_SOURCE_ID,
  filter: ['!', ['has', 'point_count']],
  minzoom: 11,
  layout: {
    'text-field': ['get', 'name'],
    'text-font': ['Noto Sans Regular'],
    'text-size': 12,
    'text-offset': [0, 1.2],
    'text-anchor': 'top',
    'text-max-width': 10,
  },
  paint: {
    'text-color': '#1b1d1f',
    'text-halo-color': '#ffffff',
    'text-halo-width': 1.5,
  },
}
