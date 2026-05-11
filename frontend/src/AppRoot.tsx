import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { NuqsAdapter } from "nuqs/adapters/react"
import { ThemeProvider } from "@/components/theme/ThemeProvider"
import { KindeProvider } from "@/components/auth/KindeProvider"
import { Toaster } from "@/components/ui/sonner"
import { ErrorBoundary } from "@/errors/ErrorBoundary"
import { router } from "@/routes/router"
import { NetworkQualityBanner } from "@/components/network/NetworkQualityBanner"
import { UpdateAvailableBanner } from "@/components/UpdateAvailableBanner"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: (failureCount, error: any) => {
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
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
          <ThemeProvider defaultTheme="system" storageKey="zopkit-theme">
            <Toaster position="top-right" richColors offset="80px" gap={12} />
            <NetworkQualityBanner />
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
