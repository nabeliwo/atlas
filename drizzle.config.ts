import { defineConfig } from 'drizzle-kit'

// マイグレーション SQL の生成にだけ使う。
// 適用は wrangler d1 migrations apply（npm run db:migrate）で行う。
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './db/migrations',
  dialect: 'sqlite',
})
