import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        // 地図を全画面で扱うため、ユーザースケールは地図側のジェスチャに任せる
        content:
          'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover',
      },
      { title: 'Atlas' },
      {
        name: 'description',
        content: '人生で記憶に残した場所を、地図という形でコレクションする。',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      /*
       * 地図のピンと同じ色・同じ形にして、タブでも何のアプリか分かるようにする。
       * SVG 1枚で全サイズを賄う。
       */
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
  }),
  shellComponent: RootDocument,
  // 既定の <p>Not Found</p> や生のエラーをそのまま出さない
  notFoundComponent: () => (
    <Fallback
      title="ページが見つかりません"
      description="URL が正しいか確認してください。"
    />
  ),
  errorComponent: ({ error }) => (
    <Fallback
      title="問題が発生しました"
      description={
        import.meta.env.DEV && error instanceof Error
          ? error.message
          : '時間をおいて、もう一度お試しください。'
      }
    />
  ),
})

function Fallback({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <main className="flex h-dvh items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <a
          href="/"
          className="mt-5 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          地図へ戻る
        </a>
      </div>
    </main>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{ position: 'bottom-left' }}
            plugins={[
              { name: 'TanStack Router', render: <TanStackRouterDevtoolsPanel /> },
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  )
}
