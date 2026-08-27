import { createFileRoute } from '@tanstack/react-router'

/**
 * Better Auth のエンドポイント。
 * Google の Authorized redirect URI はこの配下の
 * /api/auth/callback/google を指す。
 */
async function handle({ request }: { request: Request }) {
  const { getAuth } = await import('@/server/auth-config')
  return getAuth().handler(request)
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
    },
  },
})
