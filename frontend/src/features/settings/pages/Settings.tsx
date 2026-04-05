import React from 'react'
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader'
import AccountSettings from './AccountSettings'

export const Settings: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <DashboardPageHeader
        title="Settings"
        description="Manage your company profile, contacts, banking, tax, localization, and branding."
      />

      <AccountSettings />
    </div>
  )
}

export default Settings
