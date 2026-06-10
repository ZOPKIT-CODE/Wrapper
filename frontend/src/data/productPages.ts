// This file contains detailed product data for individual product pages
// It's separate from content.ts to keep the codebase organized

import { ProductsMap } from '../types/products';
import {
    Network, Target, Warehouse, Kanban, Receipt, UserCog, PieChart, GitBranch, BookOpen, Server,
    TrendingDown, Clock, AlertTriangle, DollarSign, Unlink, UserX, FileStack,
    Zap, Database, Key, BarChart3, RefreshCw,
    Users, Award, Shield, GraduationCap, Settings, TrendingUp, Workflow,
    Building2, Calculator, FileText, Calendar, Mail,
    Link, Activity, Truck, ShoppingCart,
    Layout, Monitor, Smartphone, Globe, Briefcase, Gift, UserPlus,
    UserCheck, CheckCircle, Home, ClipboardList, MessageCircle, Landmark,
    Sparkles, LayoutTemplate, Bot, Trophy, Book, Map,
    Package, Package2, ScanBarcode, Timer, Presentation, FileCheck, ArrowDownLeft, ArrowUpRight
} from 'lucide-react';

export const productPagesData: ProductsMap = {
    'affiliate-connect': {
        hero: {
            headline: 'Unified Affiliate & Influencer Marketing',
            subheadline: 'Manage affiliates and influencers in one place. Pricing guidance, fraud detection, and a mobile app for partners.',
            valueProposition: 'Stop managing affiliates and influencers in separate tools. Affiliate Connect brings both channels together in one unified platform.',
            primaryCTA: 'Start Free Trial',
            secondaryCTA: 'Watch Demo',
            stats: [
                { label: 'Active Affiliates', value: '10,000+' },
                { label: 'Campaigns', value: '5,000+' },
                { label: 'Fraud Reduction', value: '80%' },
                { label: 'Revenue Increase', value: '45%' },
            ],
        },
        problem: {
            headline: 'Managing Channels Separately? You\'re Missing Opportunities.',
            painPoints: [
                { icon: Unlink, text: 'Affiliates and influencers managed in separate tools' },
                { icon: BarChart3, text: 'No unified view of partner performance' },
                { icon: Clock, text: 'Manual commission calculations' },
                { icon: AlertTriangle, text: 'Fraud and fake traffic' },
                { icon: DollarSign, text: 'Complex pricing negotiations' },
                { icon: UserX, text: 'No mobile access for partners' },
            ],
        },
        solution: {
            headline: 'One Platform. Two Channels. Complete Control.',
            description: 'Affiliate Connect unifies affiliate marketing and influencer management. Manage both channels from one dashboard, track performance across both, and automate commission payments—all in one place.',
            differentiators: [
                { icon: Network, text: 'Unified Platform: Manage both affiliates & influencers' },
                { icon: Zap, text: 'Pricing Advisor: "Rate My Rate" for fair deals' },
                { icon: AlertTriangle, text: 'Advanced Fraud Detection: Stop fake traffic' },
                { icon: DollarSign, text: 'Flexible Commissions: Rules engine & tiers' },
                { icon: BarChart3, text: 'Real-Time Analytics: Unified dashboard' },
                { icon: Smartphone, text: 'Mobile App: Partners manage on-the-go' },
            ],
        },
        features: [
            { 
                icon: Network, 
                title: 'Unified Management', 
                description: 'Manage affiliates and influencers from one dashboard with complete visibility across both channels. Track performance, manage relationships, and optimize campaigns in one place.',
                benefits: [
                    'Manage both channels from a single dashboard',
                    'Get unified view of all partner performance',
                    'Reduce tool switching and save time'
                ]
            },
            { 
                icon: Zap, 
                title: 'Pricing Advisor',
                description: 'Get market-based pricing recommendations with "Rate My Rate" to negotiate fair influencer deals. Compare market rates, engagement metrics, and campaign performance to suggest optimal pricing.',
                benefits: [
                    'Negotiate fair deals with data-backed pricing insights',
                    'Save 30% on influencer costs with optimal pricing',
                    'Make data-driven pricing decisions'
                ]
            },
            { 
                icon: AlertTriangle, 
                title: 'Fraud Detection', 
                description: 'Advanced algorithms detect and prevent fake traffic, fraudulent conversions, and suspicious activity. Real-time fraud monitoring with automated blocking and reporting.',
                benefits: [
                    'Reduce fraud by 80% with advanced detection',
                    'Block fraudulent traffic in real-time',
                    'Protect your marketing budget from fraud'
                ]
            },
            { 
                icon: DollarSign, 
                title: 'Flexible Commissions', 
                description: 'Set up complex commission rules, tiers, multi-tier structures, product-specific payouts, recurring revenue tracking, and performance bonuses with our rules engine.',
                benefits: [
                    'Set up complex commission structures easily',
                    'Support multi-tier and recurring commissions',
                    'Automate commission calculations'
                ]
            },
            { 
                icon: Activity, 
                title: 'Tracking & Attribution', 
                description: 'Multi-channel tracking (web, mobile, social), cookie-based attribution, cross-device tracking, attribution window configuration, and UTM parameter management. Track every conversion accurately.',
                benefits: [
                    'Track conversions across all channels',
                    'Attribute revenue accurately with cross-device tracking',
                    'Configure attribution windows for your business'
                ]
            },
            { 
                icon: BarChart3, 
                title: 'Real-Time Analytics', 
                description: 'Track performance, ROI, and revenue across both affiliate and influencer channels in real-time. Unified dashboards, custom reports, and predictive analytics.',
                benefits: [
                    'Track performance in real-time across channels',
                    'Make data-driven decisions with unified analytics',
                    'Identify top-performing partners instantly'
                ]
            },
            { 
                icon: Users, 
                title: 'Influencer Management', 
                description: 'Media kit management, content approval workflow, influencer discovery and matching, social media analytics integration, and engagement rate tracking. Manage influencer partnerships effectively.',
                benefits: [
                    'Discover and match influencers automatically',
                    'Track engagement rates and performance',
                    'Manage content approval workflows'
                ]
            },
            { 
                icon: Database, 
                title: 'Campaign Management', 
                description: 'Create and manage campaigns, set goals, track conversions, optimize performance, A/B testing, and campaign templates. Run effective affiliate and influencer campaigns.',
                benefits: [
                    'Create and launch campaigns quickly',
                    'Track campaign performance in real-time',
                    'Optimize campaigns with A/B testing'
                ]
            },
            { 
                icon: Key, 
                title: 'Partner Portal', 
                description: 'Self-service portal for affiliates and influencers to manage their accounts, track earnings, request payouts, access marketing materials, and view performance metrics.',
                benefits: [
                    'Reduce support requests by 50% with self-service',
                    'Give partners access to real-time performance data',
                    'Enable partners to request payouts independently'
                ]
            },
        ],
        useCases: [
            {
                title: 'E-Commerce Brands',
                description: 'Manage both affiliate and influencer programs to maximize reach and conversions. Track performance across channels and optimize campaigns.',
                benefits: ['Unified partner view', 'Automated commissions', 'Fraud protection', 'Mobile access', 'Multi-channel tracking'],
            },
            {
                title: 'SaaS Companies',
                description: 'Track affiliate referrals and influencer partnerships in one platform. Manage recurring revenue commissions and attribution.',
                benefits: ['Attribution tracking', 'Automated payouts', 'Real-time metrics', 'CRM integration', 'Recurring revenue tracking'],
            },
            {
                title: 'Marketplace Platforms',
                description: 'Manage multi-tier affiliate programs and influencer partnerships. Support multiple vendors with complex commission structures.',
                benefits: ['Complex commissions', 'Multi-vendor support', 'Fraud detection', 'Scalable management', 'Multi-tier structures'],
            },
            {
                title: 'D2C Brands',
                description: 'Direct-to-consumer brands managing influencer partnerships and affiliate programs. Track performance and optimize ROI.',
                benefits: ['Influencer management', 'Content approval', 'Engagement tracking', 'Performance analytics', 'Campaign optimization'],
            },
        ],
        pricing: {
            headline: 'Simple, Transparent Pricing',
            tiers: [
                {
                    name: 'Starter',
                    price: '$99',
                    period: '/month',
                    description: 'Perfect for small programs',
                    features: [
                        'Up to 100 affiliates',
                        'Basic fraud detection',
                        'Multi-channel tracking',
                        'Partner portal',
                        'Mobile app access',
                        'Email support'
                    ],
                    cta: 'Start Free Trial',
                },
                {
                    name: 'Professional',
                    price: '$299',
                    period: '/month',
                    description: 'For growing programs',
                    features: [
                        'Unlimited affiliates',
                        'AI pricing advisor',
                        'Advanced fraud detection',
                        'Influencer management',
                        'Multi-tier commissions',
                        'Real-time analytics',
                        'Automated payments',
                        'Priority support',
                        'Custom integrations'
                    ],
                    cta: 'Start Free Trial',
                    popular: true,
                },
                {
                    name: 'Enterprise',
                    price: 'Custom',
                    period: 'Pricing',
                    description: 'For large programs',
                    features: [
                        'Dedicated account manager',
                        'Custom development',
                        'SLA guarantees',
                        'White-label options',
                        'Advanced security & compliance',
                        'Tax document generation',
                        'API access',
                        'On-premise deployment',
                        '24/7 support'
                    ],
                    cta: 'Contact Sales',
                },
            ],
        },
        socialProof: {
            testimonial: {
                quote: 'We increased affiliate revenue by 45% in the first quarter. The unified platform and pricing advisor made negotiations straightforward. Fraud detection saved us thousands, and the mobile app keeps partners engaged.',
                author: 'Sarah Johnson',
                title: 'Marketing Director',
                company: 'TechStart Inc.',
            },
            stats: [
                { label: 'Companies', value: '500+' },
                { label: 'Affiliates Managed', value: '10,000+' },
                { label: 'Revenue Processed', value: '$50M+' },
                { label: 'Revenue Increase', value: '45%' },
            ],
        },
        finalCTA: {
            headline: 'Ready to Unify Your Partner Marketing?',
            description: 'Join 500+ companies managing affiliates and influencers in one platform. Increase revenue, reduce fraud, and streamline partner management.',
            primaryCTA: 'Start Free Trial',
            secondaryCTAs: ['Schedule Demo', 'Contact Sales'],
        },
    },

    'b2b-crm': {
        hero: {
            headline: 'CRM for sales, support, and marketing in one workspace',
            subheadline: 'One customer record from first lead to closed invoice. Sales, support, and marketing work from the same data.',
            valueProposition: 'Replace separate sales, help desk, and marketing tools with one system that tracks the full customer lifecycle.',
            primaryCTA: 'Start Free Trial',
            secondaryCTA: 'Watch Demo',
            stats: [
                { label: 'Avg. CRM Spend Cut', value: '60%' },
                { label: 'Tools Replaced', value: '3-in-1' },
                { label: 'Companies Running On It', value: '1,000+' },
                { label: 'Time to First Workflow Live', value: 'Same-day' },
            ],
        },
        problem: {
            headline: 'Three Tools, Three Bills, and a Customer Who Falls Through the Cracks',
            painPoints: [
                { icon: Unlink, text: 'Sales, support, and marketing data living in disconnected tools' },
                { icon: DollarSign, text: 'Paying $150+/user/month for legacy CRMs' },
                { icon: FileStack, text: 'Quotes and invoices created outside the CRM' },
                { icon: AlertTriangle, text: 'No SLA tracking on customer support tickets' },
                { icon: TrendingDown, text: 'Marketing campaigns with no real lead attribution' },
                { icon: Clock, text: 'Rigid systems you can\'t customize or automate' },
            ],
        },
        solution: {
            headline: 'One Customer Record. Three Teams. Zero Tab-Switching.',
            description: 'When a lead converts, your sales rep, support agent, and marketer see the same record. Quotes become invoices in one click. Tickets carry the full deal history. Campaigns prove their pipeline impact. No data sync, no duplicate entry, and no finger-pointing about who owns the customer.',
            differentiators: [
                { icon: Network, text: 'Core CRM: Leads, Contacts, Accounts & Opportunities' },
                { icon: Receipt, text: 'Sales Execution: Quotes, Invoices, Orders & Approvals' },
                { icon: MessageCircle, text: 'Customer Support: SLA-tracked Tickets & Communications' },
                { icon: Mail, text: 'Marketing: Campaigns, Webforms & Email Cadences' },
                { icon: Smartphone, text: 'Productivity: Calendar, Tasks, Meetings & Documents' },
                { icon: Settings, text: 'Customizable: Custom Fields, Functions & Webhooks' },
            ],
        },
        features: [
            {
                icon: Target,
                title: 'Leads',
                description: 'Capture, score, and convert every inbound and outbound lead — with kanban and list pipeline views from first touch to conversion.',
                subFeatures: [
                    'Kanban and list pipeline views with drag-and-drop stage management',
                    'Lead scoring rules based on profile, activity, and source',
                    'Bulk CSV import with field mapping and duplicate detection',
                    'One-click conversion to Contact, Account, and Opportunity',
                    'Source tracking and lead attribution per campaign or channel',
                ]
            },
            {
                icon: Users,
                title: 'Contacts',
                description: 'Build a complete record of every person — activity history, communication log, linked accounts, and open deals in one profile.',
                subFeatures: [
                    'Full contact profiles with custom fields and tag support',
                    'Chronological activity timeline across calls, emails, meetings, and notes',
                    'Communication history with every inbound and outbound interaction',
                    'Linked accounts and associated opportunities per contact',
                    'Bulk actions for email, tagging, and status updates',
                ]
            },
            {
                icon: Building2,
                title: 'Accounts',
                description: 'Manage company-level relationships with all their contacts, deals, tickets, and revenue history in one account record.',
                subFeatures: [
                    'Company profiles with industry, size, and custom field support',
                    'All contacts, opportunities, invoices, and tickets linked per account',
                    'Account-level activity and communication timeline',
                    'Hierarchical account structures for subsidiaries and groups',
                    'Revenue roll-up and deal history across the full account lifetime',
                ]
            },
            {
                icon: TrendingUp,
                title: 'Opportunities',
                description: 'Drive every deal through a configurable stage pipeline with weighted forecasting and full deal history.',
                subFeatures: [
                    'Configurable deal stages with probability weights per stage',
                    'Weighted revenue pipeline with forecast view by user, team, or period',
                    'Deal cards with close date, value, and stage tracking',
                    'Win/loss analysis with reason tracking and reporting',
                    'Linked contacts, accounts, quotes, and invoices per opportunity',
                ]
            },
            {
                icon: FileText,
                title: 'Quotations',
                description: 'Generate professional, itemized PDF quotes directly from any deal — with line items, taxes, discounts, and approval routing.',
                subFeatures: [
                    'Quote builder with product line items, quantities, and pricing',
                    'Tax and discount application at line or header level',
                    'Branded PDF generation from configurable templates',
                    'Quote approval workflow before sending to the customer',
                    'One-click conversion from Quotation to Invoice or Sales Order',
                ]
            },
            {
                icon: Receipt,
                title: 'Invoices',
                description: 'Convert accepted quotes to invoices in one click — with payment status tracking, PDF export, and full receivables visibility.',
                subFeatures: [
                    'One-click invoice creation from accepted quotations',
                    'Line-item detail with taxes, discounts, and subtotals',
                    'Payment status tracking: draft, sent, partial, paid, overdue',
                    'Branded PDF invoice generation from configurable templates',
                    'Linked back to the originating quotation and opportunity',
                ]
            },
            {
                icon: ShoppingCart,
                title: 'Sales Orders',
                description: 'Track order fulfilment from won deal through delivery, tied directly to the account and opportunity that generated it.',
                subFeatures: [
                    'Order creation from won opportunities or standalone',
                    'Order line items linked to the product catalog',
                    'Order status tracking from confirmed through delivered',
                    'Account and opportunity linkage for full revenue traceability',
                    'Fulfilment notes and document attachments per order',
                ]
            },
            {
                icon: GitBranch,
                title: 'Approval Processes',
                description: 'Route deals, quotes, and orders through configurable multi-step approval chains before they proceed.',
                subFeatures: [
                    'Configurable approval chains with sequential or parallel routing',
                    'Approver assignment by role, user, or manager hierarchy',
                    'Approval request notifications with inline approve/reject actions',
                    'Full approval history log per record with timestamps',
                    'Fallback rules for absent approvers and escalation paths',
                ]
            },
            {
                icon: Package,
                title: 'Products & Inventory',
                description: 'Maintain a centralized product catalog with pricing, categories, and stock levels — referenced by quotes, invoices, and orders.',
                subFeatures: [
                    'Product catalog with SKU, description, category, and pricing',
                    'Multiple price lists per product for different customer tiers',
                    'Stock level tracking with low-stock alerts',
                    'Product linkage to quotes, invoices, and sales orders',
                    'CSV bulk import and bulk update support',
                ]
            },
            {
                icon: MessageCircle,
                title: 'Tickets',
                description: 'Manage customer support from the same system you sell — with priority, status, SLA targets, and full case history.',
                subFeatures: [
                    'Ticket creation from email, webform, or manual entry',
                    'Priority and status workflow: open, in-progress, resolved, closed',
                    'SLA target tracking with breach alerts',
                    'Linked to the customer contact and account record',
                    'Full thread history with internal notes and customer replies',
                ]
            },
            {
                icon: Mail,
                title: 'Communications',
                description: 'Every email, call, and meeting logged in one unified inbox — so no customer interaction ever falls through the cracks.',
                subFeatures: [
                    'Unified inbox for inbound and outbound emails per record',
                    'Call logging with duration, outcome, and notes',
                    'Meeting records with agenda, attendees, and outcome notes',
                    'Linked to the contact, account, or ticket being discussed',
                    'Full chronological communication timeline per customer',
                ]
            },
            {
                icon: Activity,
                title: 'Marketing Campaigns',
                description: 'Run campaigns, attribute leads back to the source, and measure revenue impact — without leaving the CRM.',
                subFeatures: [
                    'Campaign setup with type, budget, and date tracking',
                    'Lead attribution per campaign with source tagging',
                    'Pipeline and revenue reports filtered by campaign',
                    'Campaign-level conversion tracking from lead to close',
                    'Multi-channel support: email, event, and webform campaigns',
                ]
            },
            {
                icon: Globe,
                title: 'Webforms',
                description: 'Embed lead-capture forms on any website and have submissions flow directly into the CRM as new leads.',
                subFeatures: [
                    'Form builder with custom fields and validation rules',
                    'Embeddable on any website via script or iframe',
                    'Automatic lead creation on submission with source tagging',
                    'Field mapping to CRM lead fields',
                    'Submission notifications and configurable auto-responses',
                ]
            },
            {
                icon: Workflow,
                title: 'Email Templates & Cadences',
                description: 'Send consistent, personalized outreach at scale — with reusable templates and automated drip cadences.',
                subFeatures: [
                    'Email template builder with merge fields for personalization',
                    'Drip cadence builder with step delays and conditional branching',
                    'Shared template library across the sales team',
                    'Cadence enrollment per lead or contact segment',
                    'Open, click, and reply tracking per email sent',
                ]
            },
            {
                icon: UserPlus,
                title: 'Bulk Upload',
                description: 'Import leads, contacts, and accounts in bulk via CSV — with field mapping, validation, and duplicate detection.',
                subFeatures: [
                    'CSV upload for leads, contacts, and accounts',
                    'Column-to-field mapping interface with live preview',
                    'Duplicate detection with merge or skip options per row',
                    'Row-level validation errors displayed before commit',
                    'Import history with record count and error log',
                ]
            },
            {
                icon: Calendar,
                title: 'Calendar & Events',
                description: 'Schedule and track meetings, events, and deadlines in a CRM-native calendar linked to every relevant record.',
                subFeatures: [
                    'Day, week, and month calendar views',
                    'Event and meeting creation linked to contacts, accounts, or opportunities',
                    'Recurring event support with exception handling',
                    'Calendar visibility across team members with role permissions',
                    'Event reminders and notifications',
                ]
            },
            {
                icon: ClipboardList,
                title: 'Tasks & Activities',
                description: 'Assign, track, and close tasks across every record type — so follow-ups never slip and activity feeds stay current.',
                subFeatures: [
                    'Task creation linked to any lead, contact, account, or deal',
                    'Due date, priority, and assignee tracking per task',
                    'Activity feed showing all completed and pending actions',
                    'Bulk task assignment and status updates across records',
                    'Call, meeting, and email logging as activity entries',
                ]
            },
            {
                icon: BookOpen,
                title: 'Notes & Documents',
                description: 'Add rich-text notes and file attachments directly on any record — so context is always where the work is.',
                subFeatures: [
                    'Rich-text note editor with formatting support',
                    'Notes linked to leads, contacts, accounts, opportunities, and tickets',
                    'File attachment support per record (PDF, images, documents)',
                    'Notes and documents visible in the full activity timeline',
                    'Internal-only notes for team collaboration on a record',
                ]
            },
            {
                icon: LayoutTemplate,
                title: 'Custom Fields & Layouts',
                description: 'Extend every record type with your own fields and rearrange the UI layout — without writing any code.',
                subFeatures: [
                    'Custom field types: text, number, date, dropdown, checkbox, relation',
                    'Field groups and sections for organized record layout design',
                    'Drag-and-drop layout editor per record type',
                    'Field-level visibility and required-field rules by role',
                    'Default value configuration and field validation rules',
                ]
            },
            {
                icon: Zap,
                title: 'Custom Buttons & Functions',
                description: 'Build one-click automations on any record — from updating a field to calling an external API — with a code-based function runner.',
                subFeatures: [
                    'Custom button placement on any record detail view',
                    'Code-based function execution triggered on button click',
                    'Full access to record data within the function context',
                    'External API calls from within function code',
                    'Execution log with success/error tracking per run',
                ]
            },
            {
                icon: Link,
                title: 'Webhooks',
                description: 'Push CRM events to any external system in real time — on record create, update, or custom trigger.',
                subFeatures: [
                    'Webhook endpoints configured per CRM event type',
                    'Events supported: record created, updated, deleted, status changed',
                    'Custom payload mapping per webhook destination',
                    'Delivery log with automatic retry on failure',
                    'Authentication header support for secure webhook endpoints',
                ]
            },
        ],
        useCases: [
            {
                title: 'Sales Pipeline & Revenue',
                description: 'Run the full revenue motion in one place — capture Leads, work Opportunities through a weighted pipeline, then generate Quotations, Sales Orders, and Invoices the moment a deal is won.',
                benefits: ['Lead capture & scoring', 'Weighted pipeline & forecasting', 'PDF quotes & invoices', 'Sales order tracking', 'Multi-step deal approvals'],
            },
            {
                title: 'Customer Support & Ticketing',
                description: 'Support customers from the same system you sell to them. Track Tickets with priority, status, and SLA targets, with every email, call, and meeting unified in one Communications inbox.',
                benefits: ['SLA-tracked ticketing', 'Priority & status workflows', 'Unified Communications inbox', 'Full activity timeline', 'Documents per record'],
            },
            {
                title: 'Marketing & Lead Generation',
                description: 'Fill the top of the funnel and prove what works. Launch Marketing Campaigns with lead attribution, capture demand with embedded Webforms, and nurture with Email Templates & Cadences.',
                benefits: ['Campaigns with lead attribution', 'Embeddable webforms', 'Email cadences & drip sequences', 'CSV bulk upload', 'Lead source tracking'],
            },
            {
                title: 'Full CRM',
                description: 'Sales, support, and marketing on a single platform. Combine all 32 modules into one source of truth, then tailor it to your workflow with Custom Fields, Custom Functions, and Webhooks.',
                benefits: ['Sales + support + marketing unified', 'Custom fields & layouts', 'One-click custom automations', 'Webhooks to any system', 'Single shared customer record'],
            },
        ],
        pricing: {
            headline: 'Simple, Transparent Pricing',
            tiers: [
                {
                    name: 'Starter',
                    price: '$49',
                    period: '/user/month',
                    description: 'Perfect for small teams',
                    features: [
                        'Up to 5 users',
                        'Lead management',
                        'Pipeline management',
                        'Email integration (Gmail, Outlook)',
                        'Calendar integration',
                        'Mobile app',
                        'Basic reporting',
                        'Email support'
                    ],
                    cta: 'Start Free Trial',
                },
                {
                    name: 'Professional',
                    price: '$99',
                    period: '/user/month',
                    description: 'For growing teams',
                    features: [
                        'Unlimited users',
                        'Quotations & orders',
                        'Invoice generation',
                        'Advanced analytics',
                        'Workflow automation',
                        'Email tracking',
                        'Document management',
                        'Custom fields',
                        'Priority support'
                    ],
                    cta: 'Start Free Trial',
                    popular: true,
                },
                {
                    name: 'Enterprise',
                    price: 'Custom',
                    period: 'Pricing',
                    description: 'For large organizations',
                    features: [
                        'Custom integrations',
                        'API access',
                        'Advanced security & SSO',
                        'Dedicated support',
                        'SLA guarantees',
                        'Custom workflows',
                        'E-signature integration (DocuSign)',
                        'Marketing automation integration',
                        'Custom development',
                        '24/7 support'
                    ],
                    cta: 'Contact Sales',
                },
            ],
        },
        socialProof: {
            testimonial: {
                quote: 'We cut CRM costs by 60% while getting better functionality. Integrated invoicing saves hours every week, and email tracking helps us follow up at the right time. The mobile app works well for our field sales team.',
                author: 'Michael Chen',
                title: 'VP Sales',
                company: 'GrowthCo',
            },
            stats: [
                { label: 'Companies', value: '1,000+' },
                { label: 'Sales Reps', value: '50,000+' },
                { label: 'Deals Closed', value: '2M+' },
                { label: 'Cost Savings', value: '60%' },
            ],
        },
        finalCTA: {
            headline: 'Start Free. Replace Three Tools by Next Week.',
            description: '1,000+ companies have retired their separate sales tool, help desk, and marketing platform for one shared customer record. 14-day free trial, no credit card, same-day setup — your first lead-to-invoice flow can be live before the trial is over.',
            primaryCTA: 'Start Free Trial',
            secondaryCTAs: ['Schedule Demo', 'Contact Sales'],
        },
    },

    'operations-management': {
        hero: {
            headline: 'End-to-End Supply Chain Platform',
            subheadline: 'Inventory, warehouse, procurement, logistics—all in one. Multi-vendor marketplace. Quality management. Advanced analytics.',
            valueProposition: 'Operations Management connects inventory, procurement, and warehouse workflows in one workspace with clear status at each step.',
            primaryCTA: 'Start Free Trial',
            secondaryCTA: 'Watch Demo',
            stats: [
                { label: 'Warehouses', value: '2,000+' },
                { label: 'SKUs Managed', value: '10M+' },
                { label: 'Cost Reduction', value: '30%' },
                { label: 'Efficiency Gain', value: '50%' },
            ],
        },
        problem: {
            headline: 'Managing Supply Chain in Multiple Systems?',
            painPoints: [
                { icon: FileStack, text: 'Inventory in one system, warehouse in another' },
                { icon: Clock, text: 'Manual data entry across systems' },
                { icon: AlertTriangle, text: 'No real-time inventory visibility' },
                { icon: DollarSign, text: 'High inventory carrying costs' },
                { icon: Unlink, text: 'Poor integration between systems' },
                { icon: UserX, text: 'Complex multi-vendor management' },
            ],
        },
        solution: {
            headline: 'One Platform. Complete Supply Chain Control.',
            description: 'Unify inventory, warehouse, procurement, and logistics in one platform. Get real-time visibility, automate workflows, reduce costs, and optimize your supply chain with clear analytics.',
            differentiators: [
                { icon: Warehouse, text: 'Unified Platform: Inventory & logistics in one' },
                { icon: RefreshCw, text: 'Real-Time Sync: Instant updates across locations' },
                { icon: Database, text: 'Multi-Vendor: Manage suppliers in one place' },
                { icon: BarChart3, text: 'Advanced Analytics: Forecasting & dashboards' },
                { icon: Smartphone, text: 'Mobile App: Warehouse ops on-the-go' },
                { icon: CheckCircle, text: 'Quality Management: Track quality end-to-end' },
            ],
        },
        features: [
            { 
                icon: Warehouse, 
                title: 'Inventory Management', 
                description: 'Real-time inventory tracking across multiple warehouses with automated reorder points, batch/lot tracking, and multi-location visibility. Support for FIFO, LIFO, and FEFO strategies.',
                benefits: [
                    'Reduce stockouts by 40% with automated reorder points',
                    'Eliminate manual counting errors with real-time tracking',
                    'Optimize inventory costs with multi-location visibility'
                ]
            },
            { 
                icon: Package, 
                title: 'Catalog Management', 
                description: 'Complete product catalog with variants, bundles, dynamic pricing, and category management. Bulk import/export, attribute management, and subscription product support.',
                benefits: [
                    'Manage 10,000+ SKUs efficiently with bulk operations',
                    'Increase sales with dynamic pricing and product bundles',
                    'Save 20+ hours weekly with automated catalog updates'
                ]
            },
            { 
                icon: ClipboardList, 
                title: 'Order Management', 
                description: 'Multi-channel order processing with automated routing, split shipments, partial fulfillment, and real-time order status tracking. Support for B2B and B2C orders.',
                benefits: [
                    'Process 3x more orders with automated routing',
                    'Reduce fulfillment errors by 60% with real-time tracking',
                    'Improve customer satisfaction with order visibility'
                ]
            },
            { 
                icon: Home, 
                title: 'Warehouse Management', 
                description: 'Complete WMS with picking strategies (FIFO, LIFO, FEFO), wave planning, put-away optimization, cycle counting, and barcode scanning integration. Optimize warehouse operations with structured workflows.',
                benefits: [
                    'Increase picking efficiency by 50% with optimized strategies',
                    'Reduce warehouse errors by 70% with barcode scanning',
                    'Cut cycle counting time by 80% with automated processes'
                ]
            },
            { 
                icon: Users, 
                title: 'Multi-Vendor Marketplace', 
                description: 'Manage multiple vendors, suppliers, and partners from one platform. Vendor onboarding, performance dashboards, commission management, vendor portal, and multi-currency support.',
                benefits: [
                    'Onboard vendors 5x faster with automated workflows',
                    'Track vendor performance with real-time dashboards',
                    'Manage commissions automatically across all vendors'
                ]
            },
            { 
                icon: ShoppingCart, 
                title: 'Procurement Automation', 
                description: 'Automated purchase orders, RFQ management, vendor performance tracking, three-way matching, and automated reorder points. Streamline procurement from requisition to payment.',
                benefits: [
                    'Reduce procurement cycle time by 45%',
                    'Eliminate manual PO errors with automated workflows',
                    'Save 15+ hours weekly on vendor management tasks'
                ]
            },
            { 
                icon: Truck, 
                title: 'Logistics & Shipping', 
                description: 'Carrier integration (FedEx, UPS, DHL), shipping rate calculation, label printing, tracking number management, and delivery proof capture. Optimize logistics operations.',
                benefits: [
                    'Compare shipping rates automatically to save 25% on costs',
                    'Print labels instantly and eliminate manual entry errors',
                    'Track all shipments in real-time with carrier integration'
                ]
            },
            { 
                icon: CheckCircle, 
                title: 'Quality Management', 
                description: 'Inspection workflows, quality control checkpoints, non-conformance tracking, certificate of analysis (COA), and batch/lot tracking. Ensure quality across the supply chain.',
                benefits: [
                    'Reduce quality issues by 55% with inspection workflows',
                    'Maintain compliance with automated COA tracking',
                    'Trace quality issues instantly with batch/lot tracking'
                ]
            },
            { 
                icon: BarChart3, 
                title: 'Advanced Analytics', 
                description: 'Inventory turnover analysis, ABC/XYZ analysis, demand forecasting, cost optimization insights, and supply chain visibility dashboard. Make data-driven decisions.',
                benefits: [
                    'Identify slow-moving inventory with ABC/XYZ analysis',
                    'Reduce carrying costs by 30% with demand forecasting',
                    'Make faster decisions with real-time supply chain dashboards'
                ]
            },
            { 
                icon: Smartphone, 
                title: 'Mobile Warehouse App', 
                description: 'Barcode scanning, offline mode, real-time inventory updates, task management, and photo capture for quality checks. Full warehouse operations on mobile devices.',
                benefits: [
                    'Work from anywhere with offline mode capability',
                    'Scan barcodes instantly to update inventory in real-time',
                    'Capture quality check photos directly from mobile devices'
                ]
            },
            { 
                icon: ScanBarcode, 
                title: 'Barcode & RFID', 
                description: 'Barcode generation and scanning, RFID support, mobile scanning, label printing, and integration with barcode scanners (Zebra, Honeywell).',
                benefits: [
                    'Eliminate manual data entry errors with barcode scanning',
                    'Track inventory 10x faster with RFID technology',
                    'Connect to existing scanner hardware'
                ]
            },
            { 
                icon: Zap, 
                title: 'Workflow Automation', 
                description: 'Automate workflows, reorder points, and supply chain processes. Integration with Flowtilla for cross-system automation and rule-based decision-making.',
                benefits: [
                    'Automate 80% of repetitive supply chain tasks',
                    'Reduce manual errors with automated workflows',
                    'Connect with other systems via Flowtilla integration'
                ]
            },
            { 
                icon: Package2, 
                title: 'Batch & Lot Tracking', 
                description: 'Complete batch and lot tracking for compliance, expiry date management, serial number tracking, and traceability across the supply chain. Essential for food, pharma, and regulated industries.',
                benefits: [
                    'Ensure regulatory compliance with complete traceability',
                    'Prevent expired product sales with automated expiry alerts',
                    'Recall products instantly with batch/lot tracking'
                ]
            },
        ],
        useCases: [
            {
                title: 'E-Commerce',
                description: 'Manage inventory, fulfillment, and logistics for your e-commerce operations with real-time sync across channels.',
                benefits: ['Real-time visibility', 'Automated fulfillment', 'Multi-warehouse', 'Order tracking', 'Carrier integration'],
            },
            {
                title: 'Manufacturing',
                description: 'Manage raw materials, production inventory, and finished goods with complete traceability and quality control.',
                benefits: ['Raw material tracking', 'Production planning', 'Quality management', 'Supply chain optimization', 'Batch tracking'],
            },
            {
                title: 'Distribution',
                description: 'Manage multi-vendor operations, logistics, and distribution networks with optimized routing and delivery tracking.',
                benefits: ['Multi-vendor support', 'Logistics optimization', 'Route planning', 'Delivery tracking', 'Vendor performance'],
            },
            {
                title: 'Retail Chains',
                description: 'Multi-location inventory management with centralized control, store-level visibility, and automated replenishment.',
                benefits: ['Multi-location sync', 'Store-level visibility', 'Automated transfers', 'Centralized control', 'Real-time updates'],
            },
            {
                title: 'Food & Beverage',
                description: 'Expiry date tracking, FIFO management, batch/lot tracking, and compliance for food safety regulations.',
                benefits: ['Expiry tracking', 'FIFO management', 'Batch tracking', 'Compliance', 'Quality control'],
            },
        ],
        pricing: {
            headline: 'Simple, Transparent Pricing',
            tiers: [
                {
                    name: 'Starter',
                    price: '$199',
                    period: '/month',
                    description: 'Perfect for small operations',
                    features: [
                        'Up to 1 warehouse', 
                        'Up to 1,000 SKUs', 
                        'Basic inventory management', 
                        'Order management',
                        'Mobile app access',
                        'Email support'
                    ],
                    cta: 'Start Free Trial',
                },
                {
                    name: 'Professional',
                    price: '$499',
                    period: '/month',
                    description: 'For growing operations',
                    features: [
                        'Unlimited warehouses', 
                        'Unlimited SKUs', 
                        'Multi-vendor marketplace', 
                        'Advanced analytics & forecasting',
                        'Quality management',
                        'Carrier integrations',
                        'Barcode scanning',
                        'Priority support'
                    ],
                    cta: 'Start Free Trial',
                    popular: true,
                },
                {
                    name: 'Enterprise',
                    price: 'Custom',
                    period: 'Pricing',
                    description: 'For large operations',
                    features: [
                        'Dedicated account manager', 
                        'Custom development', 
                        'SLA guarantees', 
                        'Advanced security & compliance',
                        'ERP integrations (SAP, Oracle)',
                        'White-label options',
                        'On-premise deployment',
                        '24/7 dedicated support'
                    ],
                    cta: 'Contact Sales',
                },
            ],
        },
        socialProof: {
            testimonial: {
                quote: 'We reduced our inventory costs by 30% and improved fulfillment speed by 50% after implementing Operations Management. The multi-vendor marketplace and advanced analytics have transformed our supply chain operations.',
                author: 'David Kim',
                title: 'Operations Director',
                company: 'GlobalTrade',
            },
            stats: [
                { label: 'Companies', value: '800+' },
                { label: 'Warehouses', value: '2,000+' },
                { label: 'SKUs Managed', value: '10M+' },
                { label: 'Orders Processed', value: '50M+' },
            ],
        },
        finalCTA: {
            headline: 'Ready to Optimize Your Supply Chain?',
            description: 'Join 800+ companies using Operations Management to streamline their supply chain, reduce costs, and improve efficiency.',
            primaryCTA: 'Start Free Trial',
            secondaryCTAs: ['Schedule Demo', 'Contact Sales'],
        },
    },

    // Continue with remaining products in next update due to size
    'project-management': {
        hero: {
            headline: 'Enterprise Project Management',
            subheadline: 'Agile, Scrum, Gantt charts, Kanban, and time tracking. Integrated with HR and Accounting. Templates and analytics included.',
            valueProposition: 'Manage projects from planning to delivery with integrated resource management, project costing, and comprehensive analytics. Support for all methodologies.',
            primaryCTA: 'Start Free Trial',
            secondaryCTA: 'Watch Demo',
            stats: [
                { label: 'Projects Managed', value: '50,000+' },
                { label: 'Tasks Completed', value: '1M+' },
                { label: 'Faster Delivery', value: '40%' },
                { label: 'Cost Savings', value: '25%' },
            ],
        },
        problem: {
            headline: 'Managing Projects Across Multiple Tools?',
            painPoints: [
                { icon: FileStack, text: 'Projects managed in spreadsheets' },
                { icon: Unlink, text: 'Tasks scattered across tools' },
                { icon: UserX, text: 'No resource visibility' },
                { icon: Clock, text: 'Time tracking is manual' },
                { icon: DollarSign, text: 'Budget tracking disconnected' },
                { icon: AlertTriangle, text: 'Poor team collaboration' },
            ],
        },
        solution: {
            headline: 'Complete Project Management Platform',
            description: 'Support Agile, Scrum, Waterfall, and Kanban methodologies. Gantt charts, Kanban boards, time tracking, resource management, and comprehensive analytics—all integrated with HR and Accounting.',
            differentiators: [
                { icon: Kanban, text: 'Multiple Methodologies: Agile, Scrum, Waterfall, Kanban' },
                { icon: BarChart3, text: 'Visual Planning: Gantt charts and Kanban' },
                { icon: UserCog, text: 'Resource Management: Integrated with HRMS' },
                { icon: Clock, text: 'Time Tracking: Billable and non-billable' },
                { icon: Receipt, text: 'Project Costing: Integrated with Accounting' },
                { icon: Zap, text: 'Team Collaboration: Built-in communication' },
            ],
        },
        features: [
            { 
                icon: Map, 
                title: 'Project Planning', 
                description: 'Create projects with work breakdown structures, task dependencies, resource allocation, and timeline planning. Visual project roadmaps and milestone tracking.',
                benefits: [
                    'Plan projects 3x faster with visual WBS',
                    'Identify critical path automatically',
                    'Allocate resources efficiently with capacity planning'
                ]
            },
            { 
                icon: Zap, 
                title: 'Agile & Scrum', 
                description: 'Full support for Agile and Scrum methodologies. Sprint planning, backlog grooming, velocity tracking, burndown charts, retrospective management, and story point estimation.',
                benefits: [
                    'Increase sprint velocity by 35% with better planning',
                    'Track team performance with burndown charts',
                    'Improve retrospectives with automated insights'
                ]
            },
            { 
                icon: ClipboardList, 
                title: 'Task Management', 
                description: 'Create, assign, and track tasks with priorities, due dates, dependencies, and subtasks. Task templates, recurring tasks, and automated task assignment.',
                benefits: [
                    'Reduce task management overhead by 50%',
                    'Never miss deadlines with automated reminders',
                    'Track task dependencies automatically'
                ]
            },
            { 
                icon: Timer, 
                title: 'Time Tracking', 
                description: 'Track time with timers, manual entry, and timesheets. Billable vs. non-billable tracking, project time allocation, overtime tracking, and timesheet approval workflows.',
                benefits: [
                    'Accurate billing with automated time tracking',
                    'Reduce time entry errors by 70%',
                    'Track billable hours automatically'
                ]
            },
            { 
                icon: UserCog, 
                title: 'Resource Management', 
                description: 'Resource allocation calendar, capacity planning, skill-based assignment, resource utilization reports, and conflict resolution. Integrated with HRMS for accurate availability.',
                benefits: [
                    'Optimize resource utilization by 40%',
                    'Prevent resource conflicts with capacity planning',
                    'Match skills to projects automatically'
                ]
            },
            { 
                icon: BarChart3, 
                title: 'Gantt Charts', 
                description: 'Visual timeline planning with interactive Gantt charts. Task dependencies, critical path analysis, milestone tracking, and drag-and-drop scheduling.',
                benefits: [
                    'Visualize project timelines instantly',
                    'Identify bottlenecks with critical path analysis',
                    'Adjust schedules with drag-and-drop ease'
                ]
            },
            { 
                icon: Kanban, 
                title: 'Kanban Boards', 
                description: 'Visual workflow management with drag-and-drop Kanban boards. Custom columns, WIP limits, swimlanes, and board templates for different workflows.',
                benefits: [
                    'Improve workflow visibility with visual boards',
                    'Reduce WIP and increase throughput',
                    'Customize boards for any workflow'
                ]
            },
            { 
                icon: Receipt, 
                title: 'Project Costing', 
                description: 'Track project costs, budgets, and profitability in real-time. Budget vs. actual reports, cost forecasting, and integration with Accounting for financial tracking.',
                benefits: [
                    'Track project profitability in real-time',
                    'Prevent budget overruns with alerts',
                    'Connect to Accounting system'
                ]
            },
            { 
                icon: Presentation, 
                title: 'Reporting & Analytics', 
                description: 'Project health dashboard, budget vs. actual reports, resource utilization reports, project portfolio view, and custom report builder. Make data-driven decisions.',
                benefits: [
                    'Identify at-risk projects early',
                    'Make faster decisions with real-time dashboards',
                    'Create custom reports for stakeholders'
                ]
            },
            { 
                icon: LayoutTemplate, 
                title: 'Project Templates', 
                description: 'Pre-built project templates for common methodologies and industries. Custom template builder, methodology support (Agile, Scrum, Waterfall, Kanban), and industry-specific templates.',
                benefits: [
                    'Start projects 5x faster with templates',
                    'Maintain consistency across projects',
                    'Create reusable project structures'
                ]
            },
            { 
                icon: Link, 
                title: 'Enterprise Integrations', 
                description: 'HRMS integration for resource allocation, Accounting integration for project costing, CRM integration for client projects, communication tools (Slack, Teams), and code repositories (GitHub, GitLab).',
                benefits: [
                    'Sync data across all business systems',
                    'Eliminate manual data entry',
                    'Connect with 50+ popular tools'
                ]
            },
            { 
                icon: Smartphone, 
                title: 'Mobile App', 
                description: 'Time tracking on mobile, task management, team communication, document access, and offline capabilities. Manage projects from anywhere.',
                benefits: [
                    'Track time on-the-go with mobile app',
                    'Update tasks from anywhere',
                    'Stay connected with team notifications'
                ]
            },
        ],
        useCases: [
            {
                title: 'SaaS Companies',
                description: 'Manage product development projects with Agile methodologies. Track sprints, velocity, and releases.',
                benefits: ['Agile delivery', 'Sprint planning', 'Release management', 'Velocity tracking', 'Backlog grooming'],
            },
            {
                title: 'Agencies',
                description: 'Manage client projects with time tracking, resource allocation, and project costing. Bill accurately and track profitability.',
                benefits: ['Client Management', 'Time & billing', 'Resource allocation', 'Profitability tracking', 'Timesheet approval'],
            },
            {
                title: 'Manufacturing',
                description: 'Manage production projects, quality initiatives, and process improvements with resource planning and cost tracking.',
                benefits: ['Production planning', 'Quality projects', 'Process improvement', 'Resource optimization', 'Cost control'],
            },
            {
                title: 'Construction',
                description: 'Manage construction projects with milestones, resource allocation, budget tracking, and timeline management.',
                benefits: ['Milestone tracking', 'Resource planning', 'Budget management', 'Timeline control', 'Progress reporting'],
            },
            {
                title: 'Event Management',
                description: 'Plan and execute events with task management, vendor coordination, timeline tracking, and team collaboration.',
                benefits: ['Event planning', 'Vendor coordination', 'Timeline management', 'Team collaboration', 'Budget tracking'],
            },
        ],
        pricing: {
            headline: 'Simple, Transparent Pricing',
            tiers: [
                {
                    name: 'Starter',
                    price: '$49',
                    period: '/month',
                    description: 'Perfect for small teams',
                    features: [
                        'Up to 10 users', 
                        '10 projects', 
                        'Kanban boards', 
                        'Time tracking',
                        'Task management',
                        'Team collaboration',
                        'Email support'
                    ],
                    cta: 'Start Free Trial',
                },
                {
                    name: 'Professional',
                    price: '$149',
                    period: '/month',
                    description: 'For growing teams',
                    features: [
                        'Up to 50 users', 
                        'Unlimited projects', 
                        'Gantt charts', 
                        'Agile & Scrum',
                        'Resource management',
                        'Project templates',
                        'Advanced analytics',
                        'HRMS & Accounting integration',
                        'Priority support'
                    ],
                    cta: 'Start Free Trial',
                    popular: true,
                },
                {
                    name: 'Enterprise',
                    price: 'Custom',
                    period: 'Pricing',
                    description: 'For large organizations',
                    features: [
                        'Unlimited users', 
                        'Custom integrations', 
                        'Dedicated support', 
                        'Advanced security',
                        'SLA guarantees',
                        'Custom templates',
                        'API access',
                        'On-premise deployment',
                        '24/7 support'
                    ],
                    cta: 'Contact Sales',
                },
            ],
        },
        socialProof: {
            testimonial: {
                quote: 'Project Management helped us deliver projects 40% faster and reduce costs by 25%. The integration with HR and Accounting is straightforward, and the Agile tools are excellent.',
                author: 'Sarah Martinez',
                title: 'Project Manager',
                company: 'TechServices',
            },
            stats: [
                { label: 'Projects Managed', value: '50,000+' },
                { label: 'Tasks Completed', value: '1M+' },
                { label: 'Faster Delivery', value: '40%' },
                { label: 'Teams Using', value: '10,000+' },
            ],
        },
        finalCTA: {
            headline: 'Ready to Transform Your Project Management?',
            description: 'Join 10,000+ teams using Project Management to deliver projects faster and more efficiently.',
            primaryCTA: 'Start Free Trial',
            secondaryCTAs: ['Schedule Demo', 'View Pricing'],
        },
    },

    // Placeholder for remaining products - will add in next file update
    'financial-accounting': {
        hero: {
            headline: 'The Complete Accounting Suite',
            subheadline: 'General ledger, AP/AR, banking, fixed assets, cost accounting, GST & TDS, and consolidated reporting — 11 modules, one ledger.',
            valueProposition: 'From journal entry to period-locked close, every transaction is field-audited, every entity consolidated server-side, and every GST/TDS obligation tracked automatically.',
            primaryCTA: 'Start Free Trial',
            secondaryCTA: 'Watch Demo',
            stats: [
                { label: 'Accounting Modules', value: '11' },
                { label: 'Audit Trail', value: 'Field-level' },
                { label: 'Consolidation', value: 'Server-side' },
                { label: 'Close Control', value: 'Period-locked' },
            ],
        },
        problem: {
            headline: 'Struggling with Manual Accounting?',
            painPoints: [
                { icon: FileStack, text: 'Manual journal entries and bookkeeping' },
                { icon: Clock, text: 'Time-consuming bank reconciliations' },
                { icon: AlertTriangle, text: 'GST/TDS errors that surface only at filing time' },
                { icon: DollarSign, text: 'No single cash position across bank accounts' },
                { icon: Unlink, text: 'Separate books per entity with no consolidation' },
                { icon: TrendingDown, text: 'Delayed financial reporting at period end' },
            ],
        },
        solution: {
            headline: 'One Ledger. Every Module. Always Audit-Ready.',
            description: 'Zopkit Financial Accounting covers the full transactional cycle — from chart of accounts to consolidated statements — with built-in GST/TDS compliance, period-locked close, and field-level audit trail across every entity.',
            differentiators: [
                { icon: Calculator, text: 'Complete Accounting: GL, AP, AR, banking, assets & costs' },
                { icon: RefreshCw, text: 'Bank Reconciliation: Rule-based matching, statement import' },
                { icon: BarChart3, text: 'Financial Reports: P&L, balance sheet, cash flow, custom' },
                { icon: Shield, text: 'India Tax: GST (CGST/SGST/IGST), TDS, e-invoice (IRN)' },
                { icon: Database, text: 'Multi-Entity: Server-side consolidation, IC elimination' },
                { icon: PieChart, text: 'Cost Accounting: Cost centres, allocation rules, dept P&L' },
            ],
        },
        features: [
            {
                icon: Calculator,
                title: 'General Ledger',
                description: 'The double-entry core — chart of accounts, journal workflows, period-locked close, and a real-time trial balance that never goes stale.',
                subFeatures: [
                    'Custom chart of accounts with multi-level hierarchy',
                    'Journal entry creation with multi-level approval workflows',
                    'Period-lock controls with admin-only override',
                    'Real-time trial balance and account-level drill-down',
                    'Multi-currency posting with manual or imported exchange rates',
                ]
            },
            {
                icon: Building2,
                title: 'Multi-Entity Management',
                description: 'Maintain fully independent books per entity while consolidating at the group level — server-side, with inter-company eliminations.',
                subFeatures: [
                    'Independent chart of accounts per entity, shared master optional',
                    'Server-side consolidation across any entity combination',
                    'Inter-company transaction posting and automatic elimination',
                    'Role-based access scoped per entity',
                    'Consolidated P&L and balance sheet at group level',
                ]
            },
            {
                icon: DollarSign,
                title: 'Multi-Currency',
                description: 'Record transactions in any currency, apply entity-level exchange rates, and run revaluation entries at period end.',
                subFeatures: [
                    'Transaction-level currency assignment',
                    'Manual or CSV-imported exchange rates per period',
                    'Realized and unrealized FX gain/loss calculation',
                    'Multi-currency bank account register',
                    'Currency revaluation journal at period close',
                ]
            },
            {
                icon: ArrowDownLeft,
                title: 'Accounts Payable',
                description: 'Vendor bills flow from entry through approval, three-way matching, and TDS deduction — before a single payment goes out.',
                subFeatures: [
                    'Vendor master with payment terms and TDS applicability',
                    'Bill entry with line-level GL coding and cost centre tagging',
                    'Configurable multi-level approval workflows',
                    'Three-way PO–receipt–invoice matching',
                    'TDS deduction at source with challan tracking',
                ]
            },
            {
                icon: ArrowUpRight,
                title: 'Accounts Receivable',
                description: 'GST-compliant customer invoices, aging buckets, automated reminders, and advance receipt application — all in one place.',
                subFeatures: [
                    'Customer invoicing with CGST/SGST/IGST line items',
                    'Aging report with configurable buckets (0-30, 31-60, 61-90, 90+)',
                    'Automated payment reminder scheduling',
                    'Receipt application against open invoices and advance management',
                    'Customer-level credit limit enforcement',
                ]
            },
            {
                icon: Landmark,
                title: 'Banking & Cash',
                description: 'Import bank statements, match transactions with rule-based logic, and see a consolidated cash position across every account.',
                subFeatures: [
                    'Multi-bank account register with running balance',
                    'Bank statement import via CSV or OFX',
                    'Rule-based transaction matching engine',
                    'Unreconciled items report with aging',
                    'Cash position summary across all accounts',
                ]
            },
            {
                icon: Database,
                title: 'Fixed Assets',
                description: 'Track every asset through its full lifecycle — from capitalisation and depreciation to disposal — with schedule forecasting built in.',
                subFeatures: [
                    'Asset register with category, location, and cost centre',
                    'Straight-line and declining-balance depreciation methods',
                    'Asset addition, disposal, and inter-entity transfer',
                    'Depreciation schedule with future-period forecast',
                    'Asset revaluation journal entries',
                ]
            },
            {
                icon: PieChart,
                title: 'Cost Accounting',
                description: 'Tag every transaction to a cost centre, define allocation rules, and read department-wise P&L without any spreadsheet work.',
                subFeatures: [
                    'Cost centre hierarchy definition',
                    'Transaction-level cost centre tagging on every voucher',
                    'Allocation rules for shared cost distribution',
                    'Department-wise and project-wise P&L',
                    'Budget vs. actuals by cost centre',
                ]
            },
            {
                icon: BarChart3,
                title: 'Financial Reporting',
                description: 'Statutory statements — P&L, balance sheet, cash flow — plus a custom report builder that filters by entity, period, or dimension.',
                subFeatures: [
                    'Profit & Loss by entity, period, or comparative view',
                    'Balance sheet as at any historical point in time',
                    'Cash flow statement (direct and indirect method)',
                    'Custom report builder with dimension and date filters',
                    'Scheduled report delivery via email',
                ]
            },
            {
                icon: FileText,
                title: 'Tax Management',
                description: 'GST and TDS are embedded in every transaction — calculation, e-invoice generation, and return-preparation data are produced automatically.',
                subFeatures: [
                    'CGST / SGST / IGST calculation on each transaction line',
                    'TDS deduction, challan tracking, and Form 26Q data export',
                    'GSTR-1 and GSTR-3B preparation data',
                    'E-invoice generation with IRN and QR code',
                    'Tax liability ledger and payment tracking',
                ]
            },
            {
                icon: Shield,
                title: 'Compliance & Audit',
                description: 'An immutable, field-level audit trail captures every change — who, what, when — so you are always audit-ready without extra effort.',
                subFeatures: [
                    'Field-level audit trail with user ID and timestamp on every change',
                    'Immutable transaction log — no silent edits or deletions',
                    'Document attachment on every voucher for supporting evidence',
                    'Period-lock controls prevent post-close modifications',
                    'Compliance report export ready for external auditors',
                ]
            },
        ],
        useCases: [
            {
                title: 'Small Businesses',
                description: 'Simple accounting for small businesses with automated workflows and tax compliance.',
                benefits: ['Easy bookkeeping', 'Automated reconciliation', 'Financial reports', 'Tax compliance', 'Mobile access'],
            },
            {
                title: 'Growing Companies',
                description: 'Scalable accounting for companies with complex financial needs and multi-currency operations.',
                benefits: ['Multi-entity support', 'Advanced reporting', 'Workflow automation', 'Integration ready', 'Cost accounting'],
            },
            {
                title: 'Enterprises',
                description: 'Enterprise-grade accounting with advanced features, controls, and multi-entity consolidation.',
                benefits: ['Multi-currency', 'Consolidation', 'Advanced security', 'Custom workflows', 'Audit compliance'],
            },
            {
                title: 'Multi-Location Businesses',
                description: 'Consolidated accounting across multiple locations with centralized control and local compliance.',
                benefits: ['Multi-location consolidation', 'Local compliance', 'Centralized control', 'Real-time reporting', 'Inter-location transactions'],
            },
            {
                title: 'Holding Companies',
                description: 'Multi-entity consolidation and reporting for holding companies with inter-company transaction management.',
                benefits: ['Group consolidation', 'Inter-company transactions', 'Entity-level permissions', 'Unified reporting', 'Compliance management'],
            },
        ],
        pricing: {
            headline: 'Simple, Transparent Pricing',
            tiers: [
                { 
                    name: 'Starter', 
                    price: '$99', 
                    period: '/month', 
                    description: 'Perfect for small businesses', 
                    features: [
                        'Up to 1,000 transactions/month', 
                        'General ledger', 
                        'AP/AR', 
                        'Bank reconciliation',
                        'Basic tax management',
                        'Email support'
                    ], 
                    cta: 'Start Free Trial' 
                },
                { 
                    name: 'Professional', 
                    price: '$299', 
                    period: '/month', 
                    description: 'For growing companies', 
                    features: [
                        'Unlimited transactions', 
                        'Multi-currency', 
                        'Advanced reporting', 
                        'Workflow automation',
                        'Tax compliance (GST/VAT)',
                        'Cost accounting',
                        'Banking integrations',
                        'Priority support'
                    ], 
                    cta: 'Start Free Trial', 
                    popular: true 
                },
                { 
                    name: 'Enterprise', 
                    price: 'Custom', 
                    period: 'Pricing', 
                    description: 'For large organizations', 
                    features: [
                        'Multi-entity consolidation', 
                        'Custom workflows', 
                        'Dedicated support', 
                        'Advanced security & compliance',
                        'SLA guarantees',
                        'E-invoicing networks',
                        'API access',
                        'On-premise deployment',
                        '24/7 support'
                    ], 
                    cta: 'Contact Sales' 
                },
            ],
        },
        socialProof: {
            testimonial: { 
                quote: 'We automated our accounting and reduced month-end close time by 50%. The real-time reporting, multi-entity consolidation, and tax compliance features are invaluable.', 
                author: 'Robert Chen', 
                title: 'CFO', 
                company: 'FinTech Solutions' 
            },
            stats: [
                { label: 'Companies', value: '5,000+' }, 
                { label: 'Transactions/Month', value: '1M+' }, 
                { label: 'Time Saved', value: '50%' },
                { label: 'Accuracy Rate', value: '99.9%' }
            ],
        },
        finalCTA: { 
            headline: 'Ready to Modernize Your Accounting?', 
            description: 'Join 5,000+ companies using our accounting platform to automate financial operations and ensure compliance.', 
            primaryCTA: 'Start Free Trial', 
            secondaryCTAs: ['Schedule Demo', 'Contact Sales'] 
        },
    },
    'hrms': {
        hero: {
            headline: 'Complete HR Management System',
            subheadline: 'Recruitment, onboarding, payroll, attendance, performance management, learning & development, and compliance. End-to-end HRMS solution.',
            valueProposition: 'Manage your entire workforce from hire to retire with our comprehensive HRMS platform. Automate payroll, track performance, ensure compliance, and give employees self-service access.',
            primaryCTA: 'Start Free Trial',
            secondaryCTA: 'Watch Demo',
            stats: [
                { label: 'Employees Managed', value: '100,000+' },
                { label: 'Companies', value: '2,000+' },
                { label: 'Time Saved', value: '60%' },
                { label: 'Accuracy', value: '99.9%' },
            ],
        },
        problem: {
            headline: 'Struggling with Manual HR Processes?',
            painPoints: [
                { icon: FileStack, text: 'Manual employee records and paperwork' },
                { icon: Clock, text: 'Time-consuming payroll calculations' },
                { icon: AlertTriangle, text: 'Attendance tracking errors' },
                { icon: UserX, text: 'Poor employee engagement' },
                { icon: DollarSign, text: 'Compliance and regulatory risks' },
                { icon: Unlink, text: 'Disconnected HR systems' },
            ],
        },
        solution: {
            headline: 'Automate Your Entire HR Workflow',
            description: 'Our HRMS handles everything from recruitment to retirement. Automate payroll, track attendance, manage performance reviews, deliver training, and ensure compliance—all in one integrated platform with mobile access.',
            differentiators: [
                { icon: UserCog, text: 'Complete Lifecycle: Hire to retire management' },
                { icon: DollarSign, text: 'Automated Payroll: Accurate calculations every time' },
                { icon: Clock, text: 'Time & Attendance: Biometric integration' },
                { icon: BarChart3, text: 'Performance Management: Reviews & goals' },
                { icon: Shield, text: 'Compliance: Stay regulatory compliant' },
                { icon: Smartphone, text: 'Employee Self-Service: Mobile app access' },
            ],
        },
        features: [
            { 
                icon: Briefcase, 
                title: 'Recruitment & ATS', 
                description: 'Applicant tracking system (ATS), job posting management, interview scheduling, candidate scoring, offer letter generation, and background check integration. Streamline hiring from job post to offer.',
                benefits: [
                    'Reduce time-to-hire by 40% with automated workflows',
                    'Track candidates through entire recruitment pipeline',
                    'Generate offer letters automatically'
                ]
            },
            { 
                icon: FileCheck, 
                title: 'Onboarding Automation', 
                description: 'Digital onboarding workflows, document collection, asset provisioning, training assignment, buddy assignment, and compliance checklists. Get new hires productive faster.',
                benefits: [
                    'Onboard new employees 5x faster with digital workflows',
                    'Automate document collection and verification',
                    'Assign assets and training automatically'
                ]
            },
            { 
                icon: UserCog, 
                title: 'Employee Management', 
                description: 'Complete employee database with documents, contracts, organizational hierarchy, employee profiles, and document management. Centralized employee information hub.',
                benefits: [
                    'Maintain complete employee records in one place',
                    'Track organizational structure and reporting lines',
                    'Manage employee documents securely'
                ]
            },
            { 
                icon: DollarSign, 
                title: 'Payroll Processing', 
                description: 'Automated salary calculations, tax deductions (country-specific), benefits administration, payslip generation, direct deposit management, and statutory compliance. Ensure accurate payroll every time.',
                benefits: [
                    'Process payroll 10x faster with automation',
                    'Ensure 100% accuracy in tax calculations',
                    'Generate payslips and reports automatically'
                ]
            },
            { 
                icon: Clock, 
                title: 'Time & Attendance', 
                description: 'Biometric integration, shift management, overtime tracking, leave management, attendance reports, and real-time attendance monitoring. Track time accurately.',
                benefits: [
                    'Eliminate time theft with biometric integration',
                    'Automate overtime calculations',
                    'Track attendance across multiple locations'
                ]
            },
            { 
                icon: Award, 
                title: 'Performance Management', 
                description: 'Goal setting and tracking, 360-degree feedback, performance review cycles, competency assessments, performance improvement plans, and career development. Drive employee growth.',
                benefits: [
                    'Conduct performance reviews 50% faster',
                    'Track goals and competencies in real-time',
                    'Enable continuous feedback with 360 reviews'
                ]
            },
            { 
                icon: GraduationCap, 
                title: 'Learning & Development', 
                description: 'Training program management, skill tracking, certification management, career development plans, and integration with Zopkit Academy. Build a learning culture.',
                benefits: [
                    'Track employee skills and certifications',
                    'Assign training programs automatically',
                    'Plan career development paths'
                ]
            },
            { 
                icon: Calendar, 
                title: 'Leave Management', 
                description: 'Leave requests, approvals, accruals, comprehensive leave balance tracking, leave policies, and holiday calendar management. Simplify leave administration.',
                benefits: [
                    'Process leave requests 3x faster',
                    'Track leave balances automatically',
                    'Ensure policy compliance with automated rules'
                ]
            },
            { 
                icon: Receipt, 
                title: 'Expense Management', 
                description: 'Employee expense claims, approvals, reimbursements, policy compliance, expense reports, and integration with accounting. Streamline expense processing.',
                benefits: [
                    'Reduce expense processing time by 60%',
                    'Ensure policy compliance automatically',
                    'Integrate expenses with accounting system'
                ]
            },
            { 
                icon: Shield, 
                title: 'Compliance & Reporting', 
                description: 'Statutory report generation, regulatory compliance tracking, audit trail, data privacy compliance (GDPR), labor law compliance, and comprehensive HR analytics. Stay compliant always.',
                benefits: [
                    'Generate statutory reports automatically',
                    'Maintain complete audit trail',
                    'Ensure GDPR and labor law compliance'
                ]
            },
            { 
                icon: Smartphone, 
                title: 'Employee Self-Service Portal', 
                description: 'Mobile app for leave requests, payslip access, document management, profile updates, benefits enrollment, expense claims, and performance reviews. Self-service for employees.',
                benefits: [
                    'Reduce HR inquiries by 50% with self-service',
                    'Enable employees to access information 24/7',
                    'Process requests faster with mobile access'
                ]
            },
        ],
        useCases: [
            {
                title: 'Growing Companies',
                description: 'Scale your HR operations as you grow from 10 to 1000+ employees with automated workflows and scalable processes.',
                benefits: ['Automated onboarding', 'Scalable payroll', 'Performance tracking', 'Employee engagement', 'Compliance management'],
            },
            {
                title: 'Multi-Location Businesses',
                description: 'Manage employees across multiple locations with centralized HR control and location-specific policies.',
                benefits: ['Centralized database', 'Location-based policies', 'Attendance tracking', 'Unified reporting', 'Multi-location payroll'],
            },
            {
                title: 'Remote Teams',
                description: 'Manage distributed teams with cloud-based HR, self-service portals, and virtual onboarding.',
                benefits: ['Cloud access', 'Mobile app', 'Virtual onboarding', 'Remote attendance', 'Digital document management'],
            },
            {
                title: 'Healthcare',
                description: 'Shift management and compliance for healthcare workers with complex scheduling and regulatory requirements.',
                benefits: ['Shift scheduling', 'Compliance tracking', 'Certification management', 'Overtime management', 'Regulatory reporting'],
            },
            {
                title: 'Retail',
                description: 'Multi-location workforce management for retail chains with scheduling, attendance, and payroll across stores.',
                benefits: ['Multi-store management', 'Shift scheduling', 'Time tracking', 'Payroll consolidation', 'Performance management'],
            },
        ],
        pricing: {
            headline: 'Simple, Transparent Pricing',
            tiers: [
                {
                    name: 'Starter',
                    price: '$3',
                    period: '/employee/month',
                    description: 'Perfect for small teams',
                    features: [
                        'Up to 50 employees', 
                        'Core HR management', 
                        'Attendance tracking', 
                        'Leave management',
                        'Employee self-service portal',
                        'Email support'
                    ],
                    cta: 'Start Free Trial',
                },
                {
                    name: 'Professional',
                    price: '$5',
                    period: '/employee/month',
                    description: 'For growing companies',
                    features: [
                        'Up to 500 employees', 
                        'Payroll processing', 
                        'Performance management', 
                        'Learning & development',
                        'Recruitment & ATS',
                        'Onboarding automation',
                        'Compliance reporting',
                        'Priority support'
                    ],
                    cta: 'Start Free Trial',
                    popular: true,
                },
                {
                    name: 'Enterprise',
                    price: 'Custom',
                    period: 'Pricing',
                    description: 'For large organizations',
                    features: [
                        'Unlimited employees', 
                        'Custom workflows', 
                        'Dedicated support', 
                        'Advanced analytics',
                        'Multi-entity support',
                        'API access',
                        'Integration with ATS (Greenhouse, Lever)',
                        'Background check integration',
                        'SLA guarantees',
                        'On-premise deployment'
                    ],
                    cta: 'Contact Sales',
                },
            ],
        },
        socialProof: {
            testimonial: {
                quote: 'We automated our entire HR process and reduced administrative time by 60%. The payroll accuracy is perfect every time, and the employee self-service portal has significantly reduced HR inquiries.',
                author: 'Jennifer Williams',
                title: 'HR Director',
                company: 'TechCorp',
            },
            stats: [
                { label: 'Companies', value: '2,000+' },
                { label: 'Employees Managed', value: '100,000+' },
                { label: 'Time Saved', value: '60%' },
                { label: 'Payroll Accuracy', value: '99.9%' },
            ],
        },
        finalCTA: {
            headline: 'Ready to Transform Your HR Operations?',
            description: 'Join 2,000+ companies using our HRMS to manage their workforce efficiently and ensure compliance.',
            primaryCTA: 'Start Free Trial',
            secondaryCTAs: ['Schedule Demo', 'Contact Sales'],
        },
    },
    'esop-system': {
        hero: {
            headline: 'Complete Equity Compensation Management Platform',
            subheadline: 'Grant management, vesting schedules, cap table management, exercise workflows, tax compliance, and employee portal. End-to-end ESOP solution.',
            valueProposition: 'Manage your entire equity compensation program from grants to exercises. Automate vesting, track cap tables, ensure compliance, and give employees self-service access.',
            primaryCTA: 'Start Free Trial',
            secondaryCTA: 'Watch Demo',
            stats: [
                { label: 'Grants Managed', value: '50,000+' },
                { label: 'Companies', value: '500+' },
                { label: 'Time Saved', value: '70%' },
                { label: 'Compliance Rate', value: '100%' },
            ],
        },
        problem: {
            headline: 'Struggling with Manual Equity Management?',
            painPoints: [
                { icon: FileStack, text: 'Manual cap table management in Excel' },
                { icon: Clock, text: 'Time-consuming vesting calculations' },
                { icon: AlertTriangle, text: 'Compliance risks and audit failures' },
                { icon: DollarSign, text: 'Complex tax calculations and reporting' },
                { icon: Unlink, text: 'Disconnected equity systems' },
                { icon: TrendingDown, text: 'Poor employee visibility into equity' },
            ],
        },
        solution: {
            headline: 'Automate Your Equity Compensation Program',
            description: 'Our ESOP platform handles everything from grant issuance to exercise processing. Automate vesting schedules, maintain real-time cap tables, ensure tax compliance, and provide employees with complete visibility into their equity.',
            differentiators: [
                { icon: Gift, text: 'Complete Lifecycle: Grant to exercise management' },
                { icon: PieChart, text: 'Real-Time Cap Table: Always up-to-date ownership' },
                { icon: TrendingUp, text: 'Automated Vesting: Real-time vesting calculations' },
                { icon: RefreshCw, text: 'Exercise Workflows: Streamlined exercise processing' },
                { icon: BarChart3, text: 'Analytics: Grant and vesting analytics' },
                { icon: Smartphone, text: 'Employee Portal: Self-service equity access' },
            ],
        },
        features: [
            { 
                icon: Settings, 
                title: 'Scheme Management', 
                description: 'Multiple ESOP scheme support, scheme configuration, vesting schedule setup, exercise window management, and scheme templates. Configure and manage multiple equity plans.',
                benefits: [
                    'Support multiple equity schemes simultaneously',
                    'Configure vesting schedules with flexible rules',
                    'Manage exercise windows automatically'
                ]
            },
            { 
                icon: Gift, 
                title: 'Grant Management', 
                description: 'Grant issuance workflow, grant approval process, grant documentation, grant tracking, and bulk grant operations. Streamline grant administration.',
                benefits: [
                    'Issue grants 5x faster with automated workflows',
                    'Track all grants in one centralized system',
                    'Generate grant documents automatically'
                ]
            },
            { 
                icon: TrendingUp, 
                title: 'Vesting Management', 
                description: 'Automated vesting calculations, vesting schedule tracking, cliff period management, accelerated vesting rules, and vesting projections. Track vesting accurately.',
                benefits: [
                    'Calculate vesting automatically in real-time',
                    'Track vesting schedules across all employees',
                    'Handle accelerated vesting rules without manual work'
                ]
            },
            { 
                icon: RefreshCw, 
                title: 'Exercise Management', 
                description: 'Exercise request workflow, payment processing, tax withholding, share issuance, and exercise documentation. Process exercises efficiently.',
                benefits: [
                    'Process exercises 3x faster with automated workflows',
                    'Automate tax withholding calculations',
                    'Generate exercise documents automatically'
                ]
            },
            { 
                icon: PieChart, 
                title: 'Cap Table Management', 
                description: 'Real-time ownership structure, dilution analysis, share class management, investor tracking, and cap table visualization. Maintain accurate cap tables.',
                benefits: [
                    'Maintain real-time cap table accuracy',
                    'Analyze dilution impact instantly',
                    'Track all share classes and investors'
                ]
            },
            { 
                icon: Smartphone, 
                title: 'Employee Portal', 
                description: 'Grant visibility, vesting status, exercise calculator, tax impact calculator, equity statements, and exercise requests. Self-service portal for employees.',
                benefits: [
                    'Provide employees 24/7 access to equity information',
                    'Enable employees to calculate exercise impact',
                    'Reduce HR inquiries by 60% with self-service'
                ]
            },
            { 
                icon: BarChart3, 
                title: 'Analytics & Reporting', 
                description: 'Grant analytics, vesting projections, cap table reports, valuation reports, equity expense tracking, and custom report builder. Make data-driven decisions.',
                benefits: [
                    'Track equity metrics and trends',
                    'Project vesting schedules and costs',
                    'Generate custom reports for stakeholders'
                ]
            },
        ],
        useCases: [
            {
                title: 'Startups',
                description: 'Early-stage equity management for startups with simple grant workflows and cap table tracking.',
                benefits: ['Easy grant management', 'Simple cap table', 'Employee portal', 'Basic compliance', 'Cost-effective'],
            },
            {
                title: 'Growth Companies',
                description: 'Scaling equity programs for growing companies with multiple schemes and complex vesting schedules.',
                benefits: ['Multiple schemes', 'Complex vesting', 'Advanced reporting', 'Tax compliance', 'Investor tracking'],
            },
            {
                title: 'Pre-IPO Companies',
                description: 'Audit-ready cap tables and compliance for companies preparing for IPO or acquisition.',
                benefits: ['Audit-ready cap tables', 'SEC compliance', '409A valuations', 'Due diligence support', 'Advanced reporting'],
            },
            {
                title: 'Public Companies',
                description: 'Post-IPO equity management with regulatory compliance and employee stock plan administration.',
                benefits: ['Regulatory compliance', 'Public company reporting', 'Employee stock plans', 'Tax compliance', 'Advanced analytics'],
            },
        ],
        pricing: {
            headline: 'Simple, Transparent Pricing',
            tiers: [
                {
                    name: 'Starter',
                    price: '$199',
                    period: '/month',
                    description: 'Perfect for startups',
                    features: [
                        'Up to 50 employees',
                        'Grant management',
                        'Basic vesting tracking',
                        'Cap table management',
                        'Employee portal',
                        'Email support'
                    ],
                    cta: 'Start Free Trial',
                },
                {
                    name: 'Professional',
                    price: '$499',
                    period: '/month',
                    description: 'For growing companies',
                    features: [
                        'Up to 200 employees',
                        'Multiple schemes',
                        'Advanced vesting rules',
                        'Exercise management',
                        'Tax calculations',
                        'Valuation tracking',
                        'Compliance reporting',
                        'Priority support'
                    ],
                    cta: 'Start Free Trial',
                    popular: true,
                },
                {
                    name: 'Enterprise',
                    price: 'Custom',
                    period: 'Pricing',
                    description: 'For large organizations',
                    features: [
                        'Unlimited employees',
                        'Custom workflows',
                        '409A valuation support',
                        'Advanced analytics',
                        'API access',
                        'Integration with payroll (ADP, Paychex)',
                        'Integration with accounting systems',
                        'Integration with DocuSign',
                        'Dedicated support',
                        'SLA guarantees',
                        'On-premise deployment'
                    ],
                    cta: 'Contact Sales',
                },
            ],
        },
        socialProof: {
            testimonial: {
                quote: 'We moved from Excel to ESOP System and reduced cap table management time by 70%. The automated vesting calculations and compliance features are invaluable, especially as we prepare for our Series B.',
                author: 'Michael Chen',
                title: 'CFO',
                company: 'TechStartup Inc.',
            },
            stats: [
                { label: 'Companies', value: '500+' },
                { label: 'Grants Managed', value: '50,000+' },
                { label: 'Time Saved', value: '70%' },
                { label: 'Compliance Rate', value: '100%' },
            ],
        },
        finalCTA: {
            headline: 'Ready to Modernize Your Equity Management?',
            description: 'Join 500+ companies using our ESOP platform to manage equity compensation efficiently and ensure compliance.',
            primaryCTA: 'Start Free Trial',
            secondaryCTAs: ['Schedule Demo', 'Contact Sales'],
        },
    },
    'flowtilla': {
        hero: {
            headline: 'Visual Workflow Automation Platform',
            subheadline: 'No-code workflow builder, rule-based automation, 100+ app integrations, and pre-built templates. Automate business processes visually.',
            valueProposition: 'Connect all your apps and automate complex business processes with our visual workflow builder. No coding required—build powerful automations with drag-and-drop simplicity.',
            primaryCTA: 'Start Free Trial',
            secondaryCTA: 'Watch Demo',
            stats: [
                { label: 'Workflows Created', value: '100,000+' },
                { label: 'Apps Connected', value: '100+' },
                { label: 'Time Saved', value: '80%' },
                { label: 'Companies', value: '10,000+' },
            ],
        },
        problem: {
            headline: 'Struggling with Manual, Repetitive Tasks?',
            painPoints: [
                { icon: Clock, text: 'Time-consuming repetitive work' },
                { icon: FileStack, text: 'Manual data entry across systems' },
                { icon: Unlink, text: 'Disconnected apps and tools' },
                { icon: AlertTriangle, text: 'Human errors in manual processes' },
                { icon: DollarSign, text: 'High operational costs' },
                { icon: TrendingDown, text: 'Slow process execution' },
            ],
        },
        solution: {
            headline: 'Automate Everything with Visual Workflows',
            description: 'Flowtilla connects all your apps and automates complex business processes visually. Build powerful workflows with drag-and-drop simplicity, integrate AI capabilities, and connect 100+ apps—all without writing code.',
            differentiators: [
                { icon: Workflow, text: 'Visual Builder: Drag-and-drop workflow design' },
                { icon: Bot, text: 'Workflow automation: connect CRM actions to other Zopkit apps' },
                { icon: Link, text: '100+ Integrations: Connect your apps in one place' },
                { icon: LayoutTemplate, text: 'Template Library: Pre-built workflow templates' },
                { icon: Zap, text: 'Real-Time: Instant workflow execution' },
                { icon: Activity, text: 'Monitoring: Complete workflow visibility' },
            ],
        },
        features: [
            { 
                icon: Workflow, 
                title: 'Visual Builder', 
                description: 'Drag-and-drop interface, node-based workflow design, pre-built templates, custom node creation, and visual debugging. Build workflows without coding.',
                benefits: [
                    'Create workflows 10x faster with visual builder',
                    'No coding skills required—anyone can build',
                    'Debug workflows visually with step-by-step execution'
                ]
            },
            { 
                icon: Zap, 
                title: 'Triggers & Actions', 
                description: 'Event-based triggers, schedule-based triggers, webhook triggers, manual triggers, app integrations (all 10 Wrapper apps), data transformations, and database operations. Connect any system.',
                benefits: [
                    'Trigger workflows from any event or schedule',
                    'Connect with 100+ apps and services',
                    'Transform data automatically between systems'
                ]
            },
            { 
                icon: GitBranch, 
                title: 'Logic & Control', 
                description: 'Conditional logic (if/then/else), loops and iterations, error handling, retry mechanisms, and branching workflows. Build complex automation logic.',
                benefits: [
                    'Handle complex business logic with conditionals',
                    'Automatically retry failed steps',
                    'Create dynamic workflows with loops'
                ]
            },
            { 
                icon: Bot, 
                title: 'AI Components',
                description: 'Optional LLM integration (OpenAI, Anthropic) for data extraction, text generation, and workflow suggestions when you need them.',
                benefits: [
                    'Extract data from unstructured content',
                    'Generate text and content on demand',
                    'Get workflow optimization suggestions'
                ]
            },
            { 
                icon: UserCheck, 
                title: 'User Tasks & Approvals', 
                description: 'Human approval steps, form collection, task assignment, notification management, and approval workflows. Include people in automated processes.',
                benefits: [
                    'Add human approvals to automated workflows',
                    'Collect data through forms in workflows',
                    'Assign tasks and send notifications automatically'
                ]
            },
            { 
                icon: LayoutTemplate, 
                title: 'Template Library', 
                description: 'Pre-built workflow templates, industry-specific templates, custom template creation, template marketplace, and one-click deployment. Start with proven workflows.',
                benefits: [
                    'Deploy workflows instantly from templates',
                    'Access industry-specific workflow templates',
                    'Share and reuse custom templates'
                ]
            },
            { 
                icon: Activity, 
                title: 'Monitoring & Logging', 
                description: 'Workflow execution logs, performance metrics, error tracking, debugging tools, and real-time monitoring. Track and optimize workflow performance.',
                benefits: [
                    'Monitor all workflow executions in real-time',
                    'Track performance metrics and identify bottlenecks',
                    'Debug issues quickly with detailed logs'
                ]
            },
            { 
                icon: Link, 
                title: 'Integration Hub', 
                description: '100+ app integrations, custom API connectors, webhook management, data mapping tools, and integration with all 10 Wrapper applications. Connect everything.',
                benefits: [
                    'Connect with 100+ popular apps and services',
                    'Build custom API connectors easily',
                    'Map data between systems automatically'
                ]
            },
            { 
                icon: Sparkles, 
                title: 'Workflow Assistant',
                description: 'Workflow suggestions, optimization recommendations, error resolution help, and natural language workflow creation when you want guided setup.',
                benefits: [
                    'Get suggestions for workflow improvements',
                    'Create workflows using natural language',
                    'Resolve common workflow errors faster'
                ]
            },
            { 
                icon: BarChart3, 
                title: 'Analytics & Insights', 
                description: 'Workflow performance analytics, usage statistics, cost analysis, ROI tracking, and workflow optimization insights. Make data-driven automation decisions.',
                benefits: [
                    'Track workflow performance and ROI',
                    'Identify optimization opportunities',
                    'Analyze automation costs and savings'
                ]
            },
        ],
        useCases: [
            {
                title: 'Lead-to-Cash',
                description: 'Complete sales automation from lead capture to invoice generation. Automate lead routing, qualification, quote generation, order processing, and invoicing.',
                benefits: ['Automate lead routing', 'Generate quotes automatically', 'Process orders end-to-end', 'Create invoices automatically', 'Track sales pipeline'],
            },
            {
                title: 'Employee Onboarding',
                description: 'Automate employee onboarding workflows. Create accounts, assign equipment, schedule training, collect documents, and notify stakeholders.',
                benefits: ['Automate account creation', 'Assign assets automatically', 'Schedule training sessions', 'Collect documents', 'Notify all stakeholders'],
            },
            {
                title: 'Order Processing',
                description: 'E-commerce order fulfillment automation. Process orders, update inventory, generate shipping labels, send notifications, and update CRM.',
                benefits: ['Process orders automatically', 'Update inventory in real-time', 'Generate shipping labels', 'Send customer notifications', 'Update CRM records'],
            },
            {
                title: 'Invoice Processing',
                description: 'Accounts payable automation. Extract invoice data, validate invoices, route for approval, process payments, and update accounting systems.',
                benefits: ['Extract invoice data with AI', 'Validate invoices automatically', 'Route for approval', 'Process payments', 'Update accounting systems'],
            },
            {
                title: 'Support Ticket Automation',
                description: 'IT support ticket automation. Create tickets, assign to teams, escalate based on rules, update status, and notify customers automatically.',
                benefits: ['Auto-create tickets', 'Smart ticket routing', 'Automatic escalation', 'Status updates', 'Customer notifications'],
            },
        ],
        pricing: {
            headline: 'Simple, Transparent Pricing',
            tiers: [
                {
                    name: 'Starter',
                    price: '$29',
                    period: '/month',
                    description: 'Perfect for individuals',
                    features: [
                        '100 workflow runs/month',
                        'Visual builder',
                        '10 app integrations',
                        'Basic templates',
                        'Email support'
                    ],
                    cta: 'Start Free Trial',
                },
                {
                    name: 'Professional',
                    price: '$99',
                    period: '/month',
                    description: 'For growing teams',
                    features: [
                        '1,000 workflow runs/month',
                        'All integrations',
                        'AI components',
                        'User tasks & approvals',
                        'Advanced templates',
                        'Monitoring & logging',
                        'Priority support'
                    ],
                    cta: 'Start Free Trial',
                    popular: true,
                },
                {
                    name: 'Enterprise',
                    price: 'Custom',
                    period: 'Pricing',
                    description: 'For large organizations',
                    features: [
                        'Unlimited workflow runs',
                        'Custom API connectors',
                        'AI Co-pilot',
                        'Advanced analytics',
                        'Dedicated support',
                        'SLA guarantees',
                        'On-premise deployment',
                        'Custom integrations',
                        '24/7 support'
                    ],
                    cta: 'Contact Sales',
                },
            ],
        },
        socialProof: {
            testimonial: {
                quote: 'Flowtilla transformed our operations. We automated 50+ manual processes and saved 20 hours per week. The visual builder makes it so easy—our team built complex workflows without any coding knowledge.',
                author: 'Jane Smith',
                title: 'Operations Manager',
                company: 'TechCo',
            },
            stats: [
                { label: 'Companies', value: '10,000+' },
                { label: 'Workflows Created', value: '100,000+' },
                { label: 'Time Saved', value: '80%' },
                { label: 'Apps Connected', value: '100+' },
            ],
        },
        finalCTA: {
            headline: 'Ready to Automate Your Business Processes?',
            description: 'Join 10,000+ companies using Flowtilla to automate workflows and connect all their apps.',
            primaryCTA: 'Start Free Trial',
            secondaryCTAs: ['Schedule Demo', 'Contact Sales'],
        },
    },
    'zopkit-academy': {
        hero: {
            headline: 'Enterprise Learning Management System',
            subheadline: 'Course creation, assessments, gamification, learning assistant, certificates, and analytics. Complete LMS for corporate training and education.',
            valueProposition: 'Deliver engaging learning experiences with our comprehensive LMS. Create courses, track progress, gamify learning, and certify learners—all in one platform.',
            primaryCTA: 'Start Free Trial',
            secondaryCTA: 'Watch Demo',
            stats: [
                { label: 'Learners', value: '500,000+' },
                { label: 'Courses', value: '10,000+' },
                { label: 'Completion Rate', value: '85%' },
                { label: 'Companies', value: '3,000+' },
            ],
        },
        problem: {
            headline: 'Struggling with Scattered Training Materials?',
            painPoints: [
                { icon: FileStack, text: 'Training materials scattered across platforms' },
                { icon: Clock, text: 'Time-consuming course creation and management' },
                { icon: AlertTriangle, text: 'Poor learner engagement and completion rates' },
                { icon: Unlink, text: 'Disconnected training and HR systems' },
                { icon: DollarSign, text: 'High costs for training platforms' },
                { icon: TrendingDown, text: 'Difficulty tracking learning progress' },
            ],
        },
        solution: {
            headline: 'Transform Training with Complete LMS Platform',
            description: 'Zopkit Academy provides everything you need to deliver effective training. Create engaging courses, assess learners, gamify learning, offer optional tutor assistance, and track progress—all integrated with your HRMS.',
            differentiators: [
                { icon: Book, text: 'Course Builder: Create engaging courses easily' },
                { icon: Award, text: 'Gamification: Badges, leaderboards, and rewards' },
                { icon: Bot, text: 'Learning Assistant: Optional personalized help' },
                { icon: Trophy, text: 'Certificates: Digital certificates with verification' },
                { icon: BarChart3, text: 'Analytics: Track learning progress and effectiveness' },
                { icon: Link, text: 'Integration: Connect with HRMS and other systems' },
            ],
        },
        features: [
            { 
                icon: Book, 
                title: 'Course Management', 
                description: 'Course creation tools, content organization, module structure, course templates, and content library. Build comprehensive learning experiences.',
                benefits: [
                    'Create courses 5x faster with templates',
                    'Organize content with flexible module structure',
                    'Reuse course templates across programs'
                ]
            },
            { 
                icon: Monitor, 
                title: 'Content Types', 
                description: 'Video lessons, interactive content, documents and PDFs, SCORM/xAPI support, live sessions, and multimedia content. Deliver engaging learning experiences.',
                benefits: [
                    'Support all major content formats',
                    'Deliver interactive and engaging content',
                    'Host live training sessions in-app'
                ]
            },
            { 
                icon: FileCheck, 
                title: 'Assessment Engine', 
                description: 'Quiz builder, exam creation, assignment management, grading automation, question banks, and auto-grading. Assess learner knowledge effectively.',
                benefits: [
                    'Create assessments 3x faster with builder',
                    'Automate grading and save time',
                    'Build question banks for reuse'
                ]
            },
            { 
                icon: Trophy, 
                title: 'Gamification', 
                description: 'Badge system, leaderboards, points and rewards, challenges, progress tracking, and achievement system. Increase learner engagement.',
                benefits: [
                    'Increase completion rates by 40% with gamification',
                    'Motivate learners with badges and rewards',
                    'Track progress with visual leaderboards'
                ]
            },
            { 
                icon: Map, 
                title: 'Learning Paths', 
                description: 'Guided learning journeys, prerequisites management, sequential learning, role-based paths, and curriculum design. Create structured learning experiences.',
                benefits: [
                    'Design structured learning journeys',
                    'Enforce prerequisites automatically',
                    'Create role-specific learning paths'
                ]
            },
            { 
                icon: Bot, 
                title: 'Learning Assistant',
                description: 'Optional personalized assistance, question answering, learning recommendations, progress analysis, and adaptive learning paths.',
                benefits: [
                    'Provide 24/7 personalized learning assistance',
                    'Recommend courses based on progress',
                    'Answer learner questions instantly'
                ]
            },
            { 
                icon: Award, 
                title: 'Certificates', 
                description: 'Digital certificate generation, QR code verification, custom templates, expiry management, and certificate tracking. Recognize learner achievements.',
                benefits: [
                    'Generate certificates automatically on completion',
                    'Verify certificates with QR codes',
                    'Track certificate expiry and renewals'
                ]
            },
            { 
                icon: BarChart3, 
                title: 'Analytics & Reporting', 
                description: 'Learner progress tracking, course effectiveness metrics, completion rates, engagement analytics, and custom reports. Make data-driven training decisions.',
                benefits: [
                    'Track learner progress in real-time',
                    'Measure course effectiveness with metrics',
                    'Generate custom reports for stakeholders'
                ]
            },
            { 
                icon: Users, 
                title: 'Instructor Tools', 
                description: 'Student management, grading interface, communication tools, performance monitoring, and class management. Tools built for instructors.',
                benefits: [
                    'Manage all students from one dashboard',
                    'Grade assignments efficiently',
                    'Communicate with learners in one place'
                ]
            },
            { 
                icon: Link, 
                title: 'Integrations', 
                description: 'HRMS integration (training records), video platform integration (YouTube, Vimeo), video conferencing (Zoom, Teams), single sign-on (SSO), and API access. Connect with all your tools.',
                benefits: [
                    'Sync training records with HRMS automatically',
                    'Integrate with video platforms and conferencing',
                    'Enable SSO for single sign-on access'
                ]
            },
        ],
        useCases: [
            {
                title: 'Corporate Training',
                description: 'Employee skill development and onboarding programs. Deliver training at scale with tracking and certification.',
                benefits: ['Employee onboarding', 'Skill development', 'Progress tracking', 'Certification', 'HRMS integration'],
            },
            {
                title: 'Compliance Training',
                description: 'Mandatory compliance courses for regulatory requirements. Track completion and ensure compliance.',
                benefits: ['Compliance tracking', 'Mandatory courses', 'Completion certificates', 'Audit trails', 'Reporting'],
            },
            {
                title: 'Customer Education',
                description: 'Product training for customers. Educate customers on products and features to improve adoption.',
                benefits: ['Product training', 'Customer onboarding', 'Feature education', 'Self-service learning', 'Engagement tracking'],
            },
            {
                title: 'Partner Training',
                description: 'Channel partner enablement and certification programs. Train partners on products and processes.',
                benefits: ['Partner certification', 'Product training', 'Sales enablement', 'Progress tracking', 'Certification management'],
            },
        ],
        pricing: {
            headline: 'Simple, Transparent Pricing',
            tiers: [
                {
                    name: 'Starter',
                    price: '$199',
                    period: '/month',
                    description: 'Perfect for small teams',
                    features: [
                        'Up to 100 learners',
                        'Course creation',
                        'Basic assessments',
                        'Certificates',
                        'Email support'
                    ],
                    cta: 'Start Free Trial',
                },
                {
                    name: 'Professional',
                    price: '$499',
                    period: '/month',
                    description: 'For growing organizations',
                    features: [
                        'Up to 1,000 learners',
                        'All content types',
                        'Gamification',
                        'Learning paths',
                        'Learning Assistant',
                        'Advanced analytics',
                        'HRMS integration',
                        'Priority support'
                    ],
                    cta: 'Start Free Trial',
                    popular: true,
                },
                {
                    name: 'Enterprise',
                    price: 'Custom',
                    period: 'Pricing',
                    description: 'For large organizations',
                    features: [
                        'Unlimited learners',
                        'Custom branding',
                        'SSO integration',
                        'API access',
                        'Custom integrations',
                        'Dedicated support',
                        'SLA guarantees',
                        'On-premise deployment',
                        '24/7 support'
                    ],
                    cta: 'Contact Sales',
                },
            ],
        },
        socialProof: {
            testimonial: {
                quote: 'Zopkit Academy transformed our training program. We increased course completion rates from 60% to 85% with gamification, and the learning assistant helps learners when they get stuck. HRMS integration keeps records in sync.',
                author: 'Emily Rodriguez',
                title: 'L&D Manager',
                company: 'EduCo',
            },
            stats: [
                { label: 'Companies', value: '3,000+' },
                { label: 'Learners', value: '500,000+' },
                { label: 'Completion Rate', value: '85%' },
                { label: 'Courses', value: '10,000+' },
            ],
        },
        finalCTA: {
            headline: 'Ready to Transform Your Training Program?',
            description: 'Join 3,000+ companies using Zopkit Academy to deliver effective training and track learning progress.',
            primaryCTA: 'Start Free Trial',
            secondaryCTAs: ['Schedule Demo', 'Contact Sales'],
        },
    },
    'zopkit-itsm': {
        hero: {
            headline: 'ITIL-Compliant IT Service Management',
            subheadline: 'Incident management, problem management, change management, asset management, service catalog, and knowledge base. Complete ITSM platform.',
            valueProposition: 'Streamline IT operations with our ITIL-compliant ITSM platform. Manage incidents, changes, assets, and service requests—all with SLA tracking and automation.',
            primaryCTA: 'Start Free Trial',
            secondaryCTA: 'Watch Demo',
            stats: [
                { label: 'Tickets Resolved', value: '10M+' },
                { label: 'Companies', value: '5,000+' },
                { label: 'Avg Resolution Time', value: '2.5 hours' },
                { label: 'SLA Compliance', value: '98%' },
            ],
        },
        problem: {
            headline: 'Struggling with IT Service Management Chaos?',
            painPoints: [
                { icon: AlertTriangle, text: 'Lost tickets and poor tracking' },
                { icon: Clock, text: 'Slow incident resolution times' },
                { icon: FileStack, text: 'Manual change management processes' },
                { icon: Unlink, text: 'Disconnected IT tools and systems' },
                { icon: DollarSign, text: 'High IT operational costs' },
                { icon: TrendingDown, text: 'Poor SLA compliance rates' },
            ],
        },
        solution: {
            headline: 'Modernize IT Operations with ITIL-Compliant ITSM',
            description: 'Zopkit ITSM provides complete IT service management following ITIL best practices. Manage incidents, problems, changes, assets, and service requests with automated workflows, SLA tracking, and comprehensive reporting.',
            differentiators: [
                { icon: MessageCircle, text: 'Incident Management: Fast ticket resolution' },
                { icon: GitBranch, text: 'Change Management: Risk-controlled changes' },
                { icon: Server, text: 'Asset Management: Complete IT asset tracking' },
                { icon: Shield, text: 'ITIL Compliant: Best practice framework' },
                { icon: BarChart3, text: 'SLA Management: Track and meet SLAs' },
                { icon: Link, text: 'Integrations: Connect monitoring and tools' },
            ],
        },
        features: [
            { 
                icon: MessageCircle, 
                title: 'Incident Management', 
                description: 'Ticket creation and tracking, priority management, SLA tracking, escalation workflows, resolution tracking, and multi-channel support. Resolve incidents faster.',
                benefits: [
                    'Resolve incidents 50% faster with automation',
                    'Track SLAs in real-time with automatic alerts',
                    'Route tickets automatically based on rules'
                ]
            },
            { 
                icon: AlertTriangle, 
                title: 'Problem Management', 
                description: 'Root cause analysis, problem tracking, known error database, problem resolution, and proactive problem identification. Prevent recurring incidents.',
                benefits: [
                    'Identify root causes systematically',
                    'Build knowledge base of known errors',
                    'Prevent recurring incidents proactively'
                ]
            },
            { 
                icon: GitBranch, 
                title: 'Change Management', 
                description: 'Change request workflow, change approval process, change calendar, risk assessment, rollback planning, and change impact analysis. Manage changes safely.',
                benefits: [
                    'Reduce change-related incidents by 60%',
                    'Assess change risks before implementation',
                    'Track all changes with complete audit trail'
                ]
            },
            { 
                icon: Server, 
                title: 'Asset Management', 
                description: 'Hardware tracking, software license management, asset lifecycle management, procurement tracking, depreciation calculation, and asset discovery. Track all IT assets.',
                benefits: [
                    'Track all IT assets in one system',
                    'Manage software licenses and compliance',
                    'Optimize asset lifecycle and costs'
                ]
            },
            { 
                icon: ShoppingCart, 
                title: 'Service Catalog', 
                description: 'Service request management, self-service portal, service catalog items, approval workflows, fulfillment tracking, and service automation. Enable self-service.',
                benefits: [
                    'Reduce service requests by 40% with self-service',
                    'Automate service fulfillment workflows',
                    'Provide users with service catalog access'
                ]
            },
            { 
                icon: Book, 
                title: 'Knowledge Base', 
                description: 'Article management, search functionality, version control, access control, analytics, and knowledge sharing. Build and share IT knowledge.',
                benefits: [
                    'Reduce ticket volume by 30% with knowledge base',
                    'Enable self-service with searchable articles',
                    'Maintain knowledge with version control'
                ]
            },
            { 
                icon: Database, 
                title: 'Configuration Management (CMDB)', 
                description: 'Configuration item tracking, relationship mapping, change impact analysis, configuration baselines, and dependency mapping. Maintain accurate CMDB.',
                benefits: [
                    'Track all configuration items and relationships',
                    'Analyze change impact before implementation',
                    'Maintain configuration baselines'
                ]
            },
            { 
                icon: Shield, 
                title: 'SLA Management', 
                description: 'SLA definition, SLA monitoring, breach alerts, performance reporting, service level reporting, and SLA analytics. Meet service level commitments.',
                benefits: [
                    'Monitor SLAs in real-time with automatic alerts',
                    'Track SLA performance across all services',
                    'Generate SLA reports for stakeholders'
                ]
            },
            { 
                icon: BarChart3, 
                title: 'Reporting & Analytics', 
                description: 'Dashboard customization, KPI tracking, trend analysis, custom reports, executive summaries, and IT metrics. Make data-driven IT decisions.',
                benefits: [
                    'Track IT KPIs with customizable dashboards',
                    'Analyze trends and identify improvements',
                    'Generate executive reports automatically'
                ]
            },
            { 
                icon: Link, 
                title: 'Integrations', 
                description: 'Monitoring tools (Nagios, Zabbix), cloud platforms (AWS, Azure), communication tools (Slack, Teams), remote access tools, and API access. Connect all IT tools.',
                benefits: [
                    'Integrate with monitoring tools for auto-ticketing',
                    'Connect with cloud platforms for asset discovery',
                    'Enable notifications via Slack and Teams'
                ]
            },
        ],
        useCases: [
            {
                title: 'Enterprise IT',
                description: 'Large organization IT support with complex infrastructure and multiple teams. Manage incidents, changes, and assets at scale.',
                benefits: ['Scale IT operations', 'Multi-team coordination', 'Complex change management', 'Asset tracking', 'SLA compliance'],
            },
            {
                title: 'Managed Service Providers (MSPs)',
                description: 'MSPs managing IT services for multiple clients. Track tickets, changes, and assets across client environments.',
                benefits: ['Multi-tenant support', 'Client-specific SLAs', 'Asset tracking per client', 'Reporting per client', 'Service catalog'],
            },
            {
                title: 'Small to Medium Businesses (SMBs)',
                description: 'SMB IT teams managing IT operations efficiently. Streamline IT support with self-service and automation.',
                benefits: ['Cost-effective IT management', 'Self-service portal', 'Automated workflows', 'Basic asset tracking', 'Simple reporting'],
            },
            {
                title: 'DevOps Teams',
                description: 'Development operations support with CI/CD integration. Manage infrastructure changes and incidents.',
                benefits: ['CI/CD integration', 'Infrastructure changes', 'Incident management', 'Change automation', 'Monitoring integration'],
            },
        ],
        pricing: {
            headline: 'Simple, Transparent Pricing',
            tiers: [
                {
                    name: 'Starter',
                    price: '$19',
                    period: '/agent/month',
                    description: 'For small IT teams',
                    features: [
                        'Up to 5 agents',
                        'Incident management',
                        'Basic change management',
                        'Service catalog',
                        'Knowledge base',
                        'Email support'
                    ],
                    cta: 'Start Free Trial',
                },
                {
                    name: 'Professional',
                    price: '$49',
                    period: '/agent/month',
                    description: 'For growing IT teams',
                    features: [
                        'Up to 25 agents',
                        'Problem management',
                        'Advanced change management',
                        'Asset management',
                        'CMDB',
                        'SLA management',
                        'Advanced reporting',
                        'Priority support'
                    ],
                    cta: 'Start Free Trial',
                    popular: true,
                },
                {
                    name: 'Enterprise',
                    price: 'Custom',
                    period: 'Pricing',
                    description: 'For large organizations',
                    features: [
                        'Unlimited agents',
                        'ITIL compliance',
                        'Custom workflows',
                        'Advanced integrations',
                        'API access',
                        'Multi-tenant support',
                        'Dedicated support',
                        'SLA guarantees',
                        'On-premise deployment',
                        '24/7 support'
                    ],
                    cta: 'Contact Sales',
                },
            ],
        },
        socialProof: {
            testimonial: {
                quote: 'Zopkit ITSM transformed our IT operations. We reduced average resolution time from 6 hours to 2.5 hours, improved SLA compliance to 98%, and our team can now track all changes and assets in one place. The ITIL compliance features are excellent.',
                author: 'James Wilson',
                title: 'IT Director',
                company: 'GlobalTech',
            },
            stats: [
                { label: 'Companies', value: '5,000+' },
                { label: 'Tickets Resolved', value: '10M+' },
                { label: 'Avg Resolution Time', value: '2.5 hours' },
                { label: 'SLA Compliance', value: '98%' },
            ],
        },
        finalCTA: {
            headline: 'Ready to Modernize Your IT Operations?',
            description: 'Join 5,000+ companies using Zopkit ITSM to streamline IT service management and ensure ITIL compliance.',
            primaryCTA: 'Start Free Trial',
            secondaryCTAs: ['Schedule Demo', 'Contact Sales'],
        },
    },
    'b2c-crm': {
        hero: {
            headline: 'B2C customer engagement in one workspace',
            subheadline: 'Manage lifecycle stages, campaigns, segments, and engagement touchpoints from a single CRM.',
            valueProposition: 'Track customers from first visit through retention with shared data, campaign tools, and lifecycle views in one system.',
            primaryCTA: 'Start Free Trial',
            secondaryCTA: 'Watch Demo',
            stats: [
                { label: 'Customers Managed', value: '1M+' },
                { label: 'Campaigns Created', value: '50,000+' },
                { label: 'Engagement Increase', value: '65%' },
                { label: 'Revenue Growth', value: '40%' },
            ],
        },
        problem: {
            headline: 'Struggling with Customer Engagement and Retention?',
            painPoints: [
                { icon: FileStack, text: 'Scattered customer data across platforms' },
                { icon: Clock, text: 'Manual campaign creation and management' },
                { icon: AlertTriangle, text: 'Poor customer lifecycle visibility' },
                { icon: Unlink, text: 'Disconnected engagement channels' },
                { icon: DollarSign, text: 'Low customer retention rates' },
                { icon: TrendingDown, text: 'Difficulty tracking customer journey' },
            ],
        },
        solution: {
            headline: 'Run B2C engagement from one customer record',
            description: 'Manage lifecycle stages, campaigns, segments, and engagement widgets without switching between separate marketing and support tools.',
            differentiators: [
                { icon: Bot, text: 'Campaign builder: create and schedule multi-step journeys' },
                { icon: Users, text: 'Lifecycle views: track customers through each stage' },
                { icon: Target, text: 'Segments: group customers by behavior and profile' },
                { icon: Zap, text: 'Engagement Widgets: Interactive customer engagement tools' },
                { icon: BarChart3, text: 'Real-Time Analytics: Live performance tracking' },
                { icon: Workflow, text: 'AI Journeys: Automated customer journey automation' },
            ],
        },
        features: [
            { 
                icon: Monitor, 
                title: 'Command Center', 
                description: 'Unified dashboard with real-time campaign performance, customer lifecycle health, revenue tracking, and live event monitoring. Get complete visibility into your customer engagement.',
                benefits: [
                    'Monitor all campaigns from one dashboard',
                    'Track customer lifecycle health in real-time',
                    'View revenue and engagement metrics instantly'
                ]
            },
            { 
                icon: Bot, 
                title: 'Campaign Builder',
                description: 'Campaign creation with natural language input, strategy templates, campaign templates, and optimization tools. Create campaigns in minutes, not hours.',
                benefits: [
                    'Create campaigns faster with templates',
                    'Draft campaign strategies from briefs',
                    'Optimize campaigns with built-in analytics'
                ]
            },
            { 
                icon: Target, 
                title: 'Customer Segments',
                description: 'Customer segmentation with demographics, behavior, lifecycle stage, engagement scores, and clustering. Target the right customers at the right time.',
                benefits: [
                    'Build segments from behavior and lifecycle data',
                    'Target customers based on engagement',
                    'Group customers with rule-based clustering'
                ]
            },
            { 
                icon: TrendingUp, 
                title: 'Customer Lifecycle Management', 
                description: 'Track customers through lifecycle stages (visitor, prospect, customer, active), automated stage transitions, engagement scoring, and lifecycle analytics. Manage customer journey end-to-end.',
                benefits: [
                    'Track customers through complete lifecycle',
                    'Automate stage transitions based on engagement',
                    'Score customer engagement automatically'
                ]
            },
            { 
                icon: Layout, 
                title: 'Engagement Widgets', 
                description: 'Interactive engagement widgets (spin wheel, scratch cards, quizzes) for websites, mobile apps, and social media. Gamified customer engagement with real-time rewards.',
                benefits: [
                    'Increase engagement by 65% with interactive widgets',
                    'Deploy widgets across all channels',
                    'Reward customers in real-time'
                ]
            },
            { 
                icon: Gift, 
                title: 'Rewards & Budgets', 
                description: 'Flexible reward system with coupons, discounts, points, and cash rewards. Budget management with allocation tracking and spend optimization.',
                benefits: [
                    'Manage rewards and budgets in one place',
                    'Track reward allocation automatically',
                    'Optimize budget spend with analytics'
                ]
            },
            { 
                icon: Workflow, 
                title: 'AI Journeys', 
                description: 'Automated customer journey workflows with email, SMS, push notifications, wait nodes, and split logic. Create complex multi-step customer journeys.',
                benefits: [
                    'Automate customer journeys end-to-end',
                    'Send personalized communications automatically',
                    'Create complex multi-step workflows'
                ]
            },
            { 
                icon: GitBranch, 
                title: 'Experiments & A/B Testing', 
                description: 'A/B testing for campaigns, widgets, and communications. Test variants, track performance, and optimize based on data. Make data-driven decisions.',
                benefits: [
                    'Test campaign variants automatically',
                    'Track A/B test performance in real-time',
                    'Optimize campaigns based on test results'
                ]
            },
            { 
                icon: BarChart3, 
                title: 'Analytics & Insights', 
                description: 'Real-time analytics dashboard, lifecycle analytics, campaign performance metrics, customer insights, and predictive analytics. Make data-driven engagement decisions.',
                benefits: [
                    'Track performance in real-time',
                    'Analyze customer lifecycle trends',
                    'Get insights and recommendations from analytics'
                ]
            },
            { 
                icon: Sparkles, 
                title: 'Trend Intelligence', 
                description: 'Market trend scouting, brand relevance analysis, competitive intelligence, and trend-based campaign suggestions. Stay ahead of market trends.',
                benefits: [
                    'Discover trending topics automatically',
                    'Analyze brand relevance to trends',
                    'Get campaign suggestions based on trends'
                ]
            },
        ],
        useCases: [
            {
                title: 'E-Commerce Brands',
                description: 'Engage customers throughout their journey with personalized campaigns, lifecycle management, and engagement widgets. Increase retention and lifetime value.',
                benefits: ['Customer lifecycle tracking', 'Engagement widgets', 'Personalized campaigns', 'Retention automation', 'Revenue growth'],
            },
            {
                title: 'SaaS Companies',
                description: 'Manage customer onboarding, activation, and retention with automated journeys, lifecycle management, and engagement scoring.',
                benefits: ['Onboarding automation', 'Activation tracking', 'Retention campaigns', 'Lifecycle management', 'Churn prevention'],
            },
            {
                title: 'D2C Brands',
                description: 'Build brand loyalty with gamified engagement, rewards, and personalized customer journeys. Track customer lifecycle and optimize engagement.',
                benefits: ['Brand engagement', 'Gamified experiences', 'Loyalty programs', 'Customer journeys', 'Lifecycle optimization'],
            },
            {
                title: 'Retail Chains',
                description: 'Engage customers across channels with unified campaigns, lifecycle management, and multi-channel engagement widgets.',
                benefits: ['Multi-channel engagement', 'Unified campaigns', 'Lifecycle tracking', 'Cross-channel analytics', 'Customer retention'],
            },
        ],
        pricing: {
            headline: 'Simple, Transparent Pricing',
            tiers: [
                {
                    name: 'Starter',
                    price: '$199',
                    period: '/month',
                    description: 'Perfect for small businesses',
                    features: [
                        'Up to 10,000 customers',
                        'Basic campaign creator',
                        'Lifecycle management',
                        'Engagement widgets',
                        'Basic analytics',
                        'Email support'
                    ],
                    cta: 'Start Free Trial',
                },
                {
                    name: 'Professional',
                    price: '$499',
                    period: '/month',
                    description: 'For growing businesses',
                    features: [
                        'Up to 100,000 customers',
                        'AI campaign creator',
                        'Smart segments',
                        'AI journeys',
                        'A/B testing',
                        'Advanced analytics',
                        'Trend intelligence',
                        'Priority support'
                    ],
                    cta: 'Start Free Trial',
                    popular: true,
                },
                {
                    name: 'Enterprise',
                    price: 'Custom',
                    period: 'Pricing',
                    description: 'For large organizations',
                    features: [
                        'Unlimited customers',
                        'Advanced AI features',
                        'Custom integrations',
                        'Dedicated support',
                        'SLA guarantees',
                        'API access',
                        'White-label widgets',
                        'On-premise deployment',
                        '24/7 support'
                    ],
                    cta: 'Contact Sales',
                },
            ],
        },
        socialProof: {
            testimonial: {
                quote: 'Growth AI OS transformed our customer engagement. We increased customer retention by 40% and saw a 65% increase in engagement rates. The AI campaign creator saves us hours every week, and the lifecycle management helps us understand our customers better.',
                author: 'David Martinez',
                title: 'Marketing Director',
                company: 'RetailTech Inc.',
            },
            stats: [
                { label: 'Companies', value: '1,000+' },
                { label: 'Customers Managed', value: '1M+' },
                { label: 'Engagement Increase', value: '65%' },
                { label: 'Revenue Growth', value: '40%' },
            ],
        },
        finalCTA: {
            headline: 'Ready to Transform Your Customer Engagement?',
            description: 'Join 1,000+ companies using Growth AI OS to engage customers and drive growth.',
            primaryCTA: 'Start Free Trial',
            secondaryCTAs: ['Schedule Demo', 'Contact Sales'],
        },
    },
};

// Export product info for navigation
export const productInfo = [
    { id: 'affiliate-connect', name: 'Affiliate Connect', slug: 'affiliate-connect' },
    { id: 'b2b-crm', name: 'B2B CRM', slug: 'b2b-crm' },
    { id: 'b2c-crm', name: 'B2C CRM', slug: 'b2c-crm' },
    { id: 'operations-management', name: 'Operations Management', slug: 'operations-management' },
    { id: 'project-management', name: 'Project Management', slug: 'project-management' },
    { id: 'financial-accounting', name: 'Financial Accounting', slug: 'financial-accounting' },
    { id: 'hrms', name: 'HRMS', slug: 'hrms' },
    { id: 'esop-system', name: 'ESOP System', slug: 'esop-system' },
    { id: 'flowtilla', name: 'Flowtilla', slug: 'flowtilla' },
    { id: 'zopkit-academy', name: 'Zopkit Academy', slug: 'zopkit-academy' },
    { id: 'zopkit-itsm', name: 'Zopkit ITSM', slug: 'zopkit-itsm' },
];