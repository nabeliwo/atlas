import { createServerFn } from '@tanstack/react-start'

/**
 * クライアントへ管理者かどうかだけを渡す。
 * 一般閲覧者には管理UIを一切見せないため、UI の出し分けに使う
 * （docs/04-ui-spec.md）。表示の制御でしかないので、実際の防御は
 * 各 write の requireAdmin() が担う。
 *
 * auth.ts は cloudflare:workers に依存していてクライアントバンドルへ
 * 持ち込めないため、handler の中で動的に読み込む。
 */
export const getIsAdmin = createServerFn({ method: 'GET' }).handler(
  async (): Promise<boolean> => {
    const { isAdmin } = await import('./auth')
    return isAdmin()
  },
)
