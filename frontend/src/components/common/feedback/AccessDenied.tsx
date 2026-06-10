import { Card, CardContent } from '@/components/ui'
import { Shield } from 'lucide-react'
import { Typography } from '@/components/common/Typography'

export const AccessDenied = ({
  title = 'Access Restricted',
  description = "you don't have the right permissions to view this page.",
}: {
  title?: string
  description?: string
}) => {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <Shield className="mx-auto mb-4 h-12 w-12 text-gray-400" />
        <Typography variant="h3">{title}</Typography>
        <Typography variant="lead">{description}</Typography>
      </CardContent>
    </Card>
  )
}
