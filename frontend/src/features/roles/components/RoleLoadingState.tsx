import { RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function RoleLoadingState() {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <RefreshCw className="mx-auto h-8 w-8 animate-spin text-gray-400" />
        <p className="mt-3 font-medium text-gray-600">Loading roles...</p>
      </CardContent>
    </Card>
  )
}
