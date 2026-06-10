import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader'

export function SuspenseFallback() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <ZopkitRoundLoader size="page" />
    </div>
  )
}
