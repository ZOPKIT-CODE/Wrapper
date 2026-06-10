import React from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { flowConfigs } from '../config/flowConfigs'
import { cn } from '@/lib/utils'

// User classification types based on the user journey flowchart
export type UserClassification =
  // Main business registration paths
  | 'withGST'
  | 'withoutGST'
  // Email domain paths
  | 'withDomainMail'
  | 'withoutDomainMail'
  // User role paths
  | 'employee'
  | 'founder'
  // Tier classifications
  | 'freemium'
  | 'growth'
  | 'enterprise'
  // Account type classifications
  | 'aspiringFounder'
  | 'corporateEmployee'
  | 'individual'
  | 'company'
  // Special classifications
  | 'dinVerification'
  | 'mobileOtpVerified'

interface FlowSelectorProps {
  onFlowSelect: (flowId: 'newBusiness' | 'existingBusiness') => void
  selectedFlow?: 'newBusiness' | 'existingBusiness'
  className?: string
  userClassification?: UserClassification
}

export const FlowSelector: React.FC<FlowSelectorProps> = ({
  onFlowSelect,
  selectedFlow,
  className,
  userClassification,
}) => {
  // Get personalized greeting based on user journey flowchart
  const getPersonalizedGreeting = () => {
    switch (userClassification) {
      case 'employee':
        return 'Welcome, Team Member!'
      case 'founder':
        return 'Welcome, Founder!'
      case 'withGST':
        return 'Welcome, GST Registered Business!'
      case 'withoutGST':
        return 'Welcome, New Business Owner!'
      case 'withDomainMail':
        return 'Welcome, Professional User!'
      case 'withoutDomainMail':
        return 'Welcome, Personal User!'
      case 'dinVerification':
        return 'Welcome, DIN Verified User!'
      case 'mobileOtpVerified':
        return 'Welcome, Verified User!'
      case 'freemium':
        return 'Welcome to Freemium Plan!'
      case 'growth':
        return 'Welcome to Growth Plan!'
      case 'enterprise':
        return 'Welcome to Enterprise Plan!'
      case 'aspiringFounder':
        return 'Welcome, Aspiring Founder!'
      case 'corporateEmployee':
        return 'Welcome, Corporate Employee!'
      default:
        return 'Welcome to User Onboarding'
    }
  }

  // Get personalized description based on user journey flowchart
  const getPersonalizedDescription = () => {
    switch (userClassification) {
      case 'employee':
        return 'Employee onboarding path with role-based access and permissions'
      case 'founder':
        return 'Founder journey with business registration and ownership setup'
      case 'withGST':
        return 'GST registered business path with tax compliance and invoicing'
      case 'withoutGST':
        return 'Non-GST business path with simplified registration process'
      case 'withDomainMail':
        return 'Professional domain email path with business communication setup'
      case 'withoutDomainMail':
        return 'Personal email path with quick and easy setup'
      case 'dinVerification':
        return 'DIN verified user path with enhanced business credentials'
      case 'mobileOtpVerified':
        return 'Mobile OTP verified path with secure account setup'
      case 'freemium':
        return 'Freemium tier with basic features - upgrade as you grow'
      case 'growth':
        return 'Growth tier with advanced features for scaling businesses'
      case 'enterprise':
        return 'Enterprise tier with full feature set and premium support'
      case 'aspiringFounder':
        return 'Aspiring founder path for new entrepreneurs starting their journey'
      case 'corporateEmployee':
        return 'Corporate employee path with enterprise integration and security'
      default:
        return 'Follow your personalized user journey based on your profile and requirements'
    }
  }

  return (
    <div
      className={cn(
        'flex min-h-screen items-center justify-center bg-gray-50 p-8',
        className
      )}
    >
      <div className="w-full max-w-4xl">
        <div className="mb-12 text-center">
          <div className="mb-4">
            {userClassification && userClassification !== 'aspiringFounder' && (
              <Badge
                variant="secondary"
                className={cn(
                  'mb-4 px-4 py-2 text-sm font-medium',
                  // Business registration paths
                  userClassification === 'withGST' &&
                    'bg-green-100 text-green-800',
                  userClassification === 'withoutGST' &&
                    'bg-blue-100 text-blue-800',
                  // Email domain paths
                  userClassification === 'withDomainMail' &&
                    'bg-purple-100 text-purple-800',
                  userClassification === 'withoutDomainMail' &&
                    'bg-orange-100 text-orange-800',
                  // User role paths
                  userClassification === 'employee' &&
                    'bg-indigo-100 text-indigo-800',
                  userClassification === 'founder' &&
                    'bg-pink-100 text-pink-800',
                  // Tier classifications
                  userClassification === 'freemium' &&
                    'bg-gray-100 text-gray-800',
                  userClassification === 'growth' &&
                    'bg-blue-100 text-blue-800',
                  userClassification === 'enterprise' &&
                    'bg-purple-100 text-purple-800',
                  // Account types (aspiringFounder is excluded by the guard above)
                  userClassification === 'corporateEmployee' &&
                    'bg-violet-100 text-violet-800',
                  // Special classifications
                  userClassification === 'dinVerification' &&
                    'bg-yellow-100 text-yellow-800',
                  userClassification === 'mobileOtpVerified' &&
                    'bg-teal-100 text-teal-800'
                )}
              >
                {userClassification
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, (str) => str.toUpperCase())}
              </Badge>
            )}
          </div>
          <h1 className="mb-4 text-4xl font-bold text-[#1B2E5A]">
            {getPersonalizedGreeting()}
          </h1>
          <p className="mx-auto max-w-2xl text-xl text-gray-600">
            {getPersonalizedDescription()}
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {flowConfigs.map((flow) => {
            const IconComponent = flow.icon
            const isSelected = selectedFlow === flow.id

            // Get personalized flow details based on user journey flowchart
            const getPersonalizedFlowDetails = (flowId: string) => {
              switch (userClassification) {
                case 'employee':
                  return {
                    steps: flowId === 'newBusiness' ? '3 steps' : '4 steps',
                    time: flowId === 'newBusiness' ? '5-8 min' : '8-12 min',
                    features:
                      flowId === 'newBusiness'
                        ? [
                            'Employee Profile',
                            'Role Assignment',
                            'Access Setup',
                          ]
                        : [
                            'Employee Migration',
                            'Corporate Integration',
                            'Access Setup',
                          ],
                  }
                case 'founder':
                  return {
                    steps: flowId === 'newBusiness' ? '6 steps' : '7 steps',
                    time: flowId === 'newBusiness' ? '12-18 min' : '18-25 min',
                    features:
                      flowId === 'newBusiness'
                        ? [
                            'Business Registration',
                            'Founder Setup',
                            'Ownership Rights',
                          ]
                        : [
                            'Business Transfer',
                            'DIN Verification',
                            'Control Setup',
                          ],
                  }
                case 'withGST':
                  return {
                    steps: '7 steps',
                    time: '15-20 min',
                    features: [
                      'GST Registration',
                      'Tax Compliance',
                      'Invoice Setup',
                      'Financial Accounting',
                    ],
                  }
                case 'withoutGST':
                  return {
                    steps: '4 steps',
                    time: '8-12 min',
                    features: [
                      'Basic Registration',
                      'Simple Setup',
                      'Quick Start',
                      'Operations Management',
                    ],
                  }
                case 'withDomainMail':
                  return {
                    steps: '5 steps',
                    time: '10-15 min',
                    features: [
                      'Domain Integration',
                      'Professional Email',
                      'Brand Setup',
                      'Business Communications',
                    ],
                  }
                case 'withoutDomainMail':
                  return {
                    steps: '3 steps',
                    time: '5-10 min',
                    features: ['Personal Setup', 'Basic Email', 'Quick Access'],
                  }
                case 'dinVerification':
                  return {
                    steps: '6 steps',
                    time: '15-20 min',
                    features: [
                      'DIN Verification',
                      'Business Credentials',
                      'Enhanced Access',
                      'Legal Compliance',
                    ],
                  }
                case 'mobileOtpVerified':
                  return {
                    steps: '4 steps',
                    time: '8-12 min',
                    features: [
                      'Mobile Verification',
                      'Secure Access',
                      'OTP Setup',
                      'Account Security',
                    ],
                  }
                case 'freemium':
                  return {
                    steps: '3 steps',
                    time: '5-8 min',
                    features: ['Basic Setup', 'Limited Users', 'Core Features'],
                  }
                case 'growth':
                  return {
                    steps: '6 steps',
                    time: '12-18 min',
                    features: [
                      'Advanced Features',
                      'Team Management',
                      'Growth Tools',
                      'Analytics',
                    ],
                  }
                case 'enterprise':
                  return {
                    steps: '8 steps',
                    time: '20-25 min',
                    features: [
                      'Full Feature Set',
                      'Multi-team',
                      'Enterprise Security',
                      'Premium Support',
                    ],
                  }
                case 'aspiringFounder':
                  return {
                    steps: '5 steps',
                    time: '10-15 min',
                    features: [
                      'Startup Setup',
                      'Founder Profile',
                      'Business Planning',
                      'Growth Roadmap',
                    ],
                  }
                case 'corporateEmployee':
                  return {
                    steps: '5 steps',
                    time: '10-15 min',
                    features: [
                      'Corporate Integration',
                      'Department Setup',
                      'Access Levels',
                      'Security Setup',
                    ],
                  }
                default:
                  return {
                    steps: flow.steps.length.toString(),
                    time: flow.id === 'newBusiness' ? '10-15 min' : '15-20 min',
                    features: [
                      'Standard Setup',
                      'Basic Configuration',
                      'User Management',
                    ],
                  }
              }
            }

            const flowDetails = getPersonalizedFlowDetails(flow.id)

            return (
              <Card
                key={flow.id}
                className={cn(
                  'cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg',
                  isSelected
                    ? `border-${flow.color}-500 shadow-lg ring-2 ring-${flow.color}-200`
                    : 'hover:border-gray-300'
                )}
                onClick={() => onFlowSelect(flow.id)}
              >
                <CardHeader className="pb-4 text-center">
                  <div
                    className={cn(
                      'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full',
                      flow.color === 'green' ? 'bg-green-100' : 'bg-blue-100'
                    )}
                  >
                    <IconComponent
                      className={cn(
                        'h-8 w-8',
                        flow.color === 'green'
                          ? 'text-green-600'
                          : 'text-blue-600'
                      )}
                    />
                  </div>
                  <CardTitle
                    className={cn(
                      'text-2xl font-bold',
                      isSelected
                        ? flow.color === 'green'
                          ? 'text-green-700'
                          : 'text-blue-700'
                        : 'text-[#1B2E5A]'
                    )}
                  >
                    {flow.title}
                  </CardTitle>
                  <CardDescription className="text-base leading-relaxed text-gray-600">
                    {flow.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>Steps:</span>
                      <span className="font-medium">{flowDetails.steps}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>Estimated time:</span>
                      <span className="font-medium">{flowDetails.time}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>Features:</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {flowDetails.features.map((feature, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="text-xs"
                          >
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Button
                    className={cn(
                      'mt-6 w-full',
                      flow.color === 'green'
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-primary hover:bg-primary-hover',
                      isSelected && 'ring-2 ring-white'
                    )}
                    variant={isSelected ? 'default' : 'outline'}
                  >
                    {isSelected ? 'Selected' : 'Select This Flow'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {selectedFlow && (
          <div className="mt-8 text-center">
            <Button
              onClick={() => onFlowSelect(selectedFlow)}
              className="px-8 py-3 text-lg"
              size="lg"
            >
              Continue with{' '}
              {flowConfigs.find((f) => f.id === selectedFlow)?.title}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
