import { env } from 'cloudflare:workers'

/**
 * 管理者の認可。
 *
 * docs/06-technical-design.md より、authentication だけでは不足で、
 * 「このGoogleアカウントが唯一の管理者か」を必ず判定する。
 * write 系の server function は例外なく requireAdmin() を通す。
 *
 * Better Auth の組み込みは未完了。現時点では:
 *   - 本番: セッションを解決できないため、常に未認可（write は全て失敗する）
 *   - 開発: DEV_ADMIN_BYPASS=1 のときだけ認可する
 *
 * bypass は import.meta.env.DEV で囲ってあるので、本番ビルドでは
 * 条件が静的に false になり、コードごと落ちる。
 *
 * このモジュールは cloudflare:workers に依存するため、
 * クライアントから import してはいけない。
 * UI の出し分けに使う管理者フラグは server/admin.ts 経由で取得する。
 */

export type AdminSession = {
  email: string
  name?: string
  avatarUrl?: string
}

export async function getAdminSession(): Promise<AdminSession | null> {
  if (import.meta.env.DEV && env.DEV_ADMIN_BYPASS === '1') {
    return { email: env.ADMIN_GOOGLE_EMAIL || 'dev@example.com', name: 'dev' }
  }

  // TODO(Phase 3): Better Auth のセッションを解決し、
  // session.user.email === env.ADMIN_GOOGLE_EMAIL を完全一致で確認する。
  return null
}

export async function isAdmin(): Promise<boolean> {
  return (await getAdminSession()) !== null
}

/** write 系 server function の先頭で必ず呼ぶ。 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession()
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}
