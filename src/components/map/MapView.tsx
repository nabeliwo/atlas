import { useEffect, useRef, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'

import { mapConfig } from '@/lib/map-config'

type MapViewProps = {
  /** 地図の準備ができた時点で呼ばれる。Place レイヤーの追加はここから行う。 */
  onReady?: (map: MapLibreMap) => void
}

/**
 * MapLibre をマウントするだけのコンポーネント。
 * MapLibre は browser 専用なので、SSR 時に評価されないよう dynamic import する。
 */
export function MapView({ onReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const onReadyRef = useRef(onReady)
  const [failed, setFailed] = useState(false)

  onReadyRef.current = onReady

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

      map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
      map.on('error', () => setFailed(true))
      map.on('load', () => {
        if (!cancelled) onReadyRef.current?.(map)
      })

      mapRef.current = map
    })()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
      {failed ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <p className="pointer-events-auto rounded-full bg-background/95 border border-border px-4 py-2 text-sm text-muted-foreground shadow-sm">
            地図の読み込みに失敗しました。通信環境を確認してください。
          </p>
        </div>
      ) : null}
    </div>
  )
}
