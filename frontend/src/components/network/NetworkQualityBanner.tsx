import { useEffect, useState, useRef } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { BACKEND_STATUS_EVENT, NETWORK_QUALITY_EVENT } from '@/lib/api/client'

// Grace period before showing the backend-down banner (ms).
// Prevents a single transient error on page load from triggering the banner.
const BACKEND_DOWN_GRACE_MS = 5_000

export function NetworkQualityBanner() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  )
  const [showSlowBanner, setShowSlowBanner] = useState(false)
  const [isBackendDown, setIsBackendDown] = useState(false)
  const backendDownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handleOffline = () => setIsOffline(true)
    const handleOnline = () => setIsOffline(false)

    const handleNetworkQuality = (event: Event) => {
      const detail = (event as CustomEvent<{ showBanner?: boolean }>).detail
      setShowSlowBanner(detail?.showBanner === true)
    }

    const handleBackendStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ isBackendDown?: boolean }>).detail
      const down = detail?.isBackendDown === true

      if (down) {
        // Only surface the banner after the grace period — avoids flashing
        // on transient page-load errors.
        backendDownTimerRef.current = setTimeout(() => {
          setIsBackendDown(true)
        }, BACKEND_DOWN_GRACE_MS)
      } else {
        if (backendDownTimerRef.current) {
          clearTimeout(backendDownTimerRef.current)
          backendDownTimerRef.current = null
        }
        setIsBackendDown(false)
      }
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    window.addEventListener(NETWORK_QUALITY_EVENT, handleNetworkQuality as EventListener)
    window.addEventListener(BACKEND_STATUS_EVENT, handleBackendStatus as EventListener)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener(NETWORK_QUALITY_EVENT, handleNetworkQuality as EventListener)
      window.removeEventListener(BACKEND_STATUS_EVENT, handleBackendStatus as EventListener)
      if (backendDownTimerRef.current) clearTimeout(backendDownTimerRef.current)
    }
  }, [])

  const showBackendDownBanner = !isOffline && isBackendDown
  const visible = isOffline || showBackendDownBanner || showSlowBanner
  if (!visible) return null

  return (
    <div className="fixed top-0 inset-x-0 z-[110] flex justify-center pointer-events-none">
      <div
        className={`mt-2 pointer-events-auto rounded-md px-4 py-2 shadow-lg text-sm font-medium border ${
          isOffline || showBackendDownBanner
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-amber-50 text-amber-700 border-amber-200'
        }`}
      >
        <span className="inline-flex items-center gap-2">
          {isOffline ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
          {isOffline
            ? 'You are offline. Some features may not work.'
            : showBackendDownBanner
            ? 'Backend is temporarily unavailable. Retrying…'
            : 'Connection is slow. Requests may take longer than usual.'}
        </span>
      </div>
    </div>
  )
}

export default NetworkQualityBanner
