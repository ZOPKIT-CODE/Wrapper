import type { ReactNode } from 'react';
import { getCRMFeatureSvg } from '@/features/landing/pages/getCRMFeatureSvg';

export type LandingScreenshotTab = {
  id: string;
  label: string;
  url: string;
  caption: string;
  detail: string;
  productId?: string;
  render: () => ReactNode;
};

export const HERO_SHOWCASE_TABS: LandingScreenshotTab[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    url: 'app.zopkit.com',
    caption: 'Command center',
    detail: 'Revenue, cash, and health metrics on one screen.',
    render: () => (
      <img
        src="/fa-dashboard.svg"
        alt="Zopkit workspace dashboard"
        className="w-full h-auto block"
        loading="eager"
        decoding="async"
      />
    ),
  },
  {
    id: 'crm',
    label: 'CRM',
    url: 'app.zopkit.com/crm/leads',
    caption: 'Pipeline view',
    detail: 'Leads, stages, and weighted forecast without export.',
    productId: 'b2b-crm',
    render: () => (
      <div className="leading-none [&_svg]:w-full [&_svg]:h-auto [&_svg]:block">
        {getCRMFeatureSvg(0)}
      </div>
    ),
  },
  {
    id: 'finance',
    label: 'Finance',
    url: 'app.zopkit.com/finance/ledger',
    caption: 'General ledger',
    detail: 'Accounts, journals, and period close in the same org.',
    productId: 'financial-accounting',
    render: () => (
      <img
        src="/fa-general-ledger.svg"
        alt="Zopkit finance general ledger"
        className="w-full h-auto block"
        loading="lazy"
        decoding="async"
      />
    ),
  },
  {
    id: 'operations',
    label: 'Operations',
    url: 'app.zopkit.com/operations',
    caption: 'Fulfillment flow',
    detail: 'Orders, inventory, and handoffs across departments.',
    productId: 'operations-management',
    render: () => (
      <img
        src="/accounting-flow.svg"
        alt="Zopkit operations workflow"
        className="w-full h-auto block"
        loading="lazy"
        decoding="async"
      />
    ),
  },
];

export const MODULE_RAIL_ITEMS = [
  {
    id: 'b2b-crm',
    name: 'B2B CRM',
    desc: 'Pipeline, accounts, and forecast in one view.',
    url: 'app.zopkit.com/crm',
    render: () => (
      <div className="leading-none [&_svg]:w-[200%] [&_svg]:h-auto [&_svg]:block origin-top-left scale-[0.5]">
        {getCRMFeatureSvg(1)}
      </div>
    ),
    maxHeight: 200,
  },
  {
    id: 'financial-accounting',
    name: 'Finance',
    desc: 'Ledger, reconciliation, and close controls.',
    url: 'app.zopkit.com/finance',
    render: () => (
      <img
        src="/fa-bank-reconciliation.svg"
        alt=""
        className="w-full h-auto block object-top"
        loading="lazy"
        decoding="async"
      />
    ),
    maxHeight: 200,
  },
  {
    id: 'operations-management',
    name: 'Operations',
    desc: 'Inventory, orders, and fulfillment handoffs.',
    url: 'app.zopkit.com/operations',
    render: () => (
      <img
        src="/fa-cost-accounting.svg"
        alt=""
        className="w-full h-auto block object-top"
        loading="lazy"
        decoding="async"
      />
    ),
    maxHeight: 200,
  },
  {
    id: 'hrms',
    name: 'HRMS',
    desc: 'Hire, onboard, and pay from the same org graph.',
    url: 'app.zopkit.com/hr',
    render: () => (
      <img
        src="/fa-compliance-audit.svg"
        alt=""
        className="w-full h-auto block object-top"
        loading="lazy"
        decoding="async"
      />
    ),
    maxHeight: 200,
  },
  {
    id: 'project-management',
    name: 'Projects',
    desc: 'Delivery, budget, and client billing tied to CRM.',
    url: 'app.zopkit.com/projects',
    render: () => (
      <div className="leading-none [&_svg]:w-[200%] [&_svg]:h-auto [&_svg]:block origin-top-left scale-[0.5]">
        {getCRMFeatureSvg(3)}
      </div>
    ),
    maxHeight: 200,
  },
  {
    id: 'flowtilla',
    name: 'Flowtilla',
    desc: 'Cross-app automation without a separate iPaaS.',
    url: 'app.zopkit.com/flowtilla',
    render: () => (
      <img
        src="/fa-multi-entity.svg"
        alt=""
        className="w-full h-auto block object-top"
        loading="lazy"
        decoding="async"
      />
    ),
    maxHeight: 200,
  },
] as const;

export const SPOTLIGHT_FEATURES = [
  {
    id: 'crm-deals',
    productId: 'b2b-crm',
    title: 'CRM that shares the same customer record as finance',
    body: 'When a deal closes, billing and fulfillment see the update immediately. No CSV handoffs between sales and ops.',
    url: 'app.zopkit.com/crm/deals',
    bullets: ['Kanban pipeline with weighted forecast', 'Account hierarchy and contact timeline', 'Quotes tied to subscription billing'],
    render: () => (
      <div className="leading-none [&_svg]:w-full [&_svg]:h-auto [&_svg]:block">
        {getCRMFeatureSvg(0)}
      </div>
    ),
  },
  {
    id: 'finance-close',
    productId: 'financial-accounting',
    title: 'Finance built for multi-entity close, not spreadsheets',
    body: 'Ledgers, reconciliation, and audit trails run on the same permissions model as the rest of the suite.',
    url: 'app.zopkit.com/finance/close',
    bullets: ['General ledger with period controls', 'Bank reconciliation and multi-currency', 'Compliance-ready audit history'],
    render: () => (
      <img
        src="/fa-general-ledger.svg"
        alt="Zopkit finance ledger"
        className="w-full h-auto block"
        loading="lazy"
        decoding="async"
      />
    ),
  },
] as const;
