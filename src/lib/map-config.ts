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
    /**
     * 実際の初期ズームは画面幅から worldFillZoom() で決める。
     * これは画面幅が取れなかったときの控えの値。
     */
    zoom: 1.2,
  },

  minZoom: 0,
  maxZoom: 18,
} as const

/** MapLibre のズーム定義では、世界の横幅は 512 * 2^zoom（CSS px）。 */
const WORLD_WIDTH_AT_ZOOM_0 = 512

/**
 * 世界地図が画面幅にちょうど収まるズーム。
 *
 * 初期表示に使う。固定値にすると、画面が広いほど世界が2枚並んで見える。
 *
 * 引きの限界には使わない。引いた結果として世界が繰り返し描かれるのは
 * 地図として自然なので、そこはユーザーに任せる。
 */
export function worldFillZoom(widthInPixels: number): number {
  if (widthInPixels <= 0) return 0
  return Math.max(0, Math.log2(widthInPixels / WORLD_WIDTH_AT_ZOOM_0))
}

/**
 * 地図側の主張を抑えるための調整。
 *
 * このアプリの主役は「自分が行った場所」で、地図はその背景。
 * 素の positron は道路番号のシールドや道路名が濃く、拡大すると
 * Place のピンより目立ってしまう。ナビゲーション用の情報は
 * Atlas では使わないので、思い切って落とす。
 *
 * レイヤーIDは provider 固有なので、タイルを差し替えたらここも見直す
 * （見つからないIDは黙って無視されるので、壊れはしない）。
 */
export const basemapAdjustments = {
  /** 道路番号のシールド。経路探索の道具で、記憶の地図には要らない。 */
  hide: [
    'highway-shield-non-us',
    'highway-shield-us-interstate',
    'road_shield_us',
  ],

  /**
   * 消すと現在地が分からなくなるが、濃いままだとピンと競合するもの。
   * 残しつつ後退させる。
   */
  dim: [
    { id: 'highway-name-major', opacity: 0.45 },
    { id: 'highway-name-minor', opacity: 0.4 },
    { id: 'highway-name-path', opacity: 0.35 },
    { id: 'label_other', opacity: 0.55 },
    { id: 'label_village', opacity: 0.6 },
    { id: 'label_town', opacity: 0.7 },
  ],
} as const
