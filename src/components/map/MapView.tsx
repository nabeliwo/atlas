import { useEffect, useRef, useState } from 'react'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'

import { basemapAdjustments, mapConfig } from '@/lib/map-config'
import type { MapPlace } from '@/server/places'
import {
  CLUSTER_COUNT_LAYER_ID,
  CLUSTER_LAYER_ID,
  PLACES_SOURCE_ID,
  PLACE_LABEL_LAYER_ID,
  PLACE_LAYER_ID,
  clusterCountLayer,
  clusterLayer,
  placeLabelLayer,
  placeLayer,
  placesSource,
  toFeatureCollection,
} from './place-layers'

type MapViewProps = {
  places: Array<MapPlace>
  selectedPlaceId?: string
  onSelectPlace: (placeId: string) => void
}

/** 選択した Place へ寄るときのズーム。Place 名ラベルが出る程度まで寄せる。 */
const FOCUS_ZOOM = 14

/**
 * MapLibre は browser 専用なので、SSR 時に評価されないよう dynamic import する。
 */
export function MapView({ places, selectedPlaceId, onSelectPlace }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  // 最新値を effect の外から参照するための ref（map の再生成を避ける）
  const placesRef = useRef(places)
  placesRef.current = places
  const onSelectPlaceRef = useRef(onSelectPlace)
  onSelectPlaceRef.current = onSelectPlace

  /**
   * ピンのクリックで選択された Place。
   * この場合は地図をすでに見ている位置なので、flyTo で動かさない。
   * 検索や URL 直接アクセスで選択されたときだけ移動する。
   */
  const selectedByClickRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false

    void (async () => {
      const { Map, NavigationControl } = await import('maplibre-gl')
      if (cancelled) return

      const map = new Map({
        container,
        style: mapConfig.styleUrl,
        center: mapConfig.initialView.center,
        zoom: mapConfig.initialView.zoom,
        minZoom: mapConfig.minZoom,
        maxZoom: mapConfig.maxZoom,
        attributionControl: { compact: true },
      })

      // 右側は詳細パネルが使うので、操作系は左に寄せる
      map.addControl(new NavigationControl({ showCompass: false }), 'bottom-left')
      map.on('error', () => setFailed(true))

      map.on('load', () => {
        if (cancelled) return

        muteBasemap(map)

        map.addSource(
          PLACES_SOURCE_ID,
          placesSource(toFeatureCollection(placesRef.current)),
        )
        map.addLayer(clusterLayer)
        map.addLayer(clusterCountLayer)
        map.addLayer(placeLayer)
        map.addLayer(placeLabelLayer)

        /*
         * レイヤーに直接 click を張ると、判定が円の内側だけになる。
         * ピンの直径は最大でも 38px 前後で、指で正確に押すには小さい。
         * タップ位置のまわりに矩形を取って探すことで、見た目を変えずに
         * 当たり判定だけ広げる。
         */
        map.on('click', (event) => {
          const pad = hitPadding()
          const box: [[number, number], [number, number]] = [
            [event.point.x - pad, event.point.y - pad],
            [event.point.x + pad, event.point.y + pad],
          ]

          /*
           * 個別ピンを優先する。クラスタは面積が大きく、重なると常に勝ってしまう。
           * Place 名のラベルも同じ feature なので、文字を押しても選べるようにする。
           * 文字は面積が広く、スマホでは実質的な的が大きくなる。
           */
          const points = map.queryRenderedFeatures(box, {
            layers: [PLACE_LAYER_ID, PLACE_LABEL_LAYER_ID],
          })
          const id = points[0]?.properties?.id
          if (typeof id === 'string') {
            selectedByClickRef.current = id
            onSelectPlaceRef.current(id)
            return
          }

          const clusters = map.queryRenderedFeatures(box, {
            layers: [CLUSTER_LAYER_ID],
          })
          const cluster = clusters[0]
          const clusterId = cluster?.properties?.cluster_id
          if (clusterId === undefined) return

          // クラスタは、それが解けるズームまで寄る
          const source = map.getSource(PLACES_SOURCE_ID) as GeoJSONSource
          void source.getClusterExpansionZoom(clusterId).then((zoom) => {
            const geometry = cluster?.geometry
            if (geometry?.type !== 'Point') return
            map.easeTo({
              center: geometry.coordinates as [number, number],
              zoom,
            })
          })
        })

        for (const layerId of [
          CLUSTER_LAYER_ID,
          CLUSTER_COUNT_LAYER_ID,
          PLACE_LAYER_ID,
          PLACE_LABEL_LAYER_ID,
        ]) {
          map.on('mouseenter', layerId, () => {
            map.getCanvas().style.cursor = 'pointer'
          })
          map.on('mouseleave', layerId, () => {
            map.getCanvas().style.cursor = ''
          })
        }

        setReady(true)
      })

      mapRef.current = map
    })()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [])

  // 期間フィルターなどで対象 Place が変わったら source を差し替える
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    const source = map.getSource(PLACES_SOURCE_ID) as GeoJSONSource | undefined
    source?.setData(toFeatureCollection(places))
  }, [places, ready])

  // 選択状態の反映（色と輪郭は feature-state を見て変わる）
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    map.removeFeatureState({ source: PLACES_SOURCE_ID })
    if (!selectedPlaceId) return

    map.setFeatureState(
      { source: PLACES_SOURCE_ID, id: selectedPlaceId },
      { selected: true },
    )
  }, [selectedPlaceId, ready])

  // 検索・URL から選択されたときだけ、その Place へ移動する
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !selectedPlaceId) return

    if (selectedByClickRef.current === selectedPlaceId) {
      selectedByClickRef.current = undefined
      return
    }

    const place = places.find((p) => p.id === selectedPlaceId)
    if (!place) return

    map.flyTo({
      center: [place.longitude, place.latitude],
      zoom: Math.max(map.getZoom(), FOCUS_ZOOM),
      offset: panelOffset(),
    })
  }, [selectedPlaceId, places, ready])

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
      {failed ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <p className="pointer-events-auto rounded-full border border-border bg-background/95 px-4 py-2 text-sm text-muted-foreground shadow-sm">
            地図の読み込みに失敗しました。通信環境を確認してください。
          </p>
        </div>
      ) : null}
    </div>
  )
}

/**
 * タップ位置から探す範囲（px）。
 *
 * 指はマウスより不正確なので、タッチ環境では広く取る。
 * 半径 9px のピンに 16px の余裕を足すと、実質 50px 角の的になり、
 * タッチターゲットの目安（44px 前後）を満たす。
 */
function hitPadding(): number {
  if (typeof window === 'undefined') return 6
  return window.matchMedia('(pointer: coarse)').matches ? 16 : 6
}

/**
 * 地図側の要素を後退させ、Place のピンが主役になるようにする。
 * 存在しないレイヤーIDは無視する（provider を替えても壊れない）。
 */
function muteBasemap(map: MapLibreMap) {
  for (const id of basemapAdjustments.hide) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none')
  }

  for (const { id, opacity } of basemapAdjustments.dim) {
    if (!map.getLayer(id)) continue
    map.setPaintProperty(id, 'text-opacity', opacity)
    map.setPaintProperty(id, 'icon-opacity', opacity)
  }
}

/**
 * 詳細パネル/ボトムシートに隠れない位置へ寄せるためのオフセット。
 * PC は右のパネル分だけ左へ、スマホは下のシート分だけ上へずらす。
 */
function panelOffset(): [number, number] {
  if (typeof window === 'undefined') return [0, 0]

  const isDesktop = window.matchMedia('(min-width: 768px)').matches
  if (isDesktop) return [-Math.min(window.innerWidth * 0.16, 190), 0]

  return [0, -window.innerHeight * 0.2]
}
