/**
 * Toast Hook Component
 */

import { toast as sonnerToast, type ExternalToast } from 'sonner'

interface ToastOptions {
  type?: 'success' | 'error' | 'info' | 'warning'
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

export const useToast = () => {
  const addToast = (message: string, options?: ToastOptions) => {
    const { type = 'info', duration = 5000, action } = options || {}

    const toastOptions: ExternalToast = {
      duration,
    }

    if (action) {
      toastOptions.action = {
        label: action.label,
        onClick: action.onClick,
      }
    }

    switch (type) {
      case 'success':
        sonnerToast.success(message, toastOptions)
        break
      case 'error':
        sonnerToast.error(message, toastOptions)
        break
      case 'warning':
        sonnerToast.warning(message, toastOptions)
        break
      default:
        sonnerToast.info(message, toastOptions)
    }
  }

  return { addToast }
}
