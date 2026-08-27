/**
 * 地図タイル provider 固有の設定はここだけに閉じ込める。
 * docs/06-technical-design.md より、MapLibre 本体と provider は分離し、
 * 後から差し替え・自前ホストできる状態を保つ。
 */

/**
 * MVP のデフォルトは OpenFreeMap の positron スタイル。
 * - API キー不要（開発を止めない）
 * - ライトでミニマル（docs/04-ui-spec.md のテーマ方針に合う）
 *
 * 有料/キー必須の provider（MapTiler 等）へ移す場合は、
 * MAP_STYLE_URL を差し替えるだけで済むようにしておく。
 */
const DEFAULT_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

export const mapConfig = {
  styleUrl: DEFAULT_MAP_STYLE_URL,

  /** 初期表示は世界全体（docs/01-product-spec.md） */
  initialView: {
    center: [10, 20] as [number, number],
    zoom: 1.2,
  },

  minZoom: 1,
  maxZoom: 18,
} as const
