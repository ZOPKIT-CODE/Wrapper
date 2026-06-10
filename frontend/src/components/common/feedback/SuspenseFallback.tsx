import { ZopkitRoundLoader } from "@/components/common/feedback/ZopkitRoundLoader"

export function SuspenseFallback() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
      <ZopkitRoundLoader size="page" />
    </div>
  )
}
