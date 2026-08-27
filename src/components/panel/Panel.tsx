import { useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

type PanelProps = {
  title?: ReactNode
  onClose: () => void
  children: ReactNode
  /** 閉じるボタンの読み上げ用ラベル */
  closeLabel?: string
}

/**
 * 地図の上に重ねるパネルの外殻。
 * PC は右のサイドパネル、スマホはボトムシート（docs/04-ui-spec.md）。
 * 地図を残したまま表示し、別ページへ遷移しない。
 *
 * 詳細表示と入力フォームで同じ器を使う。スマホでは
 * 「追加/編集フォームも同じボトムシート内で切り替える」ため。
 */
export function Panel({ onClose, children, closeLabel = '閉じる' }: PanelProps) {
  // スマホでは本文を読む/書くために十分広げられるようにする
  const [expanded, setExpanded] = useState(false)

  return (
    <aside
      className={cn(
        'absolute z-10 flex flex-col overflow-hidden bg-background shadow-lg',
        // mobile: bottom sheet
        'inset-x-0 bottom-0 rounded-t-2xl border-t border-border',
        expanded ? 'h-[85dvh]' : 'h-[55dvh]',
        // desktop: side panel（左は操作系、右は詳細、という住み分け）
        'md:inset-y-4 md:left-auto md:bottom-auto md:right-4 md:h-auto md:max-h-[calc(100dvh-2rem)]',
        'md:w-[380px] md:rounded-xl md:border',
      )}
    >
      <button
        type="button"
        className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-border md:hidden"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? 'シートを縮める' : 'シートを広げる'}
      />

      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="absolute right-3 top-3 z-10 rounded-md bg-background/80 p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-4">
        {children}
      </div>
    </aside>
  )
}
