import type { AxiosRequestConfig } from 'axios'
import { Container } from '@/components/common/Page'
import { OrganizationManagement } from '@/features/organizations/components/OrganizationManagement'
import { useDashboardData } from '@/hooks/useDashboardData'
import { useOrganizationAuth } from '@/hooks/useOrganizationAuth'
import api from '@/lib/api'

export function OrganizationPage({ isAdmin = false }: { isAdmin?: boolean }) {
  const { tenantId } = useOrganizationAuth()

  const {
    users: employees,
    applications,
    refreshDashboard,
  } = useDashboardData()

  return (
    <Container>
      <OrganizationManagement
        employees={employees || []}
        isAdmin={isAdmin || false}
        tenantId={tenantId}
        applications={applications || []}
        makeRequest={async (endpoint: string, options?: RequestInit) => {
          // Use enhanced api.ts for proper authentication and error handling
          // TODO: use axios interceptors
          // Vite proxy handles /api routing, so just ensure proper endpoint format
          const normalizedEndpoint = endpoint.startsWith('/')
            ? endpoint
            : `/${endpoint}`
          // Axios baseURL already includes /api, so don't add it again
          const apiPath = normalizedEndpoint

          // Configure request with proper headers and convert body to data for axios
          // Build axios-compatible headers object
          const headers: Record<string, string> = { 'X-Application': 'crm' }
          if (options?.headers) {
            const h = options.headers
            if (typeof Headers !== 'undefined' && h instanceof Headers) {
              h.forEach((value: string, key: string) => {
                headers[key] = String(value)
              })
            } else if (Array.isArray(h)) {
              h.forEach(([key, value]: [string, string]) => {
                headers[key] = String(value)
              })
            } else {
              Object.assign(headers, h as Record<string, string>)
            }
          }

          const axiosConfig: AxiosRequestConfig = {
            method: options?.method,
            headers,
            withCredentials: true,
          }

          // Convert fetch-style body to axios-style data
          if (options?.body) {
            try {
              axiosConfig.data =
                typeof options.body === 'string'
                  ? JSON.parse(options.body)
                  : options.body
            } catch {
              axiosConfig.data = options.body
            }
          }

          const response = await api(apiPath, axiosConfig)
          return response.data
        }}
        loadDashboardData={refreshDashboard}
        inviteEmployee={() => {
          // Implement invite employee function
        }}
      />
    </Container>
  )
}

export default OrganizationPage
