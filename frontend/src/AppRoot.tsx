import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import { RouterProvider } from '@tanstack/react-router'
import { NuqsAdapter } from 'nuqs/adapters/react'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { KindeProvider } from '@/components/auth/KindeProvider'
import { Toaster } from '@/components/ui/sonner'
import { ErrorBoundary } from '@/errors/ErrorBoundary'
import { router } from '@/routes/router'
import { NetworkQualityBanner } from '@/components/network/NetworkQualityBanner'
import { UpdateAvailableBanner } from '@/components/UpdateAvailableBanner'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: (failureCount, error) => {
        const status = axios.isAxiosError(error)
          ? error.response?.status
          : undefined
        if (status !== undefined && status >= 400 && status < 500) {
          return false
        }
        return failureCount < 3
      },
    },
    mutations: {
      retry: false,
    },
  },
})

export const AppRoot = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <NuqsAdapter>
          <ThemeProvider defaultTheme="light" storageKey="zopkit-theme">
            <Toaster position="top-right" richColors offset="80px" gap={12} />
            <NetworkQualityBanner />
            {/*
             * UpdateAvailableBanner is mounted here, ABOVE <RouterProvider>, which means
             * the TanStack Router context is not yet available at this depth.
             * Do NOT use useLocation() / useRouterState() inside the banner — they crash
             * with "Cannot read properties of null (reading 'isServer')".
             * The banner uses its own useCurrentPathname() hook that subscribes to
             * popstate and monkey-patches history.pushState/replaceState instead.
             */}
            <UpdateAvailableBanner />
            <KindeProvider>
              <RouterProvider router={router} />
            </KindeProvider>
          </ThemeProvider>
        </NuqsAdapter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
