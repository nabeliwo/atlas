import { createAuthClient } from 'better-auth/react'

/**
 * ブラウザ側から認証エンドポイントを叩くクライアント。
 * baseURL は同一オリジンなので指定しない。
 */
export const authClient = createAuthClient()
