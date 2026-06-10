// This file contains detailed industry-specific landing page data
// Based on MARKET_SEGMENTATION_AND_FEATURE_MAPPING.md

import { LucideIcon } from 'lucide-react'
import {
  Package,
  DollarSign,
  TrendingUp,
  Users,
  Award,
  Clock,
  AlertTriangle,
  CheckCircle,
  Zap,
  BarChart3,
  FileText,
  Globe,
  Link,
} from 'lucide-react'

export interface IndustryProduct {
  id: string
  name: string
  priority: number // 1-3 stars
  description: string
}

export interface IndustryWorkflow {
  title: string
  description: string
  steps: Array<{
    title: string
    app: string
    description: string
  }>
}

export interface ROIMetric {
  label: string
  value: string
  description?: string
}

export interface IndustryData {
  id: string
  name: string
  slug: string
  hero: {
    headline: string
    subheadline: string
    valueProposition: string
    primaryCTA: string
    secondaryCTA: string
    stats: Array<{ label: string; value: string }>
  }
  painPoints: Array<{
    icon: LucideIcon
    text: string
  }>
  products: IndustryProduct[]
  workflows: IndustryWorkflow[]
  roiMetrics: ROIMetric[]
  caseStudy: {
    quote: string
    company: string
    industry: string
    results: string[]
  }
  finalCTA: {
    headline: string
    description: string
    primaryCTA: string
    secondaryCTAs: string[]
  }
}

export const industryPagesData: Record<string, IndustryData> = {
  'e-commerce': {
    id: 'e-commerce',
    name: 'E-Commerce & Retail',
    slug: 'e-commerce',
    hero: {
      headline: 'The Complete E-Commerce Operations Platform',
      subheadline:
        'Inventory to invoices to influencers—all in one unified platform',
      valueProposition:
        'Run your entire e-commerce operation from one platform. Real-time inventory across 5+ warehouses, automated fulfillment, affiliate marketing, and complete financial tracking. Reduce fulfillment time by 70% and increase margins by 15%.',
      primaryCTA: 'Start Free Trial',
      secondaryCTA: 'Watch Demo',
      stats: [
        { label: 'Faster Fulfillment', value: '70%' },
        { label: 'Stockout Reduction', value: '90%' },
        { label: 'Affiliate Revenue', value: '+45%' },
        { label: 'Cost Savings', value: '$400K/year' },
      ],
    },
    painPoints: [
      { icon: AlertTriangle, text: 'Stockouts losing sales' },
      { icon: Clock, text: 'Slow fulfillment times' },
      { icon: DollarSign, text: 'High customer acquisition costs' },
      { icon: TrendingUp, text: 'Thin profit margins' },
      { icon: FileText, text: 'Cash flow challenges' },
      { icon: Package, text: 'Returns processing complexity' },
    ],
    products: [
      {
        id: 'operations-management',
        name: 'Operations Management',
        priority: 3,
        description:
          'Real-time inventory tracking, multi-warehouse support, order management, shipping integrations, multi-vendor marketplace, barcode scanning, returns management',
      },
      {
        id: 'financial-accounting',
        name: 'Financial Accounting',
        priority: 3,
        description:
          'Multi-currency support, tax automation, e-commerce integration, cash flow management, revenue recognition',
      },
      {
        id: 'affiliate-connect',
        name: 'Affiliate Connect',
        priority: 3,
        description:
          'Affiliate program management, influencer campaigns, commission tracking, fraud detection, performance analytics',
      },
      {
        id: 'b2b-crm',
        name: 'B2B CRM',
        priority: 2,
        description: 'B2B customer management and sales pipeline tracking',
      },
      {
        id: 'project-management',
        name: 'Project Management',
        priority: 1,
        description: 'Internal operations and team coordination',
      },
    ],
    workflows: [
      {
        title: 'Order to Fulfillment',
        description: 'Automated order processing and fulfillment workflow',
        steps: [
          {
            title: 'Order Placed',
            app: 'Operations Management',
            description: 'Customer order received from multiple channels',
          },
          {
            title: 'Inventory Check',
            app: 'Operations Management',
            description: 'Real-time stock verification across warehouses',
          },
          {
            title: 'Fulfillment',
            app: 'Operations Management',
            description: 'Automated picking, packing, and shipping',
          },
          {
            title: 'Invoice Generated',
            app: 'Financial Accounting',
            description: 'Automatic invoice creation and sending',
          },
          {
            title: 'Payment Received',
            app: 'Financial Accounting',
            description: 'Payment processing and reconciliation',
          },
        ],
      },
      {
        title: 'Affiliate Campaign',
        description: 'End-to-end affiliate marketing workflow',
        steps: [
          {
            title: 'Campaign Created',
            app: 'Affiliate Connect',
            description: 'Set up affiliate program and commission structure',
          },
          {
            title: 'Affiliate Onboarding',
            app: 'Affiliate Connect',
            description: 'Affiliate registration and approval',
          },
          {
            title: 'Sales Tracking',
            app: 'Affiliate Connect',
            description: 'Real-time conversion and commission tracking',
          },
          {
            title: 'Commission Payment',
            app: 'Financial Accounting',
            description: 'Automated commission calculation and payout',
          },
        ],
      },
    ],
    roiMetrics: [
      {
        label: 'Faster Order Fulfillment',
        value: '70%',
        description: 'Reduced fulfillment time from days to hours',
      },
      {
        label: 'Stockout Reduction',
        value: '90%',
        description: 'Real-time inventory prevents lost sales',
      },
      {
        label: 'Inventory Turnover',
        value: '+30%',
        description: 'Better stock management and forecasting',
      },
      {
        label: 'Fulfillment Cost Reduction',
        value: '25%',
        description: 'Optimized warehouse operations',
      },
      {
        label: 'Affiliate Revenue Increase',
        value: '+45%',
        description: 'Better program management and tracking',
      },
    ],
    caseStudy: {
      quote:
        'We reduced operational costs by $400K/year and increased sales by 35% in the first year. The platform handles our 5 warehouses seamlessly, and our 500+ affiliates love the automated commission system.',
      company: 'Mid-size Fashion Brand',
      industry: 'E-Commerce',
      results: [
        '5 warehouses managed from one platform',
        '500+ active affiliates',
        '$20M annual revenue',
        '$400K/year cost savings',
        '35% sales increase',
      ],
    },
    finalCTA: {
      headline: 'Ready to Transform Your E-Commerce Operations?',
      description:
        'Join hundreds of e-commerce brands running their entire operation on our platform. Start your free trial today.',
      primaryCTA: 'Start Free Trial',
      secondaryCTAs: ['Schedule Demo', 'View Case Studies', 'Contact Sales'],
    },
  },
  saas: {
    id: 'saas',
    name: 'SaaS & Technology',
    slug: 'saas',
    hero: {
      headline: 'The SaaS Operations Platform',
      subheadline:
        'CRM, projects, finance, ESOP—everything you need to scale from $1M to $100M ARR',
      valueProposition:
        'Purpose-built for SaaS companies. Manage your entire sales pipeline, track MRR/ARR, coordinate development sprints, and manage equity compensation—all in one platform. Reduce sales cycle by 40% and improve team velocity by 50%.',
      primaryCTA: 'Start Free Trial',
      secondaryCTA: 'Watch Demo',
      stats: [
        { label: 'Sales Cycle Reduction', value: '40%' },
        { label: 'Win Rate Improvement', value: '30%' },
        { label: 'Development Velocity Increase', value: '50%' },
        { label: 'Churn Reduction', value: '25%' },
      ],
    },
    painPoints: [
      { icon: DollarSign, text: 'CAC payback period challenges' },
      { icon: Users, text: 'Churn management complexity' },
      { icon: Zap, text: 'Product velocity bottlenecks' },
      { icon: Award, text: 'Talent retention issues' },
      { icon: BarChart3, text: 'Cash runway visibility' },
      { icon: Globe, text: 'Remote team coordination' },
    ],
    products: [
      {
        id: 'b2b-crm',
        name: 'B2B CRM',
        priority: 3,
        description:
          'Subscription tracking, recurring revenue management, trial management, expansion tracking, churn prediction, customer health scoring',
      },
      {
        id: 'project-management',
        name: 'Project Management',
        priority: 3,
        description:
          'Agile/Scrum boards, sprint planning, development workflows, time tracking, Git integration',
      },
      {
        id: 'financial-accounting',
        name: 'Financial Accounting',
        priority: 3,
        description:
          'MRR/ARR tracking, revenue recognition, subscription billing, financial reporting',
      },
      {
        id: 'hrms',
        name: 'HRMS',
        priority: 2,
        description: 'Talent management, recruitment, performance tracking',
      },
      {
        id: 'esop-system',
        name: 'ESOP System',
        priority: 2,
        description:
          'Option grants, vesting schedules, cap table management, 409A integration, employee portal',
      },
      {
        id: 'flowtilla',
        name: 'Flowtilla',
        priority: 2,
        description: 'Workflow automation and process optimization',
      },
      {
        id: 'zopkit-academy',
        name: 'Zopkit Academy',
        priority: 1,
        description: 'Customer training and onboarding',
      },
    ],
    workflows: [
      {
        title: 'Lead to Subscription',
        description: 'Complete SaaS sales and onboarding workflow',
        steps: [
          {
            title: 'Lead Captured',
            app: 'B2B CRM',
            description: 'Trial signup or demo request',
          },
          {
            title: 'Qualification',
            app: 'B2B CRM',
            description: 'BANT qualification and scoring',
          },
          {
            title: 'Trial Management',
            app: 'B2B CRM',
            description: 'Trial tracking and engagement',
          },
          {
            title: 'Subscription Created',
            app: 'B2B CRM',
            description: 'Deal closed and subscription activated',
          },
          {
            title: 'Revenue Recognized',
            app: 'Financial Accounting',
            description: 'MRR/ARR updated automatically',
          },
        ],
      },
      {
        title: 'Sprint to Release',
        description: 'Agile development workflow',
        steps: [
          {
            title: 'Sprint Planning',
            app: 'Project Management',
            description: 'Backlog grooming and sprint setup',
          },
          {
            title: 'Development',
            app: 'Project Management',
            description: 'Task tracking and Git integration',
          },
          {
            title: 'Code Review',
            app: 'Project Management',
            description: 'PR tracking and approval workflows',
          },
          {
            title: 'Deployment',
            app: 'Project Management',
            description: 'Release management and tracking',
          },
        ],
      },
    ],
    roiMetrics: [
      {
        label: 'Sales Cycle Reduction',
        value: '40%',
        description: 'Faster deal closure with better pipeline management',
      },
      {
        label: 'Win Rate Improvement',
        value: '30%',
        description: 'Better qualification and follow-up',
      },
      {
        label: 'Development Velocity',
        value: '+50%',
        description: 'Improved sprint planning and execution',
      },
      {
        label: 'Churn Reduction',
        value: '25%',
        description: 'Proactive customer health monitoring',
      },
      {
        label: 'Financial Close Speed',
        value: '60% faster',
        description: 'Automated MRR/ARR tracking',
      },
    ],
    caseStudy: {
      quote:
        "We scaled from $5M to $25M ARR in 18 months. The CRM's subscription tracking and the project management's sprint workflows transformed how we operate. Our sales cycle dropped by 45% and development velocity increased by 60%.",
      company: 'B2B SaaS Company',
      industry: 'SaaS',
      results: [
        '$5M to $25M ARR growth',
        '45% sales cycle reduction',
        '60% development velocity increase',
        '30% churn reduction',
        '100+ employees with ESOP management',
      ],
    },
    finalCTA: {
      headline: 'Scale Your SaaS Operations Today',
      description:
        'Join hundreds of SaaS companies managing their entire operations on our platform. Built for subscription businesses.',
      primaryCTA: 'Start Free Trial',
      secondaryCTAs: ['Schedule Demo', 'View Case Studies', 'Contact Sales'],
    },
  },
  manufacturing: {
    id: 'manufacturing',
    name: 'Manufacturing',
    slug: 'manufacturing',
    hero: {
      headline: 'Modern ERP Alternative for Manufacturers',
      subheadline: '80% less cost, 90% faster implementation',
      valueProposition:
        'Replace your legacy ERP with modern, cloud-based platform. Complete operations management—from procurement to production to shipping—integrated with financial accounting and HRMS. Implement in 6-8 weeks vs 12-18 months.',
      primaryCTA: 'Start Free Trial',
      secondaryCTA: 'Watch Demo',
      stats: [
        { label: 'Production Lead Time', value: '-50%' },
        { label: 'Inventory Turnover', value: '+30%' },
        { label: 'Material Cost Reduction', value: '25%' },
        { label: 'Software Cost Savings', value: '60%' },
      ],
    },
    painPoints: [
      { icon: Clock, text: 'Production delays' },
      { icon: Package, text: 'Material shortages' },
      { icon: AlertTriangle, text: 'Quality issues' },
      { icon: DollarSign, text: 'High inventory costs' },
      { icon: Link, text: 'Supplier relationship challenges' },
      { icon: Zap, text: 'Equipment downtime' },
    ],
    products: [
      {
        id: 'operations-management',
        name: 'Operations Management',
        priority: 3,
        description:
          'Production scheduling, BOM (Bill of Materials), work orders, quality management, procurement, warehouse management, supplier management',
      },
      {
        id: 'financial-accounting',
        name: 'Financial Accounting',
        priority: 3,
        description:
          'Job costing, standard costing, variance analysis, inventory valuation, cost accounting',
      },
      {
        id: 'project-management',
        name: 'Project Management',
        priority: 2,
        description:
          'Production projects, resource allocation, timeline management, Gantt charts',
      },
      {
        id: 'hrms',
        name: 'HRMS',
        priority: 2,
        description:
          'Workforce management, shift scheduling, attendance tracking',
      },
      {
        id: 'zopkit-itsm',
        name: 'Zopkit ITSM',
        priority: 1,
        description: 'Equipment maintenance and IT service management',
      },
    ],
    workflows: [
      {
        title: 'Procure to Produce',
        description:
          'Complete manufacturing workflow from procurement to production',
        steps: [
          {
            title: 'Material Requisition',
            app: 'Operations Management',
            description: 'Production planning and material requirements',
          },
          {
            title: 'Purchase Order',
            app: 'Operations Management',
            description: 'PO generation and supplier communication',
          },
          {
            title: 'Goods Receipt',
            app: 'Operations Management',
            description: 'Material receiving and quality inspection',
          },
          {
            title: 'Production Order',
            app: 'Operations Management',
            description: 'Work order creation and scheduling',
          },
          {
            title: 'Quality Check',
            app: 'Operations Management',
            description: 'Quality control and inspection',
          },
          {
            title: 'Finished Goods',
            app: 'Operations Management',
            description: 'Inventory update and cost calculation',
          },
        ],
      },
      {
        title: 'Cost Accounting',
        description: 'Manufacturing cost tracking and analysis',
        steps: [
          {
            title: 'Job Costing',
            app: 'Financial Accounting',
            description: 'Track costs per production order',
          },
          {
            title: 'Standard Costing',
            app: 'Financial Accounting',
            description: 'Compare actual vs standard costs',
          },
          {
            title: 'Variance Analysis',
            app: 'Financial Accounting',
            description: 'Identify cost variances and trends',
          },
          {
            title: 'Inventory Valuation',
            app: 'Financial Accounting',
            description: 'Real-time inventory value tracking',
          },
        ],
      },
    ],
    roiMetrics: [
      {
        label: 'Production Lead Time',
        value: '-50%',
        description: 'Faster time from order to delivery',
      },
      {
        label: 'Inventory Turnover',
        value: '+30%',
        description: 'Better inventory management',
      },
      {
        label: 'Material Cost Reduction',
        value: '25%',
        description: 'Optimized procurement and usage',
      },
      {
        label: 'Quote-to-Order Speed',
        value: '40% faster',
        description: 'Streamlined quoting process',
      },
      {
        label: 'Software Cost Savings',
        value: '60%',
        description: 'vs traditional ERP systems',
      },
    ],
    caseStudy: {
      quote:
        'We replaced our legacy ERP system in just 8 weeks. The new platform reduced our production lead time by 55% and cut our software costs by $180K/year. Our inventory turnover improved by 35%, and we can now track every production order in real-time.',
      company: 'Mid-size Manufacturer',
      industry: 'Manufacturing',
      results: [
        '8-week implementation vs 18 months',
        '55% production lead time reduction',
        '35% inventory turnover improvement',
        '$180K/year software cost savings',
        'Real-time production tracking',
      ],
    },
    finalCTA: {
      headline: 'Ready to Modernize Your Manufacturing Operations?',
      description:
        'Replace your legacy ERP with a modern, cloud-based platform. Faster implementation, lower cost, better results.',
      primaryCTA: 'Start Free Trial',
      secondaryCTAs: ['Schedule Demo', 'View Case Studies', 'Contact Sales'],
    },
  },
  'professional-services': {
    id: 'professional-services',
    name: 'Professional Services',
    slug: 'professional-services',
    hero: {
      headline: 'The Complete PSA Platform',
      subheadline: 'Projects, clients, billing, people—unified',
      valueProposition:
        'Built for agencies, consultancies, and professional services. Track time, manage projects, bill clients, and optimize resources—all in one platform. Increase utilization by 25% and improve project margins by 30%.',
      primaryCTA: 'Start Free Trial',
      secondaryCTA: 'Watch Demo',
      stats: [
        { label: 'Utilization Increase', value: '25%' },
        { label: 'Project Margins', value: '+30%' },
        { label: 'Faster Invoicing', value: '50%' },
        { label: 'Win Rate', value: '+20%' },
      ],
    },
    painPoints: [
      { icon: BarChart3, text: 'Utilization rate tracking' },
      { icon: DollarSign, text: 'Project profitability visibility' },
      { icon: AlertTriangle, text: 'Scope creep management' },
      { icon: Users, text: 'Resource conflicts' },
      { icon: FileText, text: 'Billing accuracy issues' },
      { icon: CheckCircle, text: 'Client satisfaction tracking' },
    ],
    products: [
      {
        id: 'project-management',
        name: 'Project Management',
        priority: 3,
        description:
          'Time tracking, project budgeting, resource allocation, task management, client collaboration, project profitability',
      },
      {
        id: 'b2b-crm',
        name: 'B2B CRM',
        priority: 3,
        description:
          'Client management, opportunity tracking, proposal management, client portal',
      },
      {
        id: 'financial-accounting',
        name: 'Financial Accounting',
        priority: 3,
        description:
          'Time & materials billing, project accounting, revenue recognition, expense management',
      },
      {
        id: 'hrms',
        name: 'HRMS',
        priority: 2,
        description: 'Resource management, skills tracking, capacity planning',
      },
      {
        id: 'zopkit-academy',
        name: 'Zopkit Academy',
        priority: 2,
        description: 'Training delivery and client education',
      },
    ],
    workflows: [
      {
        title: 'Opportunity to Invoice',
        description: 'Complete client engagement workflow',
        steps: [
          {
            title: 'Opportunity Created',
            app: 'B2B CRM',
            description: 'Lead captured and qualified',
          },
          {
            title: 'Proposal Sent',
            app: 'B2B CRM',
            description: 'Proposal generation and tracking',
          },
          {
            title: 'Project Started',
            app: 'Project Management',
            description: 'Project setup and resource allocation',
          },
          {
            title: 'Time Tracking',
            app: 'Project Management',
            description: 'Team time logging and approval',
          },
          {
            title: 'Invoice Generated',
            app: 'Financial Accounting',
            description: 'Automatic invoice from time entries',
          },
          {
            title: 'Payment Received',
            app: 'Financial Accounting',
            description: 'Payment tracking and reconciliation',
          },
        ],
      },
      {
        title: 'Resource Planning',
        description: 'Optimize team utilization and project allocation',
        steps: [
          {
            title: 'Capacity Planning',
            app: 'HRMS',
            description: 'View team availability and skills',
          },
          {
            title: 'Resource Allocation',
            app: 'Project Management',
            description: 'Assign team members to projects',
          },
          {
            title: 'Utilization Tracking',
            app: 'Project Management',
            description: 'Monitor billable vs non-billable hours',
          },
          {
            title: 'Profitability Analysis',
            app: 'Project Management',
            description: 'Track project margins in real-time',
          },
        ],
      },
    ],
    roiMetrics: [
      {
        label: 'Utilization Increase',
        value: '25%',
        description: 'Better resource allocation and planning',
      },
      {
        label: 'Project Margins',
        value: '+30%',
        description: 'Improved project profitability tracking',
      },
      {
        label: 'Faster Invoicing',
        value: '50%',
        description: 'Automated time-to-invoice workflow',
      },
      {
        label: 'Win Rate',
        value: '+20%',
        description: 'Better proposal management and follow-up',
      },
      {
        label: 'Admin Time Reduction',
        value: '40%',
        description: 'Automated billing and reporting',
      },
    ],
    caseStudy: {
      quote:
        'Our utilization rate increased from 65% to 85% in the first 6 months. Project margins improved by 35%, and we cut our invoicing time in half. The platform gives us complete visibility into every project and client engagement.',
      company: 'Consulting Firm',
      industry: 'Professional Services',
      results: [
        '65% to 85% utilization increase',
        '35% project margin improvement',
        '50% faster invoicing',
        'Complete project visibility',
        '40% reduction in admin time',
      ],
    },
    finalCTA: {
      headline: 'Transform Your Professional Services Operations',
      description:
        'Join hundreds of agencies and consultancies running their entire business on our platform. Increase utilization, improve margins, and delight clients.',
      primaryCTA: 'Start Free Trial',
      secondaryCTAs: ['Schedule Demo', 'View Case Studies', 'Contact Sales'],
    },
  },
}

export const getAllIndustries = () => Object.values(industryPagesData)
export const getIndustryBySlug = (slug: string): IndustryData | undefined => {
  return Object.values(industryPagesData).find(
    (industry) => industry.slug === slug
  )
}
