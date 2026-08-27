import { createServerFn } from '@tanstack/react-start'

/**
 * auth.ts は cloudflare:workers に依存していてクライアントバンドルへ
 * 持ち込めないため、いずれも handler の中で動的に読み込む。
 */

/**
 * クライアントへ管理者かどうかだけを渡す。
 * 一般閲覧者には管理UIを一切見せないため、UI の出し分けに使う
 * （docs/04-ui-spec.md）。表示の制御でしかないので、実際の防御は
 * 各 write の requireAdmin() が担う。
 */
export const getIsAdmin = createServerFn({ method: 'GET' }).handler(
  async (): Promise<boolean> => {
    const { isAdmin } = await import('./auth')
    return isAdmin()
  },
)

export type AdminStatus =
  /** 未ログイン */
  | { state: 'anonymous' }
  /** ログイン済みだが ADMIN_GOOGLE_EMAIL と一致しない */
  | { state: 'not-admin'; email: string }
  | { state: 'admin'; email: string; name?: string; avatarUrl?: string }

/** `/admin` の表示に使う。ログイン状態と管理権限を区別して返す。 */
export const getAdminStatus = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminStatus> => {
    const { getAdminSession, getLoginSession } = await import('./auth')

    const admin = await getAdminSession()
    if (admin) {
      return {
        state: 'admin',
        email: admin.email,
        name: admin.name,
        avatarUrl: admin.avatarUrl,
      }
    }

    const user = await getLoginSession()
    if (user?.email) return { state: 'not-admin', email: user.email }

    return { state: 'anonymous' }
  },
)
