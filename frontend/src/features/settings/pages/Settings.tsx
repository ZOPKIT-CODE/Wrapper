import React from 'react'
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader'
import AccountSettings from './AccountSettings'

export const Settings: React.FC = () => {
  return (
    <div style={{ maxWidth: 1480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <DashboardPageHeader
        title="Settings"
        description="Manage your company profile, contacts, banking, tax, localization, and branding."
      />

      <AccountSettings />
    </div>

  )
}

export default Settings
