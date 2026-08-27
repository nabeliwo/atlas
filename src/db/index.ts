import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:workers'

import * as schema from './schema'

export type Db = ReturnType<typeof getDb>

/**
 * D1 binding は server-side からのみ利用できる。
 * client bundle へ漏らさないよう、このモジュールは server function からだけ import する。
 */
export function getDb() {
  return drizzle(env.DB, { schema })
}

export { schema }
