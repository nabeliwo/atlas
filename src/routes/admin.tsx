import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'

import { authClient } from '@/lib/auth-client'
import { getAdminStatus } from '@/server/admin'

/**
 * 管理者の入口。
 *
 * 一般UIにはログインボタンを出さないため（docs/03-user-flows.md）、
 * ここを直接開くのが唯一の入口になる。
 *
 * ログインできること自体は権限を意味しない。
 * 許可されたGoogleアカウントかどうかをサーバー側で判定して表示を分ける。
 */
export const Route = createFileRoute('/admin')({
  loader: () => getAdminStatus(),
  component: AdminPage,
})

function AdminPage() {
  const status = Route.useLoaderData()
  const [busy, setBusy] = useState(false)

  const signIn = async () => {
    setBusy(true)
    await authClient.signIn.social({ provider: 'google', callbackURL: '/admin' })
  }

  const signOut = async () => {
    setBusy(true)
    try {
      await authClient.signOut()
      window.location.reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-border p-6">
        <h1 className="text-lg font-semibold">Atlas 管理</h1>

        {status.state === 'anonymous' ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              管理者のGoogleアカウントでログインしてください。
            </p>
            <button
              type="button"
              onClick={signIn}
              disabled={busy}
              className="mt-5 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? '移動中…' : 'Google でログイン'}
            </button>
          </>
        ) : status.state === 'not-admin' ? (
          <>
            <p className="mt-2 text-sm">
              <span className="font-medium">{status.email}</span> でログインしていますが、
              このアカウントには管理権限がありません。
            </p>
            <button
              type="button"
              onClick={signOut}
              disabled={busy}
              className="mt-5 w-full rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-secondary disabled:opacity-50"
            >
              ログアウト
            </button>
          </>
        ) : (
          <>
            <div className="mt-4 flex items-center gap-3">
              {status.avatarUrl ? (
                <img
                  src={status.avatarUrl}
                  alt=""
                  className="size-10 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {status.name ?? status.email}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {status.email}
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              管理者としてログインしています。地図から訪問の追加・編集ができます。
            </p>

            <Link
              to="/"
              className="mt-5 block w-full rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              地図へ戻る
            </Link>
            <button
              type="button"
              onClick={signOut}
              disabled={busy}
              className="mt-2 w-full rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-secondary disabled:opacity-50"
            >
              ログアウト
            </button>
          </>
        )}
      </div>
    </main>
  )
}
