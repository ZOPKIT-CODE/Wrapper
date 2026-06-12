import React from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { ProductData } from '@/types/products'
import {
  Check,
  X,
  XCircle,
  CheckCircle,
  Minus,
  AlertCircle,
  Sparkles,
  LayoutGrid,
  ChevronRight,
  ArrowRight,
  Calendar,
} from 'lucide-react'
import { productPagesData, productInfo } from '@/data/productPages'
import {
  getPricingAppIdForProductSlug,
  getProductModuleMatrixRows,
} from '@/data/productPricingModuleBridge'
import { ProductFeatureCard } from '@/features/landing/product/ProductFeatureCard'
import { MarketingContentLayout } from '@/components/layout/MarketingContentLayout'
import { resolveMarketingCtaAction } from '@/features/landing/marketing-cta'
import { useMarketingContactCta } from '@/features/landing/useMarketingContactCta'
import { FAMobileProductPage } from './FAMobileProductPage'

const ProductPage: React.FC = () => {
  const { productId } = useParams({ strict: false })
  const navigate = useNavigate()
  const scrollToContact = useMarketingContactCta()

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  // Scroll progress for stacking cards
  const container = React.useRef(null)

  // Scroll to top when productId changes (route change)
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [productId])

  // Get product data
  const data: ProductData | undefined = productId
    ? productPagesData[productId]
    : undefined

  const pricingAppId = productId
    ? getPricingAppIdForProductSlug(productId)
    : undefined
  const moduleMatrixRows = pricingAppId
    ? getProductModuleMatrixRows(pricingAppId)
    : []
  const usePricingModules = moduleMatrixRows.length > 0

  /** Legacy marketing comparison when this product is not mapped to `pricingPlanMatrix` apps */
  const legacyComparisonRows =
    data && !usePricingModules
      ? [
          ...Array.from(
            new Set(data.pricing.tiers.flatMap((tier) => tier.features))
          ).map((f) => ({
            name: f,
            isDynamic: true as const,
          })),
          {
            name: 'Dedicated Support',
            isDynamic: false as const,
            values: [false, 'Priority', '24/7 Dedicated'] as const,
          },
          {
            name: 'API Access',
            isDynamic: false as const,
            values: [true, true, true] as const,
          },
          {
            name: 'Custom Integrations',
            isDynamic: false as const,
            values: [false, true, true] as const,
          },
          {
            name: 'SLA Guarantee',
            isDynamic: false as const,
            values: [false, false, '99.9%'] as const,
          },
        ]
      : []

  const productName =
    productInfo.find((p) => p.id === productId)?.name ?? 'Zopkit'

  // If product not found or incomplete, show 404
  // This MUST come after all hooks
  if (
    !data ||
    !data.hero ||
    !data.problem ||
    !data.solution ||
    !data.features
  ) {
    return (
      <MarketingContentLayout
        scrollToTopOnMount={false}
        mainClassName="flex min-h-[calc(100vh-5rem)] items-center justify-center"
      >
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold text-[#1B2E5A]">
            Product Not Found
          </h1>
          <p className="mb-8 text-slate-600">
            The product you're looking for doesn't exist or is not yet
            available.
          </p>
          <button
            onClick={() => navigate({ to: '/' })}
            className="rounded-lg bg-[#1B2E5A] px-6 py-3 text-white transition hover:bg-[#162447]"
          >
            Go to Homepage
          </button>
        </div>
      </MarketingContentLayout>
    )
  }

  return (
    <>
      {/* FA Mobile — shown only on mobile for financial-accounting */}
      {productId === 'financial-accounting' && (
        <div className="md:hidden">
          <FAMobileProductPage />
        </div>
      )}
      <MarketingContentLayout
        scrollToTopOnMount={false}
        className={
          productId === 'financial-accounting' ? 'hidden md:block' : undefined
        }
        mainClassName="bg-white font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900"
      >
        <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;600&display=swap');
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(156,163,175,0.3); border-radius: 20px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(156,163,175,0.5); }
            `}</style>

        {/* 1. HERO SECTION */}
        <section
          className="relative bg-white pt-28 pb-32"
          style={{ overflow: 'visible' }}
        >
          {/* Soft background radial gradient */}
          <div className="pointer-events-none absolute inset-0 z-0">
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse 90% 70% at 50% 20%, #dde4f5 0%, #edf0f8 45%, #ffffff 80%)',
              }}
            />
          </div>

          <div className="relative z-10 container mx-auto px-4 lg:px-8">
            {/* Hero — Monitor born from the orb */}
            <div
              className="relative flex flex-col items-center"
              style={{ marginLeft: '-2rem', marginRight: '-2rem' }}
            >
              {/* Light cone — sits behind monitor (zIndex 0 < monitor zIndex 1) */}
              <div
                className="fa-light-cone"
                style={{
                  position: 'absolute',
                  bottom: '35px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '720px',
                  height: '520px',
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
              >
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{ display: 'block' }}
                >
                  <defs>
                    <linearGradient
                      id="fa-cone-core"
                      x1="50"
                      y1="100"
                      x2="50"
                      y2="68"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0%" stopColor="rgba(46,79,140,0.80)" />
                      <stop offset="30%" stopColor="rgba(36,59,110,0.42)" />
                      <stop offset="100%" stopColor="rgba(27,46,90,0.08)" />
                    </linearGradient>
                    <linearGradient
                      id="fa-cone-wide"
                      x1="50"
                      y1="100"
                      x2="50"
                      y2="65"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0%" stopColor="rgba(36,59,110,0.55)" />
                      <stop offset="50%" stopColor="rgba(27,46,90,0.22)" />
                      <stop offset="100%" stopColor="rgba(15,27,61,0.04)" />
                    </linearGradient>
                    <linearGradient
                      id="fa-ray-l"
                      x1="50"
                      y1="100"
                      x2="12"
                      y2="68"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0%" stopColor="rgba(120,160,220,1)" />
                      <stop offset="45%" stopColor="rgba(46,79,140,0.75)" />
                      <stop offset="100%" stopColor="rgba(27,46,90,0.20)" />
                    </linearGradient>
                    <linearGradient
                      id="fa-ray-r"
                      x1="50"
                      y1="100"
                      x2="88"
                      y2="68"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0%" stopColor="rgba(120,160,220,1)" />
                      <stop offset="45%" stopColor="rgba(46,79,140,0.75)" />
                      <stop offset="100%" stopColor="rgba(27,46,90,0.20)" />
                    </linearGradient>
                    <radialGradient
                      id="fa-src-halo"
                      cx="50"
                      cy="100"
                      r="12"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0%" stopColor="rgba(140,180,240,0.90)" />
                      <stop offset="40%" stopColor="rgba(46,79,140,0.55)" />
                      <stop offset="100%" stopColor="rgba(15,27,61,0.00)" />
                    </radialGradient>
                    <linearGradient
                      id="fa-screen-glow"
                      x1="17"
                      y1="68"
                      x2="83"
                      y2="68"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0%" stopColor="rgba(27,46,90,0.00)" />
                      <stop offset="20%" stopColor="rgba(36,59,110,0.45)" />
                      <stop offset="50%" stopColor="rgba(46,79,140,0.65)" />
                      <stop offset="80%" stopColor="rgba(36,59,110,0.45)" />
                      <stop offset="100%" stopColor="rgba(27,46,90,0.00)" />
                    </linearGradient>
                    <filter
                      id="fa-f-soft"
                      x="-30%"
                      y="-15%"
                      width="160%"
                      height="145%"
                    >
                      <feGaussianBlur stdDeviation="2 1.2" />
                    </filter>
                    <filter
                      id="fa-f-wide"
                      x="-50%"
                      y="-15%"
                      width="200%"
                      height="145%"
                    >
                      <feGaussianBlur stdDeviation="6 3.5" />
                    </filter>
                    <filter
                      id="fa-f-ray"
                      x="-200%"
                      y="-30%"
                      width="500%"
                      height="160%"
                    >
                      <feGaussianBlur stdDeviation="0.6 0.3" />
                    </filter>
                    <filter
                      id="fa-f-glow"
                      x="-200%"
                      y="-30%"
                      width="500%"
                      height="160%"
                    >
                      <feGaussianBlur stdDeviation="1.5 0.8" />
                    </filter>
                    <filter
                      id="fa-f-edge"
                      x="-20%"
                      y="-200%"
                      width="140%"
                      height="500%"
                    >
                      <feGaussianBlur stdDeviation="0.8 2.5" />
                    </filter>
                    <filter
                      id="fa-f-halo"
                      x="-100%"
                      y="-100%"
                      width="300%"
                      height="300%"
                    >
                      <feGaussianBlur stdDeviation="3 2" />
                    </filter>
                  </defs>
                  <polygon
                    points="50,100 10,68 90,68"
                    fill="url(#fa-cone-wide)"
                    filter="url(#fa-f-wide)"
                    opacity="0.85"
                  />
                  <polygon
                    points="50,100 20,68 80,68"
                    fill="url(#fa-cone-core)"
                    filter="url(#fa-f-soft)"
                    opacity="0.9"
                  />
                  <polygon
                    points="50,100 33,68 67,68"
                    fill="url(#fa-cone-core)"
                    filter="url(#fa-f-soft)"
                    opacity="0.75"
                  />
                  <polygon
                    points="50,100 43,68 57,68"
                    fill="url(#fa-cone-core)"
                    filter="url(#fa-f-soft)"
                    opacity="0.9"
                  />
                  <line
                    x1="50"
                    y1="100"
                    x2="20"
                    y2="68"
                    stroke="url(#fa-ray-l)"
                    strokeWidth="0.7"
                    filter="url(#fa-f-ray)"
                  />
                  <line
                    x1="50"
                    y1="100"
                    x2="20"
                    y2="68"
                    stroke="url(#fa-ray-l)"
                    strokeWidth="4"
                    filter="url(#fa-f-glow)"
                    opacity="0.75"
                  />
                  <line
                    x1="50"
                    y1="100"
                    x2="80"
                    y2="68"
                    stroke="url(#fa-ray-r)"
                    strokeWidth="0.7"
                    filter="url(#fa-f-ray)"
                  />
                  <line
                    x1="50"
                    y1="100"
                    x2="80"
                    y2="68"
                    stroke="url(#fa-ray-r)"
                    strokeWidth="4"
                    filter="url(#fa-f-glow)"
                    opacity="0.75"
                  />
                  <ellipse
                    cx="50"
                    cy="100"
                    rx="7"
                    ry="2.5"
                    fill="url(#fa-src-halo)"
                    filter="url(#fa-f-halo)"
                  />
                  <line
                    x1="20"
                    y1="68"
                    x2="80"
                    y2="68"
                    stroke="url(#fa-screen-glow)"
                    strokeWidth="1.5"
                    filter="url(#fa-f-edge)"
                  />
                  <circle
                    cx="20"
                    cy="68"
                    r="1.5"
                    fill="rgba(36,59,110,0.7)"
                    filter="url(#fa-f-soft)"
                  />
                  <circle
                    cx="80"
                    cy="68"
                    r="1.5"
                    fill="rgba(36,59,110,0.7)"
                    filter="url(#fa-f-soft)"
                  />
                </svg>
              </div>

              {/* Monitor — starts at orb level and rises up */}
              <div
                className="hero-monitor-born relative w-full"
                style={{
                  maxWidth: '900px',
                  borderRadius: '24px',
                  background:
                    'linear-gradient(175deg, #1c2035 0%, #0e1120 50%, #090c18 100%)',
                  padding: '8px',
                  boxShadow:
                    '0 30px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.07)',
                  zIndex: 1,
                }}
              >
                {/* Top bar — single row with logo dot + right dot (matches reference) */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 14px',
                    height: '36px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: '#3b5bdb',
                        boxShadow: '0 0 6px rgba(59,91,219,0.8)',
                      }}
                    />
                    <div
                      style={{
                        height: '5px',
                        width: '90px',
                        borderRadius: '3px',
                        background: 'rgba(255,255,255,0.12)',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        height: '5px',
                        width: '70px',
                        borderRadius: '3px',
                        background: 'rgba(255,255,255,0.08)',
                      }}
                    />
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.18)',
                      }}
                    />
                  </div>
                </div>

                {/* Screen content */}
                <div style={{ borderRadius: '16px', overflow: 'hidden' }}>
                  {productId === 'financial-accounting' ? (
                    /* White FA dashboard mock */
                    <div
                      style={{
                        display: 'flex',
                        height: '480px',
                        background: '#FFFFFF',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Sidebar */}
                      <div
                        style={{
                          width: '170px',
                          flexShrink: 0,
                          background: '#F5F7FA',
                          borderRight: '1px solid rgba(19,32,74,0.08)',
                          padding: '10px 7px',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        <div
                          style={{
                            padding: '4px 5px',
                            marginBottom: 10,
                            display: 'flex',
                            justifyContent: 'center',
                          }}
                        >
                          <img
                            src="https://res.cloudinary.com/dr9vzaa7u/image/upload/v1771698937/Zopkit-full_n7lm0f.png"
                            alt="Zopkit"
                            style={{
                              height: 26,
                              width: 'auto',
                              display: 'block',
                            }}
                          />
                        </div>
                        {[
                          'General Ledger',
                          'Accounts Payable',
                          'Accounts Receivable',
                          'Banking & Cash',
                          'GST & Tax',
                          'Fixed Assets',
                          'Financial Reports',
                          'Audit Trail',
                          'Cost Centers',
                          'Budgeting',
                          'Compliance',
                        ].map((item, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '5px 7px',
                              background:
                                i === 0 ? 'rgba(27,46,90,0.08)' : 'transparent',
                              borderRadius: 4,
                              borderLeft: `2px solid ${i === 0 ? '#1b2e5a' : 'transparent'}`,
                              marginBottom: 2,
                            }}
                          >
                            <div
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: '50%',
                                background: '#1b2e5a',
                                flexShrink: 0,
                                opacity: i === 0 ? 1 : 0.3,
                              }}
                            />
                            <span
                              style={{
                                fontSize: 7,
                                color:
                                  i === 0 ? '#1b2e5a' : 'rgba(19,32,74,0.45)',
                                fontWeight: i === 0 ? 600 : 400,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {item}
                            </span>
                          </div>
                        ))}
                      </div>
                      {/* Main content */}
                      <div
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          overflow: 'hidden',
                        }}
                      >
                        {/* Header */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: '#1b2e5a',
                              }}
                            >
                              General Ledger
                            </span>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                background: 'rgba(27,46,90,0.06)',
                                border: '1px solid rgba(27,46,90,0.15)',
                                borderRadius: 100,
                                padding: '2px 8px',
                              }}
                            >
                              <div
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: '50%',
                                  background: '#1b2e5a',
                                }}
                              />
                              <span
                                style={{
                                  fontSize: 7,
                                  color: 'rgba(27,46,90,0.9)',
                                  fontWeight: 600,
                                }}
                              >
                                FY 2025-26
                              </span>
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: 7,
                              color: 'rgba(19,32,74,0.35)',
                            }}
                          >
                            Period: Apr–May 2025
                          </span>
                        </div>
                        {/* Stat cards */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: 7,
                          }}
                        >
                          {[
                            {
                              label: 'Total Revenue',
                              value: '₹84.2L',
                              sub: '+18% YoY',
                              color: '#1b2e5a',
                            },
                            {
                              label: 'GST Filed',
                              value: '100%',
                              sub: 'Aug 2025 ✓',
                              color: '#047857',
                            },
                            {
                              label: 'Payables',
                              value: '₹12.4L',
                              sub: '23 pending',
                              color: '#c2410c',
                            },
                            {
                              label: 'Cash Balance',
                              value: '₹34.6L',
                              sub: 'Updated today',
                              color: '#0369a1',
                            },
                          ].map((stat, i) => (
                            <div
                              key={i}
                              style={{
                                background: '#FFFFFF',
                                border: '1px solid rgba(19,32,74,0.08)',
                                borderTop: `2px solid ${stat.color}`,
                                borderRadius: '0 0 8px 8px',
                                padding: '8px 10px',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 6.5,
                                  color: 'rgba(19,32,74,0.45)',
                                  fontWeight: 500,
                                  marginBottom: 4,
                                }}
                              >
                                {stat.label}
                              </div>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: stat.color,
                                }}
                              >
                                {stat.value}
                              </div>
                              <div
                                style={{
                                  fontSize: 6,
                                  color: 'rgba(19,32,74,0.35)',
                                  marginTop: 3,
                                }}
                              >
                                {stat.sub}
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Journal entries table */}
                        <div
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: 8,
                            overflow: 'hidden',
                            border: '1px solid rgba(19,32,74,0.08)',
                          }}
                        >
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns:
                                '1fr 0.7fr 0.7fr 0.6fr 0.6fr',
                              gap: 6,
                              padding: '6px 10px',
                              background: 'rgba(19,32,74,0.04)',
                              borderBottom: '1px solid rgba(19,32,74,0.08)',
                            }}
                          >
                            {[
                              'Journal Entry',
                              'Date',
                              'Account',
                              'Debit',
                              'Credit',
                            ].map((col, j) => (
                              <span
                                key={j}
                                style={{
                                  fontSize: 6,
                                  fontWeight: 600,
                                  color: 'rgba(19,32,74,0.4)',
                                  textTransform: 'uppercase' as const,
                                }}
                              >
                                {col}
                              </span>
                            ))}
                          </div>
                          {[
                            {
                              entry: 'JE-2025-0847',
                              date: '15 May',
                              account: 'Sales A/c',
                              debit: '₹4.2L',
                              credit: '—',
                              status: 'posted',
                            },
                            {
                              entry: 'JE-2025-0846',
                              date: '14 May',
                              account: 'GST Payable',
                              debit: '—',
                              credit: '₹0.76L',
                              status: 'posted',
                            },
                            {
                              entry: 'JE-2025-0845',
                              date: '13 May',
                              account: 'Vendor PMT',
                              debit: '₹1.8L',
                              credit: '—',
                              status: 'reconciled',
                            },
                            {
                              entry: 'JE-2025-0844',
                              date: '12 May',
                              account: 'Fixed Asset',
                              debit: '₹6.0L',
                              credit: '—',
                              status: 'pending',
                            },
                            {
                              entry: 'JE-2025-0843',
                              date: '11 May',
                              account: 'TDS Receivable',
                              debit: '—',
                              credit: '₹0.34L',
                              status: 'posted',
                            },
                            {
                              entry: 'JE-2025-0842',
                              date: '10 May',
                              account: 'Salary Exp',
                              debit: '₹8.4L',
                              credit: '—',
                              status: 'posted',
                            },
                          ].map((row, i) => (
                            <div
                              key={i}
                              style={{
                                display: 'grid',
                                gridTemplateColumns:
                                  '1fr 0.7fr 0.7fr 0.6fr 0.6fr',
                                gap: 6,
                                padding: '5px 10px',
                                borderBottom: '1px solid rgba(19,32,74,0.04)',
                                alignItems: 'center',
                                background:
                                  i % 2 === 0
                                    ? 'transparent'
                                    : 'rgba(19,32,74,0.015)',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                              >
                                <div
                                  style={{
                                    width: 5,
                                    height: 5,
                                    borderRadius: '50%',
                                    background:
                                      row.status === 'posted'
                                        ? '#1b2e5a'
                                        : row.status === 'reconciled'
                                          ? '#047857'
                                          : '#d97706',
                                    flexShrink: 0,
                                  }}
                                />
                                <span
                                  style={{
                                    fontSize: 6.5,
                                    color: '#1b2e5a',
                                    fontWeight: 600,
                                  }}
                                >
                                  {row.entry}
                                </span>
                              </div>
                              <span
                                style={{
                                  fontSize: 6.5,
                                  color: 'rgba(19,32,74,0.5)',
                                }}
                              >
                                {row.date}
                              </span>
                              <span
                                style={{
                                  fontSize: 6.5,
                                  color: 'rgba(19,32,74,0.7)',
                                  fontWeight: 500,
                                }}
                              >
                                {row.account}
                              </span>
                              <span
                                style={{
                                  fontSize: 6.5,
                                  color:
                                    row.debit !== '—'
                                      ? '#047857'
                                      : 'rgba(19,32,74,0.3)',
                                  fontWeight: row.debit !== '—' ? 600 : 400,
                                }}
                              >
                                {row.debit}
                              </span>
                              <span
                                style={{
                                  fontSize: 6.5,
                                  color:
                                    row.credit !== '—'
                                      ? '#c2410c'
                                      : 'rgba(19,32,74,0.3)',
                                  fontWeight: row.credit !== '—' ? 600 : 400,
                                }}
                              >
                                {row.credit}
                              </span>
                            </div>
                          ))}
                        </div>
                        {/* Bottom panels */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid rgba(19,32,74,0.08)',
                              borderRadius: 8,
                              padding: '8px 10px',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 7.5,
                                fontWeight: 700,
                                color: '#1b2e5a',
                                marginBottom: 6,
                              }}
                            >
                              GST Compliance
                            </div>
                            {[
                              {
                                name: 'GSTR-1',
                                status: 'Filed',
                                color: '#047857',
                              },
                              {
                                name: 'GSTR-3B',
                                status: 'Filed',
                                color: '#047857',
                              },
                              {
                                name: 'E-Invoice',
                                status: 'Active',
                                color: '#1b2e5a',
                              },
                              {
                                name: 'TDS Return',
                                status: 'Pending',
                                color: '#d97706',
                              },
                            ].map((item, i) => (
                              <div
                                key={i}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginBottom: 3,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 6.5,
                                    color: 'rgba(19,32,74,0.6)',
                                  }}
                                >
                                  {item.name}
                                </span>
                                <span
                                  style={{
                                    fontSize: 6,
                                    fontWeight: 600,
                                    color: item.color,
                                    background: `${item.color}18`,
                                    padding: '1px 5px',
                                    borderRadius: 3,
                                  }}
                                >
                                  {item.status}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid rgba(19,32,74,0.08)',
                              borderRadius: 8,
                              padding: '8px 10px',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 7.5,
                                fontWeight: 700,
                                color: '#1b2e5a',
                                marginBottom: 6,
                              }}
                            >
                              Module Health
                            </div>
                            {[
                              { name: 'General Ledger', pct: 98 },
                              { name: 'Accounts Payable', pct: 94 },
                              { name: 'Accounts Receivable', pct: 87 },
                              { name: 'Banking & Cash', pct: 100 },
                            ].map((mod, i) => (
                              <div key={i} style={{ marginBottom: 5 }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginBottom: 2,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 6,
                                      color: 'rgba(19,32,74,0.55)',
                                    }}
                                  >
                                    {mod.name}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 6,
                                      fontWeight: 600,
                                      color: '#1b2e5a',
                                    }}
                                  >
                                    {mod.pct}%
                                  </span>
                                </div>
                                <div
                                  style={{
                                    height: 3,
                                    background: 'rgba(19,32,74,0.08)',
                                    borderRadius: 2,
                                    overflow: 'hidden',
                                  }}
                                >
                                  <div
                                    style={{
                                      height: '100%',
                                      width: `${mod.pct}%`,
                                      background:
                                        'linear-gradient(90deg, rgba(27,46,90,0.5), #1b2e5a)',
                                      borderRadius: 2,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Dark dashboard mock — sidebar + content matches reference layout */
                    <div
                      style={{
                        display: 'flex',
                        height: '480px',
                        background: '#0b0e1a',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Sidebar */}
                      <div
                        style={{
                          width: '190px',
                          flexShrink: 0,
                          background: '#0d1020',
                          borderRight: '1px solid rgba(255,255,255,0.04)',
                          padding: '14px 0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                        }}
                      >
                        {/* Logo row */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '0 14px 14px',
                          }}
                        >
                          <div
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '6px',
                              background:
                                'linear-gradient(135deg, #3b5bdb, #6366f1)',
                              flexShrink: 0,
                            }}
                          />
                          <div
                            style={{
                              height: '6px',
                              width: '70px',
                              borderRadius: '3px',
                              background: 'rgba(255,255,255,0.2)',
                            }}
                          />
                        </div>
                        {/* Nav items */}
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((_, i) => (
                          <div
                            key={i}
                            style={{
                              height: '32px',
                              margin: '0 8px',
                              borderRadius: '7px',
                              background:
                                i === 2
                                  ? 'rgba(59,91,219,0.25)'
                                  : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              padding: '0 10px',
                              gap: '8px',
                            }}
                          >
                            <div
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '2px',
                                background:
                                  i === 2
                                    ? '#5b7fff'
                                    : 'rgba(255,255,255,0.15)',
                                flexShrink: 0,
                              }}
                            />
                            <div
                              style={{
                                height: '5px',
                                borderRadius: '3px',
                                background:
                                  i === 2
                                    ? 'rgba(91,127,255,0.5)'
                                    : 'rgba(255,255,255,0.1)',
                                width: `${42 + ((i * 17) % 38)}px`,
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      {/* Main content */}
                      <div
                        style={{
                          flex: 1,
                          padding: '14px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          overflow: 'hidden',
                        }}
                      >
                        {/* Stat cards row */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '8px',
                          }}
                        >
                          {data.hero.stats.map((stat, i) => (
                            <div
                              key={i}
                              style={{
                                background: 'rgba(255,255,255,0.04)',
                                borderRadius: '10px',
                                border: '1px solid rgba(255,255,255,0.06)',
                                padding: '10px 12px',
                              }}
                            >
                              <div
                                style={{
                                  height: '5px',
                                  width: '55px',
                                  borderRadius: '3px',
                                  background: 'rgba(255,255,255,0.12)',
                                  marginBottom: '7px',
                                }}
                              />
                              <div
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: 'rgba(255,255,255,0.85)',
                                  letterSpacing: '-0.2px',
                                }}
                              >
                                {stat.value}
                              </div>
                              <div
                                style={{
                                  height: '2px',
                                  width: '30px',
                                  borderRadius: '2px',
                                  background: 'rgba(59,91,219,0.6)',
                                  marginTop: '6px',
                                }}
                              />
                            </div>
                          ))}
                        </div>
                        {/* Tab strip */}
                        <div style={{ display: 'flex', gap: '2px' }}>
                          {[
                            'Overview',
                            'Analytics',
                            'Reports',
                            'Settings',
                            'Audit',
                            'Team',
                          ].map((tab, i) => (
                            <div
                              key={tab}
                              style={{
                                height: '26px',
                                borderRadius: '6px',
                                padding: '0 14px',
                                display: 'flex',
                                alignItems: 'center',
                                background:
                                  i === 0
                                    ? 'rgba(59,91,219,0.35)'
                                    : 'transparent',
                                borderBottom:
                                  i === 0
                                    ? '2px solid #5b7fff'
                                    : '2px solid transparent',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '10px',
                                  color:
                                    i === 0
                                      ? '#a0b4ff'
                                      : 'rgba(255,255,255,0.3)',
                                  fontWeight: i === 0 ? 600 : 400,
                                }}
                              >
                                {tab}
                              </span>
                            </div>
                          ))}
                        </div>
                        {/* Table */}
                        <div
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            border: '1px solid rgba(255,255,255,0.05)',
                          }}
                        >
                          {/* Header row */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '2.2fr 1.4fr 1fr 1fr 1fr',
                              gap: '6px',
                              padding: '8px 14px',
                              background: 'rgba(255,255,255,0.03)',
                              borderBottom: '1px solid rgba(59,91,219,0.5)',
                            }}
                          >
                            {[80, 60, 45, 45, 55].map((w, j) => (
                              <div
                                key={j}
                                style={{
                                  height: '5px',
                                  borderRadius: '3px',
                                  background: 'rgba(255,255,255,0.18)',
                                  width: `${w}%`,
                                }}
                              />
                            ))}
                          </div>
                          {/* Data rows */}
                          {[...Array(7)].map((_, row) => (
                            <div
                              key={row}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '2.2fr 1.4fr 1fr 1fr 1fr',
                                gap: '6px',
                                padding: '8px 14px',
                                borderBottom:
                                  '1px solid rgba(255,255,255,0.03)',
                                alignItems: 'center',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                }}
                              >
                                <div
                                  style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.15)',
                                    flexShrink: 0,
                                  }}
                                />
                                <div
                                  style={{
                                    height: '5px',
                                    borderRadius: '3px',
                                    background: 'rgba(255,255,255,0.14)',
                                    width: `${48 + ((row * 23) % 38)}px`,
                                  }}
                                />
                              </div>
                              {[55, 42, 38, 50].map((w, c) => (
                                <div
                                  key={c}
                                  style={{
                                    height: '5px',
                                    borderRadius: '3px',
                                    background: 'rgba(255,255,255,0.09)',
                                    width: `${w}%`,
                                  }}
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                        {/* Bottom two panels */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '10px',
                          }}
                        >
                          {[0, 1].map((panel) => (
                            <div
                              key={panel}
                              style={{
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '10px',
                                border: '1px solid rgba(255,255,255,0.05)',
                                padding: '12px',
                              }}
                            >
                              <div
                                style={{
                                  height: '5px',
                                  width: '70px',
                                  borderRadius: '3px',
                                  background: 'rgba(255,255,255,0.14)',
                                  marginBottom: '10px',
                                }}
                              />
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '5px',
                                  flexWrap: 'wrap',
                                }}
                              >
                                {[...Array(6)].map((_, j) => (
                                  <div
                                    key={j}
                                    style={{
                                      height: '22px',
                                      borderRadius: '5px',
                                      background: 'rgba(255,255,255,0.05)',
                                      border:
                                        '1px solid rgba(255,255,255,0.06)',
                                      width: `${36 + ((j * 13) % 28)}px`,
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Projector puck + beam */}
              <div
                style={{
                  position: 'relative',
                  marginTop: '28px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  zIndex: 2,
                }}
              >
                {/* Flash beam on entry — fades out as puck activates */}
                <div
                  className="hero-beam"
                  style={{
                    position: 'absolute',
                    bottom: '52px',
                    left: '50%',
                    transform: 'translateX(-50%) scaleY(0)',
                    width: '200px',
                    height: '240px',
                    background:
                      'linear-gradient(to top, rgba(46,79,140,0.60) 0%, rgba(60,100,200,0.28) 35%, transparent 100%)',
                    filter: 'blur(16px)',
                    pointerEvents: 'none',
                    borderRadius: '50% 50% 0 0',
                  }}
                />

                {/* ── 3-D Cylindrical Puck (reduced size) ── */}
                <div
                  className="pp-puck-float"
                  style={{
                    position: 'relative',
                    width: '200px',
                    height: '70px',
                    flexShrink: 0,
                    filter:
                      'drop-shadow(0 16px 26px rgba(0,0,0,0.55)) drop-shadow(0 0 44px rgba(27,46,90,0.45))',
                  }}
                >
                  {/* Cylinder side */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '20%',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background:
                        'linear-gradient(to bottom, #212128 0%, #161620 28%, #0d0d14 65%, #070710 100%)',
                      borderRadius: '0 0 50% 50% / 0 0 22% 22%',
                      boxShadow:
                        'inset 5px 0 15px rgba(255,255,255,0.045),inset -5px 0 15px rgba(0,0,0,0.45),inset 0 -8px 20px rgba(0,0,0,0.75)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 0,
                        width: '9%',
                        background:
                          'linear-gradient(to right, rgba(255,255,255,0.07), transparent)',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        right: 0,
                        width: '9%',
                        background:
                          'linear-gradient(to left, rgba(0,0,0,0.35), transparent)',
                      }}
                    />
                  </div>

                  {/* Top face */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '40%',
                      background:
                        'radial-gradient(ellipse at 48% 38%, #2c2c38 0%, #1a1a26 50%, #0e0e18 82%, #08080f 100%)',
                      borderRadius: '50%',
                      zIndex: 2,
                      boxShadow:
                        'inset 0 6px 15px rgba(255,255,255,0.055),inset 0 -4px 10px rgba(0,0,0,0.65),0 5px 15px rgba(0,0,0,0.65)',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: '7%',
                        left: '7%',
                        right: '7%',
                        bottom: '7%',
                        borderRadius: '50%',
                        boxShadow:
                          'inset 0 0 0 1.5px rgba(255,255,255,0.055),inset 0 0 8px rgba(0,0,0,0.6)',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '20%',
                        left: '20%',
                        right: '20%',
                        bottom: '20%',
                        borderRadius: '50%',
                        background:
                          'radial-gradient(ellipse at 50% 42%, #1e1e2a 0%, #0c0c14 100%)',
                        boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.95)',
                      }}
                    />
                    <div
                      className="pp-lens-glow"
                      style={{
                        position: 'absolute',
                        top: '24%',
                        left: '24%',
                        right: '24%',
                        bottom: '24%',
                        borderRadius: '50%',
                        background: 'transparent',
                      }}
                    />
                    <div
                      className="pp-ring-out"
                      style={{
                        position: 'absolute',
                        top: '24%',
                        left: '24%',
                        right: '24%',
                        bottom: '24%',
                        borderRadius: '50%',
                        boxShadow: '0 0 0 1.5px rgba(60,105,200,0.5)',
                      }}
                    />
                    <div
                      className="pp-ring-out-2"
                      style={{
                        position: 'absolute',
                        top: '24%',
                        left: '24%',
                        right: '24%',
                        bottom: '24%',
                        borderRadius: '50%',
                        boxShadow: '0 0 0 1.5px rgba(60,105,200,0.3)',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '32%',
                        left: '32%',
                        right: '32%',
                        bottom: '32%',
                        borderRadius: '50%',
                        background:
                          'radial-gradient(circle at 44% 38%, #d0e4ff 0%, #88aef0 14%, #243B6E 36%, #1B2E5A 64%, #0F1B3D 100%)',
                        boxShadow: 'inset 0 0 8px rgba(0,0,0,0.75)',
                      }}
                    />
                    <div
                      className="pp-hotspot"
                      style={{
                        position: 'absolute',
                        top: '42%',
                        left: '42%',
                        right: '42%',
                        bottom: '42%',
                        borderRadius: '50%',
                        background:
                          'radial-gradient(circle, #fff 0%, #d2e8ff 55%, transparent 100%)',
                      }}
                    />
                  </div>

                  {/* Ground shadow */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-14%',
                      left: '18%',
                      right: '18%',
                      height: '18%',
                      borderRadius: '50%',
                      background: 'rgba(0,0,0,0.5)',
                      filter: 'blur(10px)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. PROBLEM / SOLUTION - COMPACT WINDOW LAYOUT */}
        <section
          className="relative overflow-hidden bg-slate-50 py-24"
          id="perspective"
        >
          {/* Background Decor */}
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          ></div>

          <div className="relative z-10 container mx-auto px-4">
            <div className="mx-auto mb-16 max-w-3xl text-center">
              <span className="mb-4 block text-sm font-bold tracking-wider text-blue-600 uppercase">
                The Evolution
              </span>
              <h2 className="mb-6 text-3xl leading-tight font-bold text-[#1B2E5A] lg:text-4xl">
                The Shift in Perspective
              </h2>
              <p className="text-lg text-slate-600">
                See how {productName} changes the game by bringing order to
                chaos.
              </p>
            </div>

            <div className="mx-auto flex h-[650px] max-w-6xl flex-col items-stretch justify-center gap-8 lg:h-[550px] lg:flex-row">
              {/* THE PROBLEM CARD (COMPACT & SCROLLABLE) */}
              <div className="group relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-red-100 bg-white shadow-xl transition-all duration-500 hover:shadow-2xl hover:shadow-red-900/10">
                {/* Card Header */}
                <div className="z-20 flex items-center justify-between border-b border-red-100 bg-red-50/80 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-red-400"></div>
                      <div className="h-3 w-3 rounded-full bg-red-300"></div>
                      <div className="h-3 w-3 rounded-full bg-red-200"></div>
                    </div>
                    <span className="ml-2 text-xs font-bold tracking-wide text-red-700 uppercase">
                      Manual Workflow
                    </span>
                  </div>
                  <XCircle size={18} className="text-red-400" />
                </div>

                {/* Visualization Background (Chaotic) */}
                <div className="pointer-events-none absolute inset-0 z-0 opacity-20">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute animate-pulse"
                      style={{
                        top: `${Math.random() * 80 + 10}%`,
                        left: `${Math.random() * 80 + 10}%`,
                        animationDuration: `${Math.random() * 3 + 2}s`,
                      }}
                    >
                      <AlertCircle size={24} className="text-red-500" />
                    </div>
                  ))}
                </div>

                {/* Scrollable Content */}
                <div className="custom-scrollbar relative z-10 flex-1 overflow-y-auto p-6 lg:p-8">
                  <div className="mb-6">
                    <h4 className="mb-2 text-2xl leading-tight font-bold text-slate-800">
                      {data.problem.headline}
                    </h4>
                    <div className="h-1 w-12 rounded-full bg-red-400"></div>
                  </div>

                  <div className="space-y-4">
                    {data.problem.painPoints.map((point, i) => (
                      <div
                        key={i}
                        className="group rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:border-rose-200 hover:shadow-md"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500 transition-colors group-hover:bg-rose-100">
                            <X size={14} strokeWidth={2.5} />
                          </div>
                          <p className="pt-0.5 text-sm leading-relaxed font-medium text-slate-700">
                            {point.text}
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* Dummy Extra Content to force scroll if needed */}
                    <div className="space-y-3 pt-4 opacity-50 grayscale">
                      <div className="h-4 w-3/4 rounded bg-slate-100"></div>
                      <div className="h-4 w-1/2 rounded bg-slate-100"></div>
                      <div className="h-4 w-2/3 rounded bg-slate-100"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* THE SOLUTION CARD (COMPACT & SCROLLABLE) */}
              <div className="group relative z-20 flex flex-1 transform flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-blue-900/20 transition-all duration-500 lg:scale-105">
                {/* Card Header */}
                <div className="z-20 flex items-center justify-between border-b border-slate-700 bg-slate-800/80 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="h-3 w-3 animate-pulse rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]"></div>
                      <div className="h-3 w-3 rounded-full bg-blue-400"></div>
                      <div className="h-3 w-3 rounded-full bg-slate-600"></div>
                    </div>
                    <span className="ml-2 text-xs font-bold tracking-wide text-blue-300 uppercase">
                      Automated System
                    </span>
                  </div>
                  <CheckCircle size={18} className="text-green-400" />
                </div>

                {/* Visualization Background (Organized) */}
                <div className="pointer-events-none absolute inset-0 z-0 opacity-10">
                  <svg
                    width="100%"
                    height="100%"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <pattern
                        id="grid"
                        width="40"
                        height="40"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 40 0 L 0 0 0 40"
                          fill="none"
                          stroke="white"
                          strokeWidth="0.5"
                        />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                  </svg>
                </div>

                {/* Scrollable Content */}
                <div className="custom-scrollbar relative z-10 flex-1 overflow-y-auto p-6 lg:p-8">
                  <div className="mb-6">
                    <h4 className="mb-2 text-2xl leading-tight font-bold text-white">
                      {data.solution.headline}
                    </h4>
                    <div className="h-1 w-12 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
                  </div>

                  <div className="space-y-4">
                    {/* Hero Stat in Solution */}
                    <div className="mb-6 flex gap-4">
                      <div className="flex-1 rounded-lg border border-white/10 bg-white/5 p-3 text-center">
                        <div className="text-xs text-slate-400 uppercase">
                          Efficiency
                        </div>
                        <div className="text-xl font-bold text-green-400">
                          +300%
                        </div>
                      </div>
                      <div className="flex-1 rounded-lg border border-white/10 bg-white/5 p-3 text-center">
                        <div className="text-xs text-slate-400 uppercase">
                          Errors
                        </div>
                        <div className="text-xl font-bold text-blue-400">
                          0%
                        </div>
                      </div>
                    </div>

                    {data.solution.differentiators.map((diff, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-900/40 to-slate-800/40 p-4 shadow-lg backdrop-blur-sm transition-colors hover:border-blue-400/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                            <diff.icon size={16} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-100">
                              {diff.text}
                            </p>
                          </div>
                          <Check size={14} className="text-green-500" />
                        </div>
                      </div>
                    ))}

                    {/* Interactive-looking elements */}
                    <div className="mt-6 flex items-center justify-between rounded-xl border border-green-500/20 bg-green-500/10 p-4">
                      <span className="flex items-center gap-2 font-mono text-xs text-green-300">
                        <span className="h-2 w-2 animate-ping rounded-full bg-green-400"></span>
                        System Optimized
                      </span>
                      <button className="rounded bg-green-500/20 px-3 py-1 text-xs text-green-300 transition-colors hover:bg-green-500/30">
                        View Logs
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Marketing features */}
        <section className="relative bg-white py-24">
          <div className="container mx-auto max-w-7xl px-4">
            <div className="mx-auto mb-20 max-w-2xl text-center">
              <p className="mb-4 text-[11px] font-semibold tracking-[0.2em] text-slate-400 uppercase">
                Capabilities
              </p>
              <h2 className="mb-4 text-[2.25rem] leading-[1.15] font-bold tracking-[-0.03em] text-slate-900 lg:text-[2.75rem]">
                Everything you need
              </h2>
              <p className="text-[17px] leading-[1.7] font-normal text-slate-500">
                Explore the powerful capabilities built into the core of{' '}
                {productName}.
              </p>
            </div>

            <div ref={container} className="pb-32">
              {data.features.map((feature, idx) => {
                return (
                  <ProductFeatureCard
                    key={idx}
                    i={idx}
                    feature={feature}
                    productId={productId}
                  />
                )
              })}
            </div>
          </div>
        </section>

        {/* 5. USE CASES TABS */}
        <section className="relative overflow-hidden bg-slate-900 py-24 text-white">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 -mt-20 -mr-20 h-[600px] w-[600px] rounded-full bg-blue-600/20 opacity-30 blur-[100px]"></div>
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 h-[500px] w-[500px] rounded-full bg-indigo-600/20 opacity-30 blur-[100px]"></div>

          <div className="relative z-10 container mx-auto px-4">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold lg:text-4xl">
                Built for Your Industry
              </h2>
              <p className="text-slate-400">
                Tailored solutions for specific business needs.
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              {data.useCases.map((useCase, idx) => (
                <div
                  key={idx}
                  className="group relative rounded-2xl border border-white/10 bg-white/5 p-8 transition-all duration-300 hover:border-white/20 hover:bg-white/10"
                >
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
                  <div className="relative z-10">
                    <h3 className="mb-4 flex items-center gap-2 text-2xl font-bold text-white transition-colors group-hover:text-blue-300">
                      {useCase.title}{' '}
                      <ChevronRight
                        size={20}
                        className="-ml-4 opacity-0 transition-all group-hover:ml-0 group-hover:opacity-100"
                      />
                    </h3>
                    <p className="mb-6 min-h-[3rem] text-slate-300">
                      {useCase.description}
                    </p>

                    <div className="space-y-3">
                      {useCase.benefits.map((b, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-sm text-slate-400"
                        >
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-500"></div>
                          {b}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. PLAN COMPARISON — pricing matrix modules or legacy marketing table */}
        <section className="bg-white py-24" id="comparison">
          <div className="container mx-auto px-4">
            <div className="mx-auto mb-16 max-w-3xl text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold tracking-wider text-blue-700 uppercase">
                <LayoutGrid size={12} /> Compare Plans
              </div>
              <h2 className="mb-6 text-3xl font-bold text-[#1B2E5A] lg:text-4xl">
                {usePricingModules ? 'Modules by plan' : 'Find the Perfect Fit'}
              </h2>
              {!usePricingModules && (
                <p className="text-lg text-slate-600">
                  Detailed breakdown of features across all plans.
                </p>
              )}
            </div>

            <div className="mx-auto max-w-6xl">
              <div className="mb-20 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] border-collapse">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10 w-1/3 border-r border-b border-slate-100 bg-slate-50/50 p-6 text-left backdrop-blur-sm">
                          <span className="text-sm font-semibold tracking-wider text-slate-400 uppercase">
                            {usePricingModules ? 'Modules' : 'Features'}
                          </span>
                        </th>
                        {usePricingModules
                          ? (
                              ['Starter', 'Professional', 'Enterprise'] as const
                            ).map((name, idx) => (
                              <th
                                key={name}
                                className={`w-1/5 border-b border-slate-100 p-6 text-center ${idx === 1 ? 'bg-blue-50/30' : 'bg-white'}`}
                              >
                                <div className="mb-1 text-xl font-bold text-[#1B2E5A]">
                                  {name}
                                </div>
                                <div className="text-xs font-medium text-slate-500">
                                  Annual plans
                                </div>
                              </th>
                            ))
                          : data.pricing.tiers.map((tier, idx) => (
                              <th
                                key={idx}
                                className={`w-1/5 border-b border-slate-100 p-6 text-center ${tier.popular ? 'bg-blue-50/30' : 'bg-white'}`}
                              >
                                <div className="mb-1 text-xl font-bold text-[#1B2E5A]">
                                  {tier.name}
                                </div>
                                <div className="text-sm font-semibold text-blue-600">
                                  Contact Us
                                </div>
                              </th>
                            ))}
                      </tr>
                    </thead>
                    <tbody>
                      {usePricingModules
                        ? moduleMatrixRows.map((row) => (
                            <tr
                              key={row.code}
                              className="group transition-colors hover:bg-slate-50"
                            >
                              <td className="sticky left-0 z-10 border-r border-b border-slate-100 bg-white p-5 font-medium text-slate-700 group-hover:bg-slate-50">
                                {row.label}
                              </td>
                              {[
                                row.starter,
                                row.professional,
                                row.enterprise,
                              ].map((included, colIdx) => (
                                <td
                                  key={colIdx}
                                  className={`border-b border-slate-100 p-5 ${colIdx === 1 ? 'bg-blue-50/10' : ''}`}
                                >
                                  {included ? (
                                    <div className="flex justify-center">
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                                        <Check size={16} strokeWidth={3} />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex justify-center">
                                      <Minus
                                        size={16}
                                        className="text-slate-300"
                                      />
                                    </div>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))
                        : legacyComparisonRows.map((row, rowIdx) => (
                            <tr
                              key={rowIdx}
                              className="group transition-colors hover:bg-slate-50"
                            >
                              <td className="sticky left-0 z-10 flex items-center gap-2 border-r border-b border-slate-100 bg-white p-5 font-medium text-slate-700 group-hover:bg-slate-50">
                                {row.name}
                                <div className="cursor-help text-slate-300 transition-colors hover:text-blue-500">
                                  <AlertCircle size={14} />
                                </div>
                              </td>
                              {data.pricing.tiers.map((tier, colIdx) => {
                                let cellContent

                                if (row.isDynamic) {
                                  const hasFeature = tier.features.includes(
                                    row.name
                                  )
                                  cellContent = hasFeature ? (
                                    <div className="flex justify-center">
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                                        <Check size={16} strokeWidth={3} />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex justify-center">
                                      <Minus
                                        size={16}
                                        className="text-slate-300"
                                      />
                                    </div>
                                  )
                                } else {
                                  const val =
                                    'values' in row && row.values
                                      ? row.values[colIdx]
                                      : false
                                  if (typeof val === 'boolean') {
                                    cellContent = val ? (
                                      <div className="flex justify-center">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                                          <Check size={16} strokeWidth={3} />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex justify-center">
                                        <Minus
                                          size={16}
                                          className="text-slate-300"
                                        />
                                      </div>
                                    )
                                  } else {
                                    cellContent = (
                                      <div className="text-center font-semibold text-slate-700">
                                        {val}
                                      </div>
                                    )
                                  }
                                }

                                return (
                                  <td
                                    key={colIdx}
                                    className={`border-b border-slate-100 p-5 ${tier.popular ? 'bg-blue-50/10' : ''}`}
                                  >
                                    {cellContent}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                      <tr>
                        <td className="sticky left-0 z-10 border-r border-slate-100 bg-white p-6"></td>
                        {usePricingModules
                          ? (
                              ['Starter', 'Professional', 'Enterprise'] as const
                            ).map((_, idx) => (
                              <td
                                key={idx}
                                className={`p-6 text-center ${idx === 1 ? 'bg-blue-50/10' : ''}`}
                              >
                                <button
                                  type="button"
                                  onClick={resolveMarketingCtaAction(
                                    'Start free trial',
                                    scrollToContact,
                                    navigate
                                  )}
                                  className={`w-full rounded-lg py-3 text-sm font-bold transition-all ${
                                    idx === 1
                                      ? 'landing-btn-primary'
                                      : 'bg-muted text-foreground hover:bg-muted/80'
                                  }`}
                                >
                                  Start free trial
                                </button>
                              </td>
                            ))
                          : data.pricing.tiers.map((tier, idx) => (
                              <td
                                key={idx}
                                className={`p-6 text-center ${tier.popular ? 'bg-blue-50/10' : ''}`}
                              >
                                <button
                                  type="button"
                                  onClick={resolveMarketingCtaAction(
                                    tier.cta,
                                    scrollToContact,
                                    navigate
                                  )}
                                  className={`w-full rounded-lg py-3 text-sm font-bold transition-all ${
                                    tier.popular
                                      ? 'landing-btn-primary'
                                      : 'bg-muted text-foreground hover:bg-muted/80'
                                  }`}
                                >
                                  {tier.cta}
                                </button>
                              </td>
                            ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {!usePricingModules && (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 lg:p-12">
                  <h3 className="mb-8 flex items-center justify-center gap-3 text-center text-2xl font-bold text-slate-800">
                    <Sparkles className="fill-amber-400 text-amber-400" />
                    Included in All Plans
                  </h3>
                  <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-4">
                    {[
                      'SSO & 2FA Security',
                      '99.9% Uptime SLA',
                      'GDPR Compliance',
                      'Daily Backups',
                      'Mobile App Access',
                      'Custom Branding',
                      'API Documentation',
                      'Community Access',
                      'Email Support',
                      'Video Tutorials',
                      'Data Export',
                      'Audit Logs',
                    ].map((feature, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 text-slate-700"
                      >
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
                          <Check size={12} strokeWidth={3} />
                        </div>
                        <span className="text-sm font-medium">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 7. TESTIMONIAL & FINAL CTA */}
        <section className="landing-section border-border bg-muted/30 border-t py-20 sm:py-24">
          <div className="container mx-auto px-4">
            <div className="border-border bg-background mx-auto max-w-3xl rounded-2xl border p-10 text-center sm:p-14">
              <h2 className="landing-display text-foreground mb-4 text-3xl font-semibold tracking-tight lg:text-4xl">
                {data.finalCTA.headline}
              </h2>
              <p className="text-muted-foreground mb-10 text-lg leading-relaxed">
                {data.finalCTA.description}
              </p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={resolveMarketingCtaAction(
                    data.finalCTA.primaryCTA,
                    scrollToContact,
                    navigate
                  )}
                  className="landing-btn-primary group inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-medium"
                >
                  {data.finalCTA.primaryCTA}
                  <ArrowRight
                    size={16}
                    strokeWidth={2.5}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </button>
                <button
                  type="button"
                  onClick={resolveMarketingCtaAction(
                    'Schedule a Demo',
                    scrollToContact,
                    navigate
                  )}
                  className="landing-text-link border-border bg-background hover:bg-muted/50 inline-flex items-center justify-center gap-2 rounded-full border px-8 py-3.5 text-sm font-medium transition-colors"
                >
                  <Calendar size={15} strokeWidth={2.25} />
                  Schedule a Demo
                </button>
              </div>
              <div className="text-muted-foreground mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle size={12} className="text-emerald-600" />
                  14-day free trial
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle size={12} className="text-emerald-600" />
                  No credit card required
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle size={12} className="text-emerald-600" />
                  Cancel anytime
                </span>
              </div>
            </div>
          </div>
        </section>
      </MarketingContentLayout>
    </>
  )
}

export default ProductPage
