import { createFileRoute } from '@tanstack/react-router'

import { MapView } from '@/components/map/MapView'

export const Route = createFileRoute('/')({
  component: HomePage,
})

/**
 * 公開URL `/` はそのまま地図。
 * 誰でも閲覧でき、一般閲覧者には管理者向けUIを一切見せない。
 */
function HomePage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView />
    </main>
  )
}
