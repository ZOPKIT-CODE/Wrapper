import { CardLoading } from '@/components/common/feedback/LoadingStates'

export function RoleLoadingState() {
  return (
    <CardLoading
      title="Roles"
      description="Loading role definitions…"
      showHeader={false}
    />
  )
}
