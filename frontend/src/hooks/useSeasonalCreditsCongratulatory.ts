import { useState, useEffect } from 'react'
import { useUserContext } from '@/contexts/UserContextProvider'
import { useNotifications } from '@/hooks/useNotifications'
import type { Notification } from '@/features/notifications/types'
import type { ModalConfig } from '@/features/notifications/SeasonalCreditsCongratulatoryModal'

// Store shown campaigns instead of a single flag
const getShownCampaigns = () => {
  try {
    const stored = localStorage.getItem('seasonal-credits-congratulatory-shown')

    // Handle migration from old boolean format to new array format
    if (stored === 'true') {
      localStorage.removeItem('seasonal-credits-congratulatory-shown') // Clear old format
      return []
    }

    const parsed = stored ? JSON.parse(stored) : []

    // Ensure it's an array
    if (!Array.isArray(parsed)) {
      localStorage.removeItem('seasonal-credits-congratulatory-shown')
      return []
    }

    return parsed
  } catch (error) {
    localStorage.removeItem('seasonal-credits-congratulatory-shown') // Reset on error
    return []
  }
}

const addShownCampaign = (campaignId: string) => {
  const shown = getShownCampaigns()
  if (!shown.includes(campaignId)) {
    shown.push(campaignId)
    localStorage.setItem(
      'seasonal-credits-congratulatory-shown',
      JSON.stringify(shown)
    )
  }
}

interface SeasonalCreditsData {
  totalCredits: number
  campaignName: string
  hasSeasonalCredits: boolean
  modalConfig?: ModalConfig
}

export const useSeasonalCreditsCongratulatory = () => {
  const { user, loading: userLoading } = useUserContext()
  const {
    notifications,
    loading: notificationsLoading,
    loadNotifications,
  } = useNotifications()
  const [shouldShowCongratulatory, setShouldShowCongratulatory] =
    useState(false)
  const [seasonalCreditsData, setSeasonalCreditsData] =
    useState<SeasonalCreditsData>({
      totalCredits: 0,
      campaignName: '',
      hasSeasonalCredits: false,
    })

  useEffect(() => {
    // Don't check while user context or notifications are still loading
    if (userLoading || notificationsLoading) {
      return
    }

    // Only check for tenant admins
    if (!user || !user.isTenantAdmin) {
      return
    }

    // Find seasonal credits notifications that haven't been shown yet
    const seasonalNotifications = notifications.filter(
      (n: Notification) => n.type === 'seasonal_credits' && !n.isDismissed
    )

    if (seasonalNotifications.length === 0) {
      return
    }

    // Check which campaigns haven't been shown yet
    const shownCampaigns = getShownCampaigns()
    // Check for notifications with campaignId (new format)
    const notificationsWithCampaignId = seasonalNotifications.filter(
      (n: Notification) => n.metadata?.campaignId
    )
    const notificationsWithoutCampaignId = seasonalNotifications.filter(
      (n: Notification) => !n.metadata?.campaignId
    )

    let unseenCampaigns = []

    // Handle new format notifications (with campaignId)
    if (notificationsWithCampaignId.length > 0) {
      unseenCampaigns = notificationsWithCampaignId.filter(
        (notification: Notification) => {
          const campaignId = notification.metadata?.campaignId
          return campaignId && !shownCampaigns.includes(campaignId)
        }
      )
    }
    // Handle legacy notifications (without campaignId) - show modal once for all of them
    else if (notificationsWithoutCampaignId.length > 0) {
      const legacyShown = shownCampaigns.includes('legacy-seasonal-credits')
      if (!legacyShown) {
        // Treat all legacy notifications as one "campaign"
        unseenCampaigns = [notificationsWithoutCampaignId[0]] // Just need one to trigger modal
      }
    }

    if (unseenCampaigns.length === 0) {
      return
    }

    // Use the most recent unseen campaign
    const latestCampaign = unseenCampaigns[0]

    // Calculate total credits from unseen campaigns
    let totalCredits = 0
    let campaignName = 'Seasonal Credits' // Default name

    let modalConfig: ModalConfig | undefined

    unseenCampaigns.forEach((notification: Notification) => {
      const amount =
        notification.metadata?.creditAmount ??
        notification.metadata?.allocatedCredits
      if (amount) {
        totalCredits += Number(amount)
      }
      // Use the first available campaign name
      if (
        notification.metadata?.campaignName &&
        campaignName === 'Seasonal Credits'
      ) {
        campaignName = notification.metadata.campaignName
      }
    })

    // Extract modalConfig from the latest campaign's metadata
    if (latestCampaign.metadata?.modalConfig) {
      modalConfig = latestCampaign.metadata.modalConfig as ModalConfig
    }

    setSeasonalCreditsData({
      totalCredits,
      campaignName,
      hasSeasonalCredits: true,
      modalConfig,
    })

    setShouldShowCongratulatory(true)
  }, [user, notifications, notificationsLoading, userLoading])

  // Periodic refresh to catch newly created seasonal credit notifications
  useEffect(() => {
    if (!user?.isTenantAdmin || userLoading || notificationsLoading) return

    // Check every 10 seconds for new seasonal credit notifications
    const interval = setInterval(async () => {
      try {
        await loadNotifications()
      } catch (error) {
        console.error('Failed to refresh notifications:', error)
      }
    }, 10000) // 10 seconds

    return () => clearInterval(interval)
  }, [
    user?.isTenantAdmin,
    userLoading,
    notificationsLoading,
    loadNotifications,
  ])

  const markCongratulatoryAsShown = () => {
    // Mark all unseen campaigns as shown
    const seasonalNotifications = notifications.filter(
      (n: Notification) => n.type === 'seasonal_credits' && !n.isDismissed
    )
    const shownCampaigns = getShownCampaigns()

    // Check if we have any notifications with campaignId
    const hasNewFormatNotifications = seasonalNotifications.some(
      (n: Notification) => n.metadata?.campaignId
    )

    if (hasNewFormatNotifications) {
      // Mark specific campaigns as shown
      seasonalNotifications.forEach((notification: Notification) => {
        const campaignId = notification.metadata?.campaignId
        if (campaignId && !shownCampaigns.includes(campaignId)) {
          addShownCampaign(campaignId)
        }
      })
    } else {
      // Mark legacy notifications as shown
      addShownCampaign('legacy-seasonal-credits')
    }

    setShouldShowCongratulatory(false)
  }

  const dismissCongratulatory = () => {
    markCongratulatoryAsShown()
  }

  const resetCongratulatory = () => {
    localStorage.removeItem('seasonal-credits-congratulatory-shown')
  }

  return {
    shouldShowCongratulatory,
    seasonalCreditsData,
    dismissCongratulatory,
    markCongratulatoryAsShown,
    resetCongratulatory,
  }
}
