/** Product SVG imagery for below-fold landing sections (unique asset per slot). */

export type SectionVisualConfig = {
  src: string
  alt: string
  objectFit?: 'cover' | 'contain'
}

export const capabilityVisuals: Record<string, SectionVisualConfig> = {
  'Shared identity': {
    src: '/illustrations/shared-identity.svg',
    alt: 'Illustration of one login and role model connected to CRM, HRMS, and finance',
    objectFit: 'contain',
  },
  'Shared records': {
    src: '/illustrations/shared-records.svg',
    alt: 'Illustration of customer, vendor, and employee records synced through a core database',
    objectFit: 'contain',
  },
  'Shared billing': {
    src: '/illustrations/shared-billing.svg',
    alt: 'Illustration of subscriptions, credits, and invoices on one billing account',
    objectFit: 'contain',
  },
}

export const industryVisuals: Record<string, SectionVisualConfig> = {
  'e-commerce': {
    src: 'https://images.unsplash.com/photo-1664455340023-214c33a9d0bd?q=80&w=1332&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    alt: 'E-commerce warehouse and retail fulfillment operations',
    objectFit: 'cover',
  },
  saas: {
    src: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    alt: 'SaaS and technology team collaborating in a modern workspace',
    objectFit: 'cover',
  },
  manufacturing: {
    src: 'https://images.unsplash.com/photo-1455165814004-1126a7199f9b?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    alt: 'Manufacturing floor and industrial production',
    objectFit: 'cover',
  },
  'professional-services': {
    src: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=1171&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    alt: 'Professional services team in a client meeting',
    objectFit: 'cover',
  },
}

export const closingCtaVisual: SectionVisualConfig = {
  src: '/fa-dashboard.svg',
  alt: 'Zopkit workspace command center',
  objectFit: 'contain',
}
