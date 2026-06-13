import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader'

export function SuspenseFallback() {
  return (
    <div className="bg-background fixed inset-0 z-50 flex items-center justify-center">
      <ZopkitRoundLoader size="page" />
    </div>
  )
}
