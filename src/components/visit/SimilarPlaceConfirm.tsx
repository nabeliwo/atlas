import { Panel } from '@/components/panel/Panel'
import type { PlaceSuggestion } from '@/server/place-search'
import type { SimilarPlace } from '@/server/visits'

type SimilarPlaceConfirmProps = {
  suggestion: PlaceSuggestion
  similar: SimilarPlace
  onUseExisting: () => void
  onCreateNew: () => void
  onClose: () => void
}

/**
 * 同名の Place が近くにある場合の確認。
 *
 * 外部の施設データは、1つの実在の場所に複数のフィーチャを持つことがある
 * （「清澄庭園」が公園と駐輪場として別々に登録されている等）。
 * それらを別々に登録すると「同一施設は同一Place」が破れるが、
 * 同名の別店舗という可能性もあるため自動では決められない。
 */
export function SimilarPlaceConfirm({
  suggestion,
  similar,
  onUseExisting,
  onCreateNew,
  onClose,
}: SimilarPlaceConfirmProps) {
  return (
    <Panel onClose={onClose}>
      <div className="pr-8">
        <h2 className="text-lg leading-snug font-semibold">
          近くに同じ名前の場所があります
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          同じ場所が二重に登録されるのを防ぐため、確認します。
        </p>
      </div>

      <div className="mt-5 space-y-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">登録済み（約 {similar.distanceMeters}m）</p>
          <p className="mt-1 text-sm font-medium">{similar.name}</p>
          {similar.address ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{similar.address}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            訪問 {similar.visitCount} 回
          </p>
        </div>

        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">これから追加しようとしている場所</p>
          <p className="mt-1 text-sm font-medium">{suggestion.name}</p>
          {suggestion.address ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{suggestion.address}</p>
          ) : null}
          {suggestion.category ? (
            <p className="mt-1 text-xs text-muted-foreground">{suggestion.category}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <button
          type="button"
          onClick={onUseExisting}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          同じ場所なので、登録済みに追加する
        </button>
        <button
          type="button"
          onClick={onCreateNew}
          className="w-full rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-secondary"
        >
          別の場所として登録する
        </button>
      </div>
    </Panel>
  )
}
