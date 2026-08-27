import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { env } from 'cloudflare:workers'

import { getDb } from '@/db'
import * as authSchema from '@/db/auth-schema'

/**
 * Better Auth の設定。
 *
 * このアプリはマルチユーザーサービスではない。
 * 一般ユーザー向けのログイン概念は存在せず、Google でログインできるのは
 * 事実上の管理者候補だけ（docs/02-concepts.md）。
 *
 * ログインできること自体は権限を意味しない。
 * 管理権限は ADMIN_GOOGLE_EMAIL との完全一致で別途判定する（auth.ts）。
 *
 * このモジュールは cloudflare:workers に依存するため、
 * クライアントから import しないこと。
 */
export function getAuth() {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,

    database: drizzleAdapter(getDb(), {
      provider: 'sqlite',
      schema: authSchema,
    }),

    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },

    // メール/パスワードは使わない。入口は Google のみ。
    emailAndPassword: { enabled: false },
  })
}
