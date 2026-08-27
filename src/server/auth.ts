import { env } from 'cloudflare:workers'
import { getRequest } from '@tanstack/react-start/server'

import { getAuth } from './auth-config'

/**
 * 管理者の認可。
 *
 * docs/06-technical-design.md より、authentication だけでは不足で、
 * 「このGoogleアカウントが唯一の管理者か」を必ず判定する。
 * write 系の server function は例外なく requireAdmin() を通す。
 *
 * Google でログインできること自体は権限を意味しない。
 * ADMIN_GOOGLE_EMAIL と完全一致した場合にだけ管理権限を与える。
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

/** ログイン済みの Google アカウント。管理者とは限らない。 */
export async function getLoginSession() {
  const request = getRequest()
  const result = await getAuth().api.getSession({ headers: request.headers })
  return result?.user ?? null
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const adminEmail = env.ADMIN_GOOGLE_EMAIL?.trim()
  // 管理者が設定されていないなら、誰も管理者ではない
  if (!adminEmail) return null

  const user = await getLoginSession()
  if (!user?.email) return null

  // 大文字小文字だけを吸収する。部分一致や別ドメインは認めない。
  if (user.email.toLowerCase() !== adminEmail.toLowerCase()) return null

  return {
    email: user.email,
    name: user.name ?? undefined,
    avatarUrl: user.image ?? undefined,
  }
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
