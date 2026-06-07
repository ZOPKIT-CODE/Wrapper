import React from 'react'

// Public / Landing — each page gets its own chunk (no barrel imports)
export const Landing = React.lazy(() => import('@/features/landing/pages/Landing'))
export const ProductPage = React.lazy(() => import('@/features/landing/pages/ProductPage'))
export const IndustryPage = React.lazy(() => import('@/features/landing/pages/IndustryPage'))
export const PrivacyPolicy = React.lazy(() => import('@/features/landing/pages/PrivacyPolicy'))
export const TermsOfService = React.lazy(() => import('@/features/landing/pages/TermsOfService'))
export const CookiePolicy = React.lazy(() => import('@/features/landing/pages/CookiePolicy'))
export const RefundPolicy = React.lazy(() => import('@/features/landing/pages/RefundPolicy'))
export const Security = React.lazy(() => import('@/features/landing/pages/Security'))
export const Pricing = React.lazy(() => import('@/features/landing/pages/Pricing'))

// Auth
export const Login = React.lazy(() => import('@/features/auth/pages/Login').then(m => ({ default: m.Login })))
export const AuthCallback = React.lazy(() => import('@/features/auth/pages/AuthCallback').then(m => ({ default: m.AuthCallback })))
export const InviteAccept = React.lazy(() => import('@/features/auth/pages/InviteAccept').then(m => ({ default: m.InviteAccept })))

// Onboarding — import directly from the page file, not the barrel
export const OnboardingPage = React.lazy(() => import('@/features/onboarding/pages/Onboarding'))

// Billing / Payments
export const PaymentSuccess = React.lazy(() => import('@/features/billing/pages/PaymentSuccess'))
export const PaymentCancelled = React.lazy(() => import('@/features/billing/pages/PaymentCancelled'))
export const PaymentDetailsPage = React.lazy(() => import('@/features/billing/pages/PaymentDetailsPage').then(m => ({ default: m.PaymentDetailsPage })))
export const BillingUpgradePage = React.lazy(() => import('@/features/billing/pages/BillingUpgradePage').then(m => ({ default: m.BillingUpgradePage })))
export const Billing = React.lazy(() => import('@/features/billing/pages/Billing'))

// Dashboard
export const SuiteDashboard = React.lazy(() => import('@/features/dashboard/pages/SuiteDashboard'))
export const ActivityPage = React.lazy(() => import('@/features/dashboard/pages/ActivityPage').then(m => ({ default: m.ActivityPage })))


// Applications
export const ApplicationPage = React.lazy(() => import('@/features/applications/pages/ApplicationPage').then(m => ({ default: m.ApplicationPage })))
export const ApplicationDetailsPage = React.lazy(() => import('@/features/applications/pages/ApplicationDetailsPage').then(m => ({ default: m.ApplicationDetailsPage })))

// Roles
export const RolesPage = React.lazy(() => import('@/features/roles/pages/RolesPage').then(m => ({ default: m.RolesPage })))
export const RoleDetailsPage = React.lazy(() => import('@/features/roles/pages/RoleDetailsPage').then(m => ({ default: m.RoleDetailsPage })))
export const RoleBuilderPage = React.lazy(() => import('@/features/roles/pages/RoleBuilderPage').then(m => ({ default: m.RoleBuilderPage })))

// Users
export const UserManagementPage = React.lazy(() => import('@/features/users/pages/UserManagementPage'))

// Organizations — import directly from the page file, not the barrel (avoids pulling in reactflow)
export const OrganizationPage = React.lazy(() => import('@/features/organizations/pages/OrganizationPage'))
export const OrganizationCreatePage = React.lazy(() => import('@/features/organizations/pages/CreateOrganizationPage'))

// Permissions / Settings — import directly from page files
export const Permissions = React.lazy(() => import('@/features/permissions/pages/Permissions'))
export const Settings = React.lazy(() => import('@/features/settings/pages/Settings'))

// Company Admin — import directly from page files, not the barrel (avoids pulling in 30+ components)
export const AdminDashboardPage = React.lazy(() => import('@/features/admin/pages/AdminDashboardPage'))
export const TenantDetailsPage = React.lazy(() => import('@/features/admin/pages/TenantDetailsPage').then(m => ({ default: m.TenantDetailsPage })))
export const CampaignDetailsPage = React.lazy(() => import('@/features/admin/pages/CampaignDetailsPage').then(m => ({ default: m.CampaignDetailsPage })))
export const CreateCampaignPage = React.lazy(() => import('@/features/admin/pages/CreateCampaignPage'))

// Dev
export const EmailPreviewPage = React.lazy(() => import('@/features/admin/pages/EmailPreviewPage').then(m => ({ default: m.EmailPreviewPage })))
export const InviteAcceptDemo = React.lazy(() => import('@/features/auth/pages/InviteAcceptDemo'))

// Blog: public reader (marketing site) + the company-admin full-page editor.
export const PublicBlogListPage = React.lazy(() => import('@/features/blog/pages/PublicBlogListPage'))
export const PublicBlogPostPage = React.lazy(() => import('@/features/blog/pages/PublicBlogPostPage'))
export const PublicBlogTagPage = React.lazy(() => import('@/features/blog/pages/PublicBlogTagPage'))
export const PublicBlogSeriesPage = React.lazy(() => import('@/features/blog/pages/PublicBlogSeriesPage'))
export const BlogEditorPage = React.lazy(() => import('@/features/blog/pages/BlogEditorPage'))

// Misc
export const NotFound = React.lazy(() => import('@/features/NotFound'))
