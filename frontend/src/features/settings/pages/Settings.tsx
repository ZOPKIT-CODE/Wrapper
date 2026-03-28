import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { Monitor, Palette, Building2 } from 'lucide-react'
import { useTheme } from '@/components/theme/ThemeProvider'
import AccountSettings from './AccountSettings'

export const Settings: React.FC = () => {
  const { actualTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<string>('general')

  React.useEffect(() => {
    // Check if tour wants to open account tab
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('tab') === 'account') {
      setActiveTab('account')
    }

    const handleTourAccountTab = () => setActiveTab('account')
    window.addEventListener('tour-open-account-tab', handleTourAccountTab)
    return () => window.removeEventListener('tour-open-account-tab', handleTourAccountTab)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="max-w-6xl mx-auto p-6 space-y-8"
      data-tour-feature="settings-general"
    >
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-[#1B2E5A]">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account details, preferences, and dashboard customization
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">
            <Monitor className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="account" data-tour-feature="settings-account">
            <Building2 className="h-4 w-4 mr-2" />
            Account Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-8">
          {/* Appearance Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#1B2E5A]">
                <Palette className="h-5 w-5 text-[#1B2E5A]" />
                Appearance
              </CardTitle>
              <CardDescription>
                Customize the visual appearance of your dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Theme</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose your preferred color scheme
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {actualTheme}
                  </Badge>
                  <ThemeToggle />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account">
          <AccountSettings />
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}

export default Settings
