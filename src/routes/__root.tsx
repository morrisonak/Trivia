import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import Header from '../components/Header'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Trivia Nights - Real-Time Multiplayer Trivia Game',
      },
      {
        name: 'description',
        content: 'Join the fun with Trivia Nights! Create or join multiplayer trivia rooms, compete with friends in real-time, and test your knowledge across diverse topics.',
      },
      {
        name: 'theme-color',
        content: '#7c3aed',
      },
      // Open Graph
      {
        property: 'og:title',
        content: 'Trivia Nights - Real-Time Multiplayer Trivia Game',
      },
      {
        property: 'og:description',
        content: 'Join the fun with Trivia Nights! Create or join multiplayer trivia rooms, compete with friends in real-time, and test your knowledge.',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      // Twitter Card
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:title',
        content: 'Trivia Nights - Real-Time Multiplayer Trivia Game',
      },
      {
        name: 'twitter:description',
        content: 'Join the fun with Trivia Nights! Create or join multiplayer trivia rooms, compete with friends in real-time.',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon.svg',
      },
      {
        rel: 'apple-touch-icon',
        href: '/logo192.png',
      },
    ],
  }),

  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Header />
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
