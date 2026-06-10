import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'

// ─── Design tokens ────────────────────────────────────────────
const F = {
  bg: '#FFFFFF',
  bgSoft: '#F8F9FB',
  white: '#FFFFFF',
  ink: '#13204A',
  inkSoft: '#3A4674',
  muted: '#7C84A0',
  line: 'rgba(19,32,74,0.10)',
  green: '#2E9B6A',
  greenLite: '#4DC18A',
  blue: '#3D7AE8',
  red: '#D9534F',
}

const mono = "'JetBrains Mono', ui-monospace, monospace"
const serif = "'Cormorant Garamond', Georgia, serif"
const sans = "'Inter', system-ui, sans-serif"

// ─── Logo ─────────────────────────────────────────────────────
function MiniLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="30" height="30" viewBox="0 0 40 40">
        <defs>
          <linearGradient id="flg-mob" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6B5BD6" />
            <stop offset="50%" stopColor="#3D8FE8" />
            <stop offset="100%" stopColor="#3FC9A4" />
          </linearGradient>
        </defs>
        <g transform="translate(20 20)">
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i * 72 - 90) * (Math.PI / 180)
            const x = Math.cos(a) * 11
            const y = Math.sin(a) * 11
            return (
              <path
                key={i}
                d={`M0 0 Q${x * 0.6} ${y * 0.6 - 3}, ${x} ${y} Q${x * 0.4} ${y * 1.4}, 0 0 Z`}
                fill="url(#flg-mob)"
                opacity={0.85}
                transform={`rotate(${i * 72})`}
              />
            )
          })}
          <circle r="3" fill="#13204A" />
          <circle r="1.3" fill="#fff" />
        </g>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <div
          style={{
            fontFamily: sans,
            fontWeight: 800,
            fontSize: 19,
            color: F.ink,
            letterSpacing: '-0.02em',
          }}
        >
          Zopkit
        </div>
        <div
          style={{
            fontFamily: sans,
            fontWeight: 500,
            fontSize: 6.5,
            color: F.ink,
            marginTop: 2,
            border: `1px solid ${F.ink}`,
            padding: '1px 3px',
            borderRadius: 2,
            display: 'inline-flex',
            gap: 3,
          }}
        >
          <span>Grow</span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span>Scale</span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span>Thrive</span>
        </div>
      </div>
    </div>
  )
}

// ─── Top Nav ──────────────────────────────────────────────────
function TopNav({ onMenu }: { onMenu: () => void }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: '12px 14px 8px',
        background: F.bg,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.65)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(19,32,74,0.07)',
          borderRadius: 999,
          padding: '7px 8px 7px 14px',
          boxShadow: '0 1px 2px rgba(19,32,74,0.05)',
        }}
      >
        <MiniLogo />
        <button
          onClick={onMenu}
          style={{
            width: 36,
            height: 36,
            borderRadius: 99,
            background: F.ink,
            border: 'none',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
            <path
              d="M1 1h14M1 5.5h14M1 10h14"
              stroke="#fff"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── Menu Overlay ─────────────────────────────────────────────
function Menu({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean
  onClose: () => void
  onNavigate: (to: string) => void
}) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        background: F.bg,
        display: 'flex',
        flexDirection: 'column',
        padding: '14px 14px 24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <MiniLogo />
        <button
          onClick={onClose}
          style={{
            width: 36,
            height: 36,
            borderRadius: 99,
            background: F.ink,
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontFamily: sans,
            fontSize: 18,
          }}
        >
          ×
        </button>
      </div>
      <div
        style={{
          marginTop: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {[
          { label: 'Products', to: '/landing' },
          { label: 'Industries', to: '/landing' },
          { label: 'Pricing', to: '/pricing' },
          { label: 'Contact Us', to: '/landing' },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => {
              onClose()
              onNavigate(item.to)
            }}
            style={
              {
                padding: '18px 4px',
                fontFamily: serif,
                fontStyle: 'italic',
                fontSize: 34,
                color: F.ink,
                textDecoration: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                borderBottom: `1px solid ${F.line}`,
                cursor: 'pointer',
                width: '100%',
              } as React.CSSProperties
            }
          >
            {item.label}
            <span style={{ fontSize: 20, opacity: 0.4 }}>→</span>
          </button>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <button
        onClick={() => {
          onClose()
          onNavigate('/onboarding')
        }}
        style={{
          padding: '16px',
          background: F.ink,
          color: '#fff',
          borderRadius: 999,
          border: 'none',
          fontFamily: sans,
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Sign In
      </button>
    </div>
  )
}

// ─── Hero Section (Video + Desktop Projector Puck) ────────────
function HeroSection() {
  return (
    <div style={{ position: 'relative', padding: '20px 14px 0' }}>
      {/* CSS animations for projector puck — injected once */}
      <style>{`
                @keyframes mob-ppFloat   { 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-5px) } }
                @keyframes mob-ppLensGlow { 0%,100%{ opacity:0.65 } 50%{ opacity:1 } }
                @keyframes mob-ppHotspot { 0%,100%{ opacity:0.9;transform:scale(1) } 50%{ opacity:1;transform:scale(1.22) } }
                @keyframes mob-ppRingOut  { 0%{ transform:scale(0.5);opacity:0.75 } 100%{ transform:scale(3.8);opacity:0 } }
                @keyframes mob-beamUp {
                    0%{ opacity:0; transform:translateX(-50%) scaleY(0) }
                    20%{ opacity:1 }
                    100%{ opacity:0; transform:translateX(-50%) scaleY(1) }
                }
                .mob-pp-float  { animation: mob-ppFloat    5.5s ease-in-out infinite; will-change: transform; }
                .mob-pp-lens   { animation: mob-ppLensGlow 2.8s ease-in-out infinite; will-change: opacity; box-shadow: 0 0 0 3px rgba(46,79,140,0.85), 0 0 44px 10px rgba(36,59,110,0.55), 0 0 90px 20px rgba(27,46,90,0.3); }
                .mob-pp-hotspot{ animation: mob-ppHotspot  2.8s ease-in-out infinite; will-change: opacity, transform; }
                .mob-pp-ring1  { animation: mob-ppRingOut  2.8s ease-out infinite; will-change: transform, opacity; }
                .mob-pp-ring2  { animation: mob-ppRingOut  2.8s ease-out 1.4s infinite; will-change: transform, opacity; }
                .mob-beam      { animation: mob-beamUp 1s cubic-bezier(0.16,1,0.3,1) forwards; transform-origin: bottom center; }
                @media (prefers-reduced-motion: reduce) { .mob-pp-float,.mob-pp-lens,.mob-pp-hotspot,.mob-pp-ring1,.mob-pp-ring2 { animation: none !important; } }
                /* Hide all scrollbars */
                *::-webkit-scrollbar { display: none !important; }
                * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
            `}</style>

      {/* Monitor bezel — thin rim, maximum video */}
      <div
        style={{
          position: 'relative',
          background:
            'linear-gradient(175deg, #1c2035 0%, #0e1120 50%, #090c18 100%)',
          borderRadius: 18,
          padding: 3,
          boxShadow:
            '0 30px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.07)',
        }}
      >
        {/* Minimal top chrome strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 10px',
            height: 22,
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#FF6058',
            }}
          />
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#FFBD2E',
            }}
          />
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#28C940',
            }}
          />
        </div>

        {/* Video screen — fills almost all space */}
        <div style={{ borderRadius: 14, overflow: 'hidden' }}>
          <video
            src="/videos/fa-product-showcase.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/fa-dashboard.svg"
            style={{
              width: '100%',
              display: 'block',
              aspectRatio: '16/10',
              objectFit: 'cover',
            }}
            aria-label="Financial Accounting product showcase"
          />
        </div>
      </div>

      {/* Projector puck + beam — identical to desktop */}
      <div
        style={{
          position: 'relative',
          marginTop: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Volumetric beam */}
        <div
          className="mob-beam"
          style={{
            position: 'absolute',
            bottom: 50,
            left: '50%',
            transform: 'translateX(-50%) scaleY(0)',
            width: 150,
            height: 180,
            background:
              'linear-gradient(to top, rgba(46,79,140,0.60) 0%, rgba(60,100,200,0.28) 35%, transparent 100%)',
            filter: 'blur(12px)',
            pointerEvents: 'none',
            borderRadius: '50% 50% 0 0',
          }}
        />

        {/* 3-D Cylindrical Puck */}
        <div
          className="mob-pp-float"
          style={{
            position: 'relative',
            width: 160,
            height: 62,
            flexShrink: 0,
            filter:
              'drop-shadow(0 14px 22px rgba(0,0,0,0.55)) drop-shadow(0 0 38px rgba(27,46,90,0.45))',
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
                'inset 7px 0 22px rgba(255,255,255,0.045),inset -7px 0 22px rgba(0,0,0,0.45),inset 0 -12px 28px rgba(0,0,0,0.75)',
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
                'inset 0 9px 22px rgba(255,255,255,0.055),inset 0 -5px 14px rgba(0,0,0,0.65),0 7px 22px rgba(0,0,0,0.65)',
            }}
          >
            {/* Outer groove */}
            <div
              style={{
                position: 'absolute',
                top: '7%',
                left: '7%',
                right: '7%',
                bottom: '7%',
                borderRadius: '50%',
                boxShadow:
                  'inset 0 0 0 1.5px rgba(255,255,255,0.055),inset 0 0 10px rgba(0,0,0,0.6)',
              }}
            />
            {/* Middle recess */}
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
                boxShadow: 'inset 0 5px 14px rgba(0,0,0,0.95)',
              }}
            />
            {/* Glow ring */}
            <div
              className="mob-pp-lens"
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
            {/* Pulse rings */}
            <div
              className="mob-pp-ring1"
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
              className="mob-pp-ring2"
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
            {/* Lens bowl */}
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
                boxShadow: 'inset 0 0 12px rgba(0,0,0,0.75)',
              }}
            />
            {/* Hot-spot */}
            <div
              className="mob-pp-hotspot"
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
              filter: 'blur(12px)',
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Anchor Stats ─────────────────────────────────────────────
// ─── Shift Section ────────────────────────────────────────────
function ShiftSection() {
  const pains = [
    'Manual journal entries and bookkeeping',
    'Time-consuming bank reconciliations',
    'GST/TDS errors that surface only at filing time',
    'No single cash position across bank accounts',
    'Separate books per entity with no consolidation',
  ]
  const gains = [
    'Complete Accounting: GL, AP, AR, banking, assets & costs',
    'Bank Reconciliation: Rule-based matching, statement import',
    'Financial Reports: P&L, balance sheet, cash flow, custom',
    'Tax Compliance: GST returns, TDS, e-invoicing built-in',
    'Multi-Entity: Independent books with group consolidation',
  ]

  return (
    <div style={{ padding: '48px 0 32px', background: F.bg }}>
      <div style={{ textAlign: 'center', padding: '0 22px' }}>
        <div
          style={{
            fontFamily: mono,
            fontSize: 11,
            color: F.blue,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          The Evolution
        </div>
        <h2
          style={{
            fontFamily: sans,
            fontWeight: 800,
            fontSize: 32,
            color: F.ink,
            margin: '12px 0 10px',
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
          }}
        >
          The Shift in Perspective
        </h2>
        <p
          style={{
            fontFamily: sans,
            fontSize: 14,
            color: F.inkSoft,
            margin: 0,
            lineHeight: 1.55,
          }}
        >
          See how Financial Accounting changes the game by bringing order to
          chaos.
        </p>
      </div>

      {/* Manual card */}
      <div
        style={{
          margin: '28px 14px 0',
          borderRadius: 16,
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #FFF6F4 0%, #FFFFFF 100%)',
          border: '1px solid rgba(217,83,79,0.18)',
          position: 'relative',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255,224,217,0.4)',
            borderBottom: '1px solid rgba(217,83,79,0.10)',
          }}
        >
          <div
            style={{
              fontFamily: mono,
              fontSize: 11,
              color: F.red,
              letterSpacing: '0.18em',
              fontWeight: 700,
            }}
          >
            MANUAL WORKFLOW
          </div>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 99,
              background: 'rgba(217,83,79,0.10)',
              color: F.red,
              display: 'grid',
              placeItems: 'center',
              fontSize: 14,
            }}
          >
            ×
          </div>
        </div>
        <div style={{ padding: '20px 16px 22px' }}>
          <h3
            style={{
              fontFamily: sans,
              fontWeight: 800,
              fontSize: 22,
              color: F.ink,
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Struggling with Manual Accounting?
          </h3>
          <div
            style={{
              height: 3,
              width: 40,
              marginTop: 10,
              background: F.red,
              borderRadius: 2,
            }}
          />
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '18px 0 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {pains.map((p, i) => (
              <li
                key={i}
                style={{
                  background: '#fff',
                  border: '1px solid rgba(217,83,79,0.10)',
                  borderRadius: 10,
                  padding: '12px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 99,
                    background: 'rgba(217,83,79,0.10)',
                    color: F.red,
                    fontSize: 12,
                    display: 'grid',
                    placeItems: 'center',
                    flex: '0 0 22px',
                  }}
                >
                  ×
                </span>
                <span
                  style={{
                    fontFamily: sans,
                    fontSize: 13,
                    color: F.ink,
                    lineHeight: 1.4,
                  }}
                >
                  {p}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Automated card */}
      <div
        style={{
          margin: '14px 14px 0',
          borderRadius: 16,
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #0B1430 0%, #060A1B 100%)',
          border: '1px solid rgba(77,193,138,0.30)',
          position: 'relative',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(77,193,138,0.06)',
            borderBottom: '1px solid rgba(77,193,138,0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 99,
                background: '#4DC18A',
              }}
            />
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 99,
                background: '#FFBD2E',
              }}
            />
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 99,
                background: '#3D7AE8',
              }}
            />
            <div
              style={{
                fontFamily: mono,
                fontSize: 11,
                color: 'rgba(255,255,255,0.7)',
                letterSpacing: '0.18em',
                fontWeight: 700,
                marginLeft: 6,
              }}
            >
              AUTOMATED SYSTEM
            </div>
          </div>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 99,
              background: 'rgba(77,193,138,0.18)',
              color: '#4DC18A',
              display: 'grid',
              placeItems: 'center',
              fontSize: 13,
            }}
          >
            ✓
          </div>
        </div>
        <div style={{ padding: '20px 16px 22px' }}>
          <h3
            style={{
              fontFamily: sans,
              fontWeight: 800,
              fontSize: 22,
              color: '#fff',
              margin: 0,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}
          >
            One Ledger. Every Module. Always Audit-Ready.
          </h3>
          <div
            style={{
              height: 3,
              width: 40,
              marginTop: 10,
              background: F.blue,
              borderRadius: 2,
            }}
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 9,
              marginTop: 18,
            }}
          >
            {[
              { l: 'EFFICIENCY', v: '+300%' },
              { l: 'ERRORS', v: '0%' },
            ].map((item) => (
              <div
                key={item.l}
                style={{
                  padding: '14px 12px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: mono,
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.5)',
                    letterSpacing: '0.14em',
                  }}
                >
                  {item.l}
                </div>
                <div
                  style={{
                    fontFamily: sans,
                    fontSize: 24,
                    fontWeight: 800,
                    color: '#4DC18A',
                    marginTop: 4,
                  }}
                >
                  {item.v}
                </div>
              </div>
            ))}
          </div>

          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '14px 0 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {gains.map((g, i) => (
              <li
                key={i}
                style={{
                  background: 'rgba(61,122,232,0.10)',
                  border: '1px solid rgba(61,122,232,0.20)',
                  borderRadius: 10,
                  padding: '11px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 5,
                    background: 'rgba(61,122,232,0.20)',
                    color: '#9CC0F7',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 12,
                    flex: '0 0 22px',
                    fontFamily: mono,
                  }}
                >
                  ▦
                </span>
                <span
                  style={{
                    fontFamily: sans,
                    fontSize: 12.5,
                    color: 'rgba(255,255,255,0.85)',
                    lineHeight: 1.4,
                    flex: 1,
                  }}
                >
                  {g}
                </span>
                <span
                  style={{ color: '#4DC18A', fontSize: 13, flex: '0 0 14px' }}
                >
                  ✓
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard Mock Primitives ────────────────────────────────
function WinMock({
  children,
  url = 'app.zopkit.com/dashboard',
  full,
}: {
  children: React.ReactNode
  url?: string
  full?: boolean
}) {
  const dotSz = full ? 14 : 8
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: full ? 14 : 10,
        overflow: 'hidden',
        boxShadow:
          '0 20px 40px -12px rgba(19,32,74,0.20), 0 0 0 1px rgba(19,32,74,0.04)',
      }}
    >
      {/* Chrome bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: full ? 7 : 5,
          padding: full ? '12px 16px' : '8px 9px',
          background: '#F4F1EB',
          borderBottom: `1px solid ${F.line}`,
        }}
      >
        <span
          style={{
            width: dotSz,
            height: dotSz,
            borderRadius: 99,
            background: '#FF6058',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            width: dotSz,
            height: dotSz,
            borderRadius: 99,
            background: '#FFBD2E',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            width: dotSz,
            height: dotSz,
            borderRadius: 99,
            background: '#28C940',
            flexShrink: 0,
          }}
        />
        <div
          style={{
            flex: 1,
            marginLeft: full ? 10 : 6,
            height: full ? 24 : 16,
            borderRadius: full ? 5 : 3,
            background: '#E6E1D6',
            display: 'grid',
            placeItems: 'center',
            fontFamily: mono,
            fontSize: full ? 11 : 8,
            color: F.muted,
          }}
        >
          {url}
        </div>
      </div>
      {/* Body */}
      <div style={{ display: 'flex' }}>
        {full ? (
          /* Full-size sidebar — matches desktop design */
          <div
            style={{
              width: 48,
              background: '#0B1430',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '12px 0 12px',
              flexShrink: 0,
            }}
          >
            {/* Active nav item — blue square with grid icon */}
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                background: '#3D7AE8',
                display: 'grid',
                placeItems: 'center',
                marginBottom: 14,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="2" width="6" height="6" rx="1.5" fill="white" />
                <rect
                  x="10"
                  y="2"
                  width="6"
                  height="6"
                  rx="1.5"
                  fill="rgba(255,255,255,0.45)"
                />
                <rect
                  x="2"
                  y="10"
                  width="6"
                  height="6"
                  rx="1.5"
                  fill="rgba(255,255,255,0.45)"
                />
                <rect
                  x="10"
                  y="10"
                  width="6"
                  height="6"
                  rx="1.5"
                  fill="rgba(255,255,255,0.25)"
                />
              </svg>
            </div>
            {/* Other nav items */}
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 26,
                  height: 3,
                  borderRadius: 2,
                  background: 'rgba(255,255,255,0.16)',
                  marginBottom: 8,
                }}
              />
            ))}
            <div style={{ flex: 1 }} />
            {/* User circle */}
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 99,
                background: 'rgba(255,255,255,0.12)',
              }}
            />
          </div>
        ) : (
          /* Compact preview sidebar */
          <div
            style={{
              width: 14,
              padding: '10px 3px',
              background: '#0B1430',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 1,
                  background: i === 0 ? '#3D7AE8' : 'rgba(255,255,255,0.18)',
                }}
              />
            ))}
          </div>
        )}
        <div
          style={{
            flex: 1,
            padding: full ? '12px 14px 16px' : '10px 10px 12px',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function MockHeader({
  title,
  sub,
  cta,
  full,
}: {
  title: string
  sub?: string
  cta?: string
  full?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: sans,
            fontWeight: 700,
            fontSize: full ? 22 : 12,
            color: F.ink,
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
        {sub && (
          <div
            style={{
              fontFamily: sans,
              fontSize: full ? 12 : 9.5,
              color: F.muted,
              marginTop: full ? 3 : 1,
              lineHeight: 1.3,
            }}
          >
            {sub}
          </div>
        )}
      </div>
      {cta && (
        <div
          style={{
            background: F.ink,
            color: '#fff',
            padding: full ? '10px 18px' : '5px 8px',
            borderRadius: full ? 7 : 4,
            fontFamily: sans,
            fontSize: full ? 13 : 9,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            flex: '0 0 auto',
          }}
        >
          {cta}
        </div>
      )}
    </div>
  )
}

interface KPIItem {
  l: string
  v: string
  s?: string
  sc?: string
}
function KPIRow({ items, full }: { items: KPIItem[]; full?: boolean }) {
  const cols = full && items.length === 4 ? 2 : items.length
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: full ? 10 : 5,
        marginTop: full ? 16 : 8,
      }}
    >
      {items.map((k, i) => (
        <div
          key={i}
          style={{
            padding: full ? '14px 16px' : '6px 7px',
            borderRadius: full ? 8 : 5,
            background: F.bgSoft,
            border: `1px solid ${F.line}`,
          }}
        >
          <div
            style={{
              fontFamily: mono,
              fontSize: full ? 10 : 6,
              color: F.muted,
              letterSpacing: '0.06em',
            }}
          >
            {k.l}
          </div>
          <div
            style={{
              fontFamily: sans,
              fontWeight: 700,
              fontSize: full ? 22 : 9,
              color: F.ink,
              marginTop: full ? 5 : 2,
              lineHeight: 1,
            }}
          >
            {k.v}
          </div>
          {k.s && (
            <div
              style={{
                fontFamily: sans,
                fontSize: full ? 11 : 6.5,
                color: k.sc || F.muted,
                marginTop: full ? 3 : 1,
              }}
            >
              {k.s}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

type CellVal = string | { t: string; mono?: boolean; b?: boolean; c?: string }
interface ColDef {
  h: string
  w?: string
  a?: 'left' | 'right' | 'center'
}
function TableMock({
  cols,
  rows,
  full,
}: {
  cols: ColDef[]
  rows: CellVal[][]
  full?: boolean
}) {
  const tpl = cols.map((c) => c.w || '1fr').join(' ')
  const gap = full ? 12 : 5
  const hFs = full ? 11 : 5.5
  const rFs = full ? 13 : 7.5
  const inner = (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: tpl,
          gap,
          padding: full ? '8px 4px' : '4px 2px',
          fontFamily: mono,
          fontSize: hFs,
          color: F.muted,
          letterSpacing: '0.06em',
          borderBottom: `1px solid ${F.line}`,
        }}
      >
        {cols.map((c, i) => (
          <span key={i} style={{ textAlign: c.a || 'left' }}>
            {c.h}
          </span>
        ))}
      </div>
      {rows.map((r, ri) => (
        <div
          key={ri}
          style={{
            display: 'grid',
            gridTemplateColumns: tpl,
            gap,
            padding: full ? '12px 4px' : '5px 2px',
            fontFamily: sans,
            fontSize: rFs,
            color: F.ink,
            borderBottom: ri < rows.length - 1 ? `1px solid ${F.line}` : 'none',
            alignItems: 'center',
          }}
        >
          {r.map((cell, ci) => {
            return (
              <span
                key={ci}
                style={{
                  textAlign: cols[ci].a || 'left',
                  fontFamily:
                    typeof cell === 'object' && cell.mono ? mono : sans,
                  fontWeight: typeof cell === 'object' && cell.b ? 600 : 400,
                  color: typeof cell === 'object' && cell.c ? cell.c : F.ink,
                }}
              >
                {typeof cell === 'object' ? cell.t : cell}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
  return (
    <div style={{ marginTop: full ? 16 : 9, overflowX: 'hidden' }}>{inner}</div>
  )
}

// ─── Feature Dashboard Mocks ──────────────────────────────────
function GLMock({ full }: { full?: boolean }) {
  const cols: ColDef[] = full
    ? [
        { h: 'DATE', w: '0.7fr' },
        { h: 'ENTRY #', w: '0.9fr' },
        { h: 'ACCOUNT', w: '1fr' },
        { h: 'DESCRIPTION', w: '1.4fr' },
        { h: 'DEBIT', w: '0.9fr', a: 'right' },
        { h: 'CREDIT', w: '0.9fr', a: 'right' },
        { h: 'BALANCE', w: '0.9fr', a: 'right' },
      ]
    : [
        { h: 'DATE', w: '0.7fr' },
        { h: 'ENTRY #', w: '0.9fr' },
        { h: 'ACCOUNT', w: '1.1fr' },
        { h: 'DEBIT', w: '0.9fr', a: 'right' },
        { h: 'CREDIT', w: '0.9fr', a: 'right' },
        { h: 'BALANCE', w: '0.9fr', a: 'right' },
      ]
  const rows: CellVal[][] = full
    ? [
        [
          'Apr 26',
          { mono: true, b: true, c: F.blue, t: 'JE-0142' },
          '1100 Cash',
          'Customer receipt',
          { mono: true, t: '₹1,20,000' },
          '—',
          { mono: true, c: F.green, b: true, t: '₹50,10,000' },
        ],
        [
          'Apr 25',
          { mono: true, b: true, c: F.blue, t: 'JE-0141' },
          '4000 Revenue',
          'Sales invoice INV-22',
          '—',
          { mono: true, t: '₹3,40,000' },
          { mono: true, c: F.green, b: true, t: '₹48,90,000' },
        ],
        [
          'Apr 25',
          { mono: true, b: true, c: F.blue, t: 'JE-0140' },
          '2100 AP',
          'Vendor bill BL-7820',
          '—',
          { mono: true, t: '₹80,000' },
          { mono: true, c: F.green, b: true, t: '₹48,10,000' },
        ],
        [
          'Apr 24',
          { mono: true, b: true, c: F.blue, t: 'JE-0139' },
          '6000 Salaries',
          'April payroll',
          { mono: true, t: '₹2,10,000' },
          '—',
          { mono: true, c: F.green, b: true, t: '₹50,20,000' },
        ],
        [
          'Apr 24',
          { mono: true, b: true, c: F.blue, t: 'JE-0138' },
          '3000 Capital',
          'Owner contribution',
          '—',
          { mono: true, t: '₹5,00,000' },
          { mono: true, c: F.green, b: true, t: '₹55,20,000' },
        ],
      ]
    : [
        [
          'Apr 26',
          { mono: true, b: true, c: F.blue, t: 'JE-0142' },
          '1100 Cash',
          { mono: true, t: '₹1,20,000' },
          '—',
          { mono: true, c: F.green, b: true, t: '₹50,10,000' },
        ],
        [
          'Apr 25',
          { mono: true, b: true, c: F.blue, t: 'JE-0141' },
          '4000 Revenue',
          '—',
          { mono: true, t: '₹3,40,000' },
          { mono: true, c: F.green, b: true, t: '₹48,90,000' },
        ],
        [
          'Apr 25',
          { mono: true, b: true, c: F.blue, t: 'JE-0140' },
          '2100 AP',
          '—',
          { mono: true, t: '₹80,000' },
          { mono: true, c: F.green, b: true, t: '₹48,10,000' },
        ],
        [
          'Apr 24',
          { mono: true, b: true, c: F.blue, t: 'JE-0139' },
          '6000 Salaries',
          { mono: true, t: '₹2,10,000' },
          '—',
          { mono: true, c: F.green, b: true, t: '₹50,20,000' },
        ],
      ]
  return (
    <WinMock full={full}>
      <MockHeader
        title="General Ledger"
        sub="0 entries · Complete transaction history with running balances"
        cta="+ New JV"
        full={full}
      />
      <KPIRow
        full={full}
        items={[
          { l: 'TOTAL ENTRIES', v: '0', s: 'No entries yet' },
          { l: 'TOTAL DEBITS', v: '₹2,84,50,000', s: 'Current period' },
          { l: 'TOTAL CREDITS', v: '₹2,84,50,000', s: 'Current period' },
          { l: 'PERIOD BALANCE', v: '₹0', s: '✓ Balanced', sc: F.green },
        ]}
      />
      <TableMock cols={cols} rows={rows} full={full} />
      <div
        style={{
          marginTop: full ? 14 : 8,
          padding: full ? '10px 14px' : '6px 8px',
          borderRadius: full ? 6 : 4,
          background: 'rgba(77,193,138,0.10)',
          border: '1px solid rgba(77,193,138,0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: sans,
          fontSize: full ? 12 : 8.5,
          color: F.green,
          fontWeight: 600,
        }}
      >
        <span>Trial Balance Reconciled ✓</span>
        <span style={{ color: F.muted, fontWeight: 400 }}>
          Debits = Credits · Apr 2026
        </span>
      </div>
    </WinMock>
  )
}

function EntityMock({ full }: { full?: boolean }) {
  if (full) {
    const subsidiaries = [
      { code: 'IN-Subsidiary', sub: 'TCS India' },
      { code: 'US-Subsidiary', sub: 'Acme LLC' },
      { code: 'SG-Subsidiary', sub: 'Acme Pte' },
    ]
    const registry: CellVal[][] = [
      [
        { mono: true, b: true, t: 'GRP-HQ' },
        'Group HoldCo Ltd',
        'Parent',
        'INR',
        'India',
        { c: F.green, b: true, t: '● Active' },
      ],
      [
        { mono: true, b: true, t: 'TCS-IN' },
        'TCS India Ltd',
        'Subsidiary',
        'INR',
        'India',
        { c: F.green, b: true, t: '● Active' },
      ],
      [
        { mono: true, b: true, t: 'AcmeUS-LLC' },
        'Acme US LLC',
        'Subsidiary',
        'USD',
        'US',
        { c: F.green, b: true, t: '● Active' },
      ],
      [
        { mono: true, b: true, t: 'AcmeSG-Pte' },
        'Acme SG Pte',
        'Subsidiary',
        'SGD',
        'SG',
        { c: F.green, b: true, t: '● Active' },
      ],
      [
        { mono: true, b: true, t: 'AcmeUK-Ltd' },
        'Acme UK Ltd',
        'Associate',
        'GBP',
        'UK',
        { c: F.muted, t: '● Inactive' },
      ],
    ]
    return (
      <WinMock full>
        <MockHeader
          title="Entity Management"
          sub="Manage your group structure and consolidations"
          cta="+ Add Entity"
          full
        />
        <KPIRow
          full
          items={[
            { l: 'TOTAL ENTITIES', v: '6', s: 'All registered' },
            { l: 'ACTIVE', v: '6', s: 'Currently running' },
            { l: 'SUBSIDIARIES', v: '4', s: 'Under group' },
            { l: 'COUNTRIES', v: '3', s: 'IN · US · SG' },
          ]}
        />

        {/* Two panels stacked vertically on mobile */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginTop: 16,
          }}
        >
          {/* ── Group Structure panel ── */}
          <div
            style={{
              borderRadius: 10,
              border: `1px solid ${F.line}`,
              background: F.bgSoft,
              padding: '16px 16px 14px',
            }}
          >
            <div
              style={{
                fontFamily: sans,
                fontWeight: 700,
                fontSize: 15,
                color: F.ink,
                marginBottom: 18,
              }}
            >
              Group Structure
            </div>

            {/* Org tree */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  background: F.ink,
                  color: '#fff',
                  padding: '10px 28px',
                  borderRadius: 7,
                  fontFamily: sans,
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                Group HoldCo
              </div>

              {/* SVG connector lines */}
              <svg
                width="100%"
                height="42"
                style={{ display: 'block', overflow: 'visible' }}
                preserveAspectRatio="none"
              >
                <line
                  x1="50%"
                  y1="0"
                  x2="50%"
                  y2="18"
                  stroke={F.line}
                  strokeWidth="1.5"
                />
                <line
                  x1="16.5%"
                  y1="18"
                  x2="83.5%"
                  y2="18"
                  stroke={F.line}
                  strokeWidth="1.5"
                />
                <line
                  x1="16.5%"
                  y1="18"
                  x2="16.5%"
                  y2="42"
                  stroke={F.line}
                  strokeWidth="1.5"
                />
                <line
                  x1="50%"
                  y1="18"
                  x2="50%"
                  y2="42"
                  stroke={F.line}
                  strokeWidth="1.5"
                />
                <line
                  x1="83.5%"
                  y1="18"
                  x2="83.5%"
                  y2="42"
                  stroke={F.line}
                  strokeWidth="1.5"
                />
              </svg>

              {/* Children */}
              <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                {subsidiaries.map((s) => (
                  <div
                    key={s.code}
                    style={{
                      flex: 1,
                      border: '1px solid rgba(61,122,232,0.28)',
                      background: 'rgba(61,122,232,0.06)',
                      borderRadius: 7,
                      padding: '9px 6px',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: sans,
                        fontSize: 12,
                        fontWeight: 700,
                        color: F.ink,
                      }}
                    >
                      {s.code}
                    </div>
                    <div
                      style={{
                        fontFamily: sans,
                        fontSize: 10.5,
                        color: F.muted,
                        marginTop: 3,
                      }}
                    >
                      {s.sub}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div
              style={{
                marginTop: 14,
                padding: '8px 12px',
                borderRadius: 6,
                background: 'rgba(61,122,232,0.08)',
                fontFamily: sans,
                fontSize: 12,
                color: F.blue,
              }}
            >
              Equity method · Full consolidation
            </div>
            <div
              style={{
                marginTop: 8,
                fontFamily: sans,
                fontSize: 12,
                color: F.inkSoft,
                padding: '2px 4px',
              }}
            >
              Intercompany eliminations: 3 active
            </div>
            <div
              style={{
                marginTop: 8,
                padding: '8px 12px',
                borderRadius: 6,
                background: 'rgba(77,193,138,0.10)',
                fontFamily: sans,
                fontSize: 12,
                color: F.green,
                fontWeight: 600,
              }}
            >
              Dec 2025 consolidation: complete ✓
            </div>
          </div>

          {/* ── Entity Registry panel ── */}
          <div
            style={{
              borderRadius: 10,
              border: `1px solid ${F.line}`,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '13px 16px',
                fontFamily: sans,
                fontWeight: 700,
                fontSize: 15,
                color: F.ink,
                borderBottom: `1px solid ${F.line}`,
                background: '#fff',
              }}
            >
              Entity Registry
            </div>
            <TableMock
              full
              cols={[
                { h: 'CODE', w: '100px' },
                { h: 'ENTITY NAME', w: '140px' },
                { h: 'TYPE', w: '90px' },
                { h: 'CURRENCY', w: '80px' },
                { h: 'COUNTRY', w: '65px' },
                { h: 'STATUS', w: '90px', a: 'right' },
              ]}
              rows={registry}
            />
          </div>
        </div>
      </WinMock>
    )
  }

  // ── Compact preview mode ──
  return (
    <WinMock>
      <MockHeader
        title="Entity Management"
        sub="Manage your group structure and consolidations"
        cta="+ Add Entity"
      />
      <KPIRow
        items={[
          { l: 'TOTAL ENTITIES', v: '6', s: 'All registered' },
          { l: 'ACTIVE', v: '6', s: 'Currently running' },
          { l: 'SUBSIDIARIES', v: '4', s: 'Under group' },
          { l: 'COUNTRIES', v: '3', s: 'IN · US · SG' },
        ]}
      />
      <div
        style={{
          marginTop: 9,
          padding: 8,
          borderRadius: 5,
          background: F.bgSoft,
          border: `1px solid ${F.line}`,
        }}
      >
        <div
          style={{
            fontFamily: sans,
            fontWeight: 700,
            fontSize: 10,
            color: F.ink,
          }}
        >
          Group Structure
        </div>
        <div
          style={{
            marginTop: 6,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <div
            style={{
              background: F.ink,
              color: '#fff',
              padding: '4px 12px',
              borderRadius: 4,
              fontFamily: sans,
              fontSize: 9,
              fontWeight: 600,
            }}
          >
            Group HoldCo
          </div>
          <div style={{ width: 1, height: 8, background: F.line }} />
          <div
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {['IN', 'US', 'SG'].map((c) => (
              <div
                key={c}
                style={{
                  border: '1px solid rgba(61,122,232,0.3)',
                  background: 'rgba(61,122,232,0.08)',
                  borderRadius: 4,
                  padding: '4px 6px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: sans,
                    fontSize: 7,
                    fontWeight: 600,
                    color: F.ink,
                  }}
                >
                  {c}-Subsidiary
                </div>
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            marginTop: 8,
            padding: '4px 6px',
            borderRadius: 3,
            background: 'rgba(77,193,138,0.12)',
            fontFamily: sans,
            fontSize: 8,
            color: F.green,
            fontWeight: 600,
          }}
        >
          Dec 2025 consolidation: complete ✓
        </div>
      </div>
      <TableMock
        cols={[
          { h: 'CODE', w: '0.8fr' },
          { h: 'ENTITY', w: '1.4fr' },
          { h: 'TYPE', w: '1fr' },
          { h: 'CUR', w: '0.6fr' },
          { h: 'STATUS', w: '0.9fr', a: 'right' },
        ]}
        rows={[
          [
            { mono: true, b: true, t: 'GRP-HQ' },
            'Group HoldCo Ltd',
            'Parent',
            'INR',
            { c: F.green, b: true, t: 'Active' },
          ],
          [
            { mono: true, b: true, t: 'TCS-IN' },
            'TCS India Ltd',
            'Subsidiary',
            'INR',
            { c: F.green, b: true, t: 'Active' },
          ],
          [
            { mono: true, b: true, t: 'AcmeUS' },
            'Acme US LLC',
            'Subsidiary',
            'USD',
            { c: F.green, b: true, t: 'Active' },
          ],
        ]}
      />
    </WinMock>
  )
}

function FXMock({ full }: { full?: boolean }) {
  const rates = [
    { c: 'USD', v: '83.45 ₹', d: '+0.12%', dn: false },
    { c: 'EUR', v: '89.12 ₹', d: '−0.04%', dn: true },
    { c: 'SGD', v: '61.78 ₹', d: '+0.21%', dn: false },
  ]
  return (
    <WinMock full={full}>
      <MockHeader
        title="Multi-Currency"
        sub="Currency settings and FX rate management"
        full={full}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: full ? 10 : 6,
          marginTop: full ? 14 : 8,
        }}
      >
        <div
          style={{
            padding: full ? '12px 14px' : '7px 8px',
            borderRadius: full ? 8 : 5,
            background: 'rgba(61,122,232,0.08)',
            border: '1px solid rgba(61,122,232,0.20)',
          }}
        >
          <div
            style={{
              fontFamily: mono,
              fontSize: full ? 10 : 6.5,
              color: F.blue,
              letterSpacing: '0.06em',
            }}
          >
            FUNCTIONAL CURRENCY
          </div>
          <div
            style={{
              fontFamily: sans,
              fontSize: full ? 14 : 9.5,
              fontWeight: 700,
              color: F.ink,
              marginTop: full ? 4 : 1,
            }}
          >
            ₹ INR — Indian Rupee
          </div>
        </div>
        <div
          style={{
            padding: full ? '12px 14px' : '7px 8px',
            borderRadius: full ? 8 : 5,
            background: F.bgSoft,
            border: `1px solid ${F.line}`,
          }}
        >
          <div
            style={{
              fontFamily: mono,
              fontSize: full ? 10 : 6.5,
              color: F.muted,
              letterSpacing: '0.06em',
            }}
          >
            RATE SOURCE
          </div>
          <div
            style={{
              fontFamily: sans,
              fontSize: full ? 13 : 9,
              fontWeight: 600,
              color: F.ink,
              marginTop: full ? 4 : 1,
            }}
          >
            RBI Reference Rate
          </div>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3,1fr)',
          gap: full ? 10 : 5,
          marginTop: full ? 10 : 7,
        }}
      >
        {rates.map((x) => (
          <div
            key={x.c}
            style={{
              padding: full ? '12px 14px' : '6px 7px',
              borderRadius: full ? 8 : 5,
              background: F.bgSoft,
              border: `1px solid ${F.line}`,
            }}
          >
            <div
              style={{
                fontFamily: sans,
                fontWeight: 700,
                fontSize: full ? 13 : 8.5,
                color: F.inkSoft,
              }}
            >
              {x.c}
            </div>
            <div
              style={{
                fontFamily: sans,
                fontWeight: 800,
                fontSize: full ? 18 : 10,
                color: F.ink,
                marginTop: full ? 4 : 1,
              }}
            >
              {x.v}
            </div>
            <div
              style={{
                fontFamily: sans,
                fontSize: full ? 11 : 7,
                color: x.dn ? F.red : F.green,
              }}
            >
              {x.d}
            </div>
          </div>
        ))}
      </div>
      <TableMock
        full={full}
        cols={[
          { h: 'DATE', w: '0.7fr' },
          { h: 'DOC', w: '1fr' },
          { h: 'FROM→TO', w: '0.9fr' },
          { h: 'RATE', w: '0.6fr', a: 'right' },
          { h: 'AMT (₹)', w: '1fr', a: 'right' },
          { h: 'G/L', w: '0.7fr', a: 'right' },
        ]}
        rows={[
          [
            'Apr 26',
            { mono: true, b: true, c: F.ink, t: 'INV-000022' },
            { mono: true, t: 'USD→INR' },
            { mono: true, t: '83.45' },
            { mono: true, t: '₹4,91,955' },
            { mono: true, b: true, c: F.green, t: '+₹840' },
          ],
          [
            'Apr 24',
            { mono: true, b: true, c: F.ink, t: 'BL-7820' },
            { mono: true, t: 'USD→INR' },
            { mono: true, t: '83.38' },
            { mono: true, t: '₹2,83,492' },
            { mono: true, b: true, c: F.green, t: '+₹240' },
          ],
          [
            'Apr 22',
            { mono: true, b: true, c: F.ink, t: 'INV-000019' },
            { mono: true, t: 'EUR→INR' },
            { mono: true, t: '89.08' },
            { mono: true, t: '₹2,20,728' },
            { mono: true, b: true, c: F.red, t: '−₹360' },
          ],
        ]}
      />
      <div
        style={{
          display: 'inline-flex',
          marginTop: full ? 14 : 8,
          padding: full ? '7px 12px' : '4px 8px',
          borderRadius: full ? 6 : 4,
          background: 'rgba(77,193,138,0.14)',
          fontFamily: sans,
          fontSize: full ? 12 : 8.5,
          color: F.green,
          fontWeight: 600,
        }}
      >
        Realized FX Gain ₹2,140 ✓
      </div>
    </WinMock>
  )
}

function APMock({ full }: { full?: boolean }) {
  return (
    <WinMock full={full}>
      <MockHeader
        title="Bills · TCS · Apr 2026"
        sub="AP · Vendor bills, 3-way matching, and payment approvals"
        cta="+ New Bill"
        full={full}
      />
      <KPIRow
        full={full}
        items={[
          { l: 'OPEN BILLS', v: '23', s: 'Awaiting action' },
          { l: 'OPEN AMT', v: '₹63,30,315', s: 'Across 23 bills' },
          { l: 'DUE WK', v: '7', s: 'Urgent', sc: '#C7572B' },
          { l: 'APPROVAL', v: '4', s: 'Pending', sc: '#C7572B' },
        ]}
      />
      <div
        style={{
          marginTop: full ? 14 : 9,
          display: 'flex',
          gap: full ? 8 : 4,
          fontFamily: sans,
          fontSize: full ? 13 : 7.5,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {['PR', 'PO', 'GRN', 'Bill', 'Pay'].map((s, i) => (
          <React.Fragment key={s}>
            <div
              style={{
                padding: full ? '7px 14px' : '4px 7px',
                borderRadius: full ? 5 : 3,
                background:
                  i === 2
                    ? 'rgba(77,193,138,0.18)'
                    : i === 3
                      ? F.ink
                      : F.bgSoft,
                color: i === 3 ? '#fff' : i === 2 ? F.green : F.ink,
                fontWeight: i === 3 || i === 2 ? 700 : 500,
                border: i === 3 || i === 2 ? 'none' : `1px solid ${F.line}`,
              }}
            >
              {s}
              {i === 2 ? ' ✓' : ''}
            </div>
            {i < 4 && <span style={{ color: F.muted }}>›</span>}
          </React.Fragment>
        ))}
      </div>
      <TableMock
        full={full}
        cols={[
          { h: 'VENDOR', w: '1.1fr' },
          { h: 'BILL #', w: '0.9fr' },
          { h: 'DUE', w: '0.7fr' },
          { h: 'AMT', w: '1fr', a: 'right' },
          { h: 'STATUS', w: '0.8fr', a: 'right' },
        ]}
        rows={[
          [
            'Infosys Ltd',
            { mono: true, b: true, t: 'BL-7823' },
            'May 20',
            { mono: true, t: '₹18,40,000' },
            { c: F.green, b: true, t: 'Approved' },
          ],
          [
            'TCS Pvt Ltd',
            { mono: true, b: true, t: 'BL-7820' },
            'Apr 28',
            { mono: true, t: '₹3,40,000' },
            { c: '#C7572B', b: true, t: 'Pending' },
          ],
          [
            'Wipro Ltd',
            { mono: true, b: true, t: 'BL-7818' },
            'Apr 25',
            { mono: true, t: '₹12,80,000' },
            { c: F.blue, b: true, t: 'Paid' },
          ],
          [
            'HCL Tech',
            { mono: true, b: true, t: 'BL-7812' },
            'May 10',
            { mono: true, t: '₹28,70,315' },
            { c: F.muted, b: true, t: 'Draft' },
          ],
        ]}
      />
    </WinMock>
  )
}

function ARMock({ full }: { full?: boolean }) {
  return (
    <WinMock full={full}>
      <MockHeader
        title="Customer Invoices"
        sub="19 INVOICES · AR · Customer invoice history and receivables"
        cta="+ New Invoice"
        full={full}
      />
      <KPIRow
        full={full}
        items={[
          { l: 'INVOICES', v: '19', s: '12 draft' },
          { l: 'OUTSTANDING', v: '₹40,00,200', s: '15 unpaid' },
          { l: 'OVERDUE', v: '₹0', s: 'None', sc: F.green },
          { l: 'PAID (MTD)', v: '₹0', s: 'Apr 2026' },
        ]}
      />
      <TableMock
        full={full}
        cols={[
          { h: 'INVOICE', w: '1fr' },
          { h: 'CUSTOMER', w: '1fr' },
          { h: 'DUE', w: '0.7fr' },
          { h: 'AMT', w: '1fr', a: 'right' },
          { h: 'STATUS', w: '1fr', a: 'right' },
        ]}
        rows={[
          [
            { mono: true, b: true, t: 'INV-000022' },
            'Zoho Corp',
            'May 9',
            { mono: true, t: '₹5,90,000' },
            { c: F.muted, b: true, t: 'Draft' },
          ],
          [
            { mono: true, b: true, t: 'INV-000019' },
            'CleverTap',
            'Apr 1',
            { mono: true, t: '₹2,47,800' },
            { c: '#C7572B', b: true, t: 'Partial' },
          ],
          [
            { mono: true, b: true, t: 'INV-000018' },
            'Chargebee',
            'Mar 11',
            { mono: true, t: '₹88,500' },
            { c: F.green, b: true, t: 'Paid' },
          ],
          [
            { mono: true, b: true, t: 'INV-000016' },
            'PhonePe',
            'Feb 16',
            { mono: true, t: '₹1,12,100' },
            { c: F.green, b: true, t: 'Paid' },
          ],
        ]}
      />
    </WinMock>
  )
}

function BankMock({ full }: { full?: boolean }) {
  const banks = [
    { n: 'HDFC', a: '··2841', v: '₹38,40,000', s: 'Reconciled ✓', sc: F.green },
    {
      n: 'ICICI',
      a: '··9012',
      v: '₹11,50,000',
      s: '3 unreconciled',
      sc: '#C7572B',
    },
    { n: 'Axis', a: '··5503', v: '₹20,000', s: 'Reconciled ✓', sc: F.green },
  ]
  return (
    <WinMock full={full}>
      <MockHeader
        title="Banking Dashboard"
        sub="Monitor bank accounts, transactions, and reconciliations"
        full={full}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: full ? 10 : 5,
          marginTop: full ? 14 : 8,
        }}
      >
        {banks.map((b) => (
          <div
            key={b.n}
            style={{
              padding: full ? '12px 14px' : '6px 7px',
              borderRadius: full ? 8 : 5,
              background: F.bgSoft,
              border: `1px solid ${F.line}`,
            }}
          >
            <div
              style={{
                fontFamily: sans,
                fontWeight: 700,
                fontSize: full ? 13 : 8.5,
                color: F.ink,
              }}
            >
              {b.n} Bank
            </div>
            <div
              style={{
                fontFamily: mono,
                fontSize: full ? 10 : 6.5,
                color: F.muted,
              }}
            >
              {b.a}
            </div>
            <div
              style={{
                fontFamily: sans,
                fontWeight: 700,
                fontSize: full ? 18 : 9.5,
                color: F.ink,
                marginTop: full ? 4 : 2,
              }}
            >
              {b.v}
            </div>
            <div
              style={{
                fontFamily: sans,
                fontSize: full ? 10 : 6.5,
                color: b.sc,
                marginTop: full ? 2 : 1,
              }}
            >
              {b.s}
            </div>
          </div>
        ))}
      </div>
      <TableMock
        full={full}
        cols={[
          { h: 'DATE', w: '0.6fr' },
          { h: 'DESCRIPTION', w: '1.4fr' },
          { h: 'RULE', w: '1fr' },
          { h: 'AMT', w: '1fr', a: 'right' },
          { h: 'MATCH', w: '0.8fr', a: 'right' },
        ]}
        rows={[
          [
            'Apr 26',
            'Customer NEFT — Zoho',
            'Auto: Receipts',
            { mono: true, c: F.green, b: true, t: '+₹5,90,000' },
            { c: F.green, b: true, t: 'Matched ✓' },
          ],
          [
            'Apr 25',
            'RTGS — AWS India',
            'Recurring',
            { mono: true, c: F.red, b: true, t: '−₹1,42,800' },
            { c: F.green, b: true, t: 'Matched ✓' },
          ],
          [
            'Apr 25',
            'Payroll batch',
            'Auto: Payroll',
            { mono: true, c: F.red, b: true, t: '−₹18,40,000' },
            { c: F.green, b: true, t: 'Matched ✓' },
          ],
          [
            'Apr 24',
            'NEFT — Chargebee',
            'Reviewing…',
            { mono: true, c: F.green, b: true, t: '+₹88,500' },
            { c: '#C7572B', b: true, t: 'Unmatched' },
          ],
        ]}
      />
    </WinMock>
  )
}

function FAAssetsMock({ full }: { full?: boolean }) {
  return (
    <WinMock full={full}>
      <MockHeader
        title="Fixed Assets"
        sub="Asset register, depreciation, and asset lifecycle management"
        cta="+ Add Asset"
        full={full}
      />
      <KPIRow
        full={full}
        items={[
          { l: 'ASSET COUNT', v: '142', s: 'Active' },
          { l: 'NET BOOK VAL', v: '₹2,10,40,000', s: 'As at Apr 2026' },
          { l: 'DEPN YTD', v: '₹18,60,000', s: 'FY 2025–26', sc: '#C7572B' },
        ]}
      />
      <TableMock
        full={full}
        cols={[
          { h: 'ASSET #', w: '0.9fr' },
          { h: 'NAME', w: '1.4fr' },
          { h: 'CAT', w: '1fr' },
          { h: 'METH', w: '0.7fr' },
          { h: 'NBV (₹)', w: '1fr', a: 'right' },
        ]}
        rows={[
          [
            { mono: true, b: true, t: 'FA-0042' },
            'Dell PowerEdge R750',
            'IT Hardware',
            'SLM',
            { mono: true, t: '₹3,40,000' },
          ],
          [
            { mono: true, b: true, t: 'FA-0089' },
            'Office Lease HSR',
            'Buildings',
            'SLM',
            { mono: true, t: '₹78,00,000' },
          ],
          [
            { mono: true, b: true, t: 'FA-0114' },
            'Toyota Innova 2023',
            'Vehicles',
            'DBM',
            { mono: true, t: '₹6,20,000' },
          ],
          [
            { mono: true, b: true, t: 'FA-0001' },
            'HP LaserJet M404',
            'IT Hardware',
            'SLM',
            { mono: true, t: '₹12,000' },
          ],
        ]}
      />
      <div
        style={{
          marginTop: full ? 14 : 8,
          padding: full ? '10px 14px' : '6px 8px',
          borderRadius: full ? 6 : 4,
          background: 'rgba(199,87,43,0.08)',
          border: '1px solid rgba(199,87,43,0.20)',
          fontFamily: sans,
          fontSize: full ? 12 : 8.5,
          color: '#C7572B',
          fontWeight: 600,
        }}
      >
        Depreciation method: SLM avg 10% · ₹18,60,000 YTD
      </div>
    </WinMock>
  )
}

// ─── Mock Expand Modal ────────────────────────────────────────
function MockExpandModal({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(8,12,28,0.96)',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Window chrome — macOS style */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '56px 18px 14px',
          flexShrink: 0,
        }}
      >
        {/* Traffic lights */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              width: 14,
              height: 14,
              borderRadius: 99,
              background: '#FF6058',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
            aria-label="Close"
          />
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 99,
              background: '#FFBD2E',
            }}
          />
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 99,
              background: '#28C940',
            }}
          />
        </div>
        {/* Title */}
        <div
          style={{
            fontFamily: mono,
            fontSize: 11,
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.08em',
            textAlign: 'center',
            flex: 1,
            padding: '0 12px',
          }}
        >
          {title} — financial accounting
        </div>
        {/* Close × */}
        <button
          onClick={onClose}
          style={{
            width: 32,
            height: 32,
            borderRadius: 99,
            background: 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 18,
            lineHeight: 1,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Mock content — static fit, no scroll */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          padding: '0 8px 4px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <div
            style={{
              transform: 'scale(0.58)',
              transformOrigin: 'top left',
              width: '172%',
            }}
          >
            {children}
          </div>
        </div>
      </div>

      {/* Projector puck — decorative footer matching desktop design */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '6px 0 18px',
          background: 'rgba(8,12,28,0.96)',
        }}
      >
        {/* Beam */}
        <div
          style={{
            width: 80,
            height: 70,
            background:
              'linear-gradient(to top, rgba(46,79,140,0.55) 0%, rgba(60,100,200,0.22) 40%, transparent 100%)',
            filter: 'blur(8px)',
            borderRadius: '50% 50% 0 0',
            marginBottom: -34,
            pointerEvents: 'none',
          }}
        />
        {/* 3D puck at ~60% size */}
        <div
          className="mob-pp-float"
          style={{
            position: 'relative',
            width: 96,
            height: 38,
            flexShrink: 0,
            filter:
              'drop-shadow(0 8px 14px rgba(0,0,0,0.55)) drop-shadow(0 0 24px rgba(27,46,90,0.45))',
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
                'inset 5px 0 14px rgba(255,255,255,0.045),inset -5px 0 14px rgba(0,0,0,0.45),inset 0 -8px 18px rgba(0,0,0,0.75)',
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
                'inset 0 6px 14px rgba(255,255,255,0.055),inset 0 -4px 10px rgba(0,0,0,0.65),0 5px 14px rgba(0,0,0,0.65)',
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
                  'inset 0 0 0 1.5px rgba(255,255,255,0.055),inset 0 0 6px rgba(0,0,0,0.6)',
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
              className="mob-pp-lens"
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
              className="mob-pp-ring1"
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
              className="mob-pp-ring2"
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
              className="mob-pp-hotspot"
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
              filter: 'blur(8px)',
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Feature Panel ────────────────────────────────────────────
interface FeaturePanelProps {
  num: string
  bg: string
  accent: string
  icon: React.ReactNode
  title: string
  desc: string
  bullets: string[]
  chip?: { label: string; value: string }
  children?: React.ReactNode
  fullChildren?: React.ReactNode
  first?: boolean
  last?: boolean
  onExpand?: () => void
}

function FeaturePanel({
  num,
  bg,
  accent,
  icon,
  title,
  desc,
  bullets,
  chip,
  children,
  first,
  last,
  onExpand,
}: FeaturePanelProps) {
  return (
    <div
      style={{
        padding: '28px 18px 26px',
        borderRadius: first
          ? '22px 22px 0 0'
          : last
            ? '22px 22px 22px 22px'
            : '22px 22px 0 0',
        background: bg,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: first
          ? '0 -2px 0 rgba(19,32,74,0.04), 0 14px 28px -18px rgba(19,32,74,0.22)'
          : '0 -10px 22px -14px rgba(19,32,74,0.22), 0 14px 28px -18px rgba(19,32,74,0.18)',
        borderTop: first
          ? '1px solid rgba(19,32,74,0.06)'
          : '1px solid rgba(19,32,74,0.10)',
        marginTop: first ? 0 : -14,
      }}
    >
      {!first && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 16,
            right: 16,
            height: 1,
            background: 'rgba(255,255,255,0.55)',
          }}
        />
      )}

      {/* ── Dashboard mock FIRST — tappable to expand ── */}
      <div
        onClick={onExpand}
        style={{
          marginBottom: 24,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(19,32,74,0.12)',
          position: 'relative',
          cursor: 'pointer',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div
            style={{
              transform: 'scale(0.82)',
              transformOrigin: 'top left',
              width: '122%',
            }}
          >
            {children}
          </div>
        </div>
        {/* Expand affordance */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(19,32,74,0.75)',
            backdropFilter: 'blur(6px)',
            borderRadius: 999,
            padding: '5px 10px',
            pointerEvents: 'none',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path
              d="M1 10L10 1M10 1H5M10 1V6"
              stroke="rgba(255,255,255,0.85)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              fontFamily: mono,
              fontSize: 9,
              color: 'rgba(255,255,255,0.85)',
              letterSpacing: '0.08em',
              fontWeight: 600,
            }}
          >
            VIEW FULL
          </span>
        </div>
      </div>

      {/* ── Feature label ── */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: mono,
          fontSize: 10,
          letterSpacing: '0.22em',
          color: accent,
          fontWeight: 700,
        }}
      >
        <span style={{ width: 18, height: 1.5, background: accent }} />
        FEATURE {num}
      </div>

      {/* ── Icon + Title row ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 14,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.7)',
            display: 'grid',
            placeItems: 'center',
            color: accent,
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(19,32,74,0.08)',
          }}
        >
          {icon}
        </div>
        <h2
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontWeight: 800,
            fontSize: 26,
            lineHeight: 1.1,
            color: F.ink,
            margin: 0,
            letterSpacing: '-0.03em',
          }}
        >
          {title}
        </h2>
      </div>

      {/* ── Description ── */}
      <p
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 14,
          color: F.inkSoft,
          margin: '12px 0 0',
          lineHeight: 1.6,
          fontWeight: 400,
        }}
      >
        {desc}
      </p>

      {/* ── Bullet list ── */}
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: '16px 0 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {bullets.map((c, i) => (
          <li
            key={i}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              style={{ marginTop: 2, flex: '0 0 16px' }}
            >
              <circle cx="8" cy="8" r="7" fill={accent} opacity={0.12} />
              <path
                d="M4.5 8l2.5 2.5 4.5-5"
                stroke={accent}
                strokeWidth="1.7"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 13.5,
                color: F.inkSoft,
                lineHeight: 1.5,
                fontWeight: 450,
              }}
            >
              {c}
            </span>
          </li>
        ))}
      </ul>

      {/* ── Chip ── */}
      {chip && (
        <div
          style={{
            display: 'inline-flex',
            marginTop: 16,
            background: '#fff',
            borderRadius: 999,
            padding: '8px 14px',
            boxShadow: '0 4px 14px rgba(19,32,74,0.10)',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 12,
            color: F.ink,
            fontWeight: 600,
            alignItems: 'center',
            gap: 7,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 99,
              background: accent,
            }}
          />
          {chip.label}{' '}
          <strong style={{ fontWeight: 800, color: accent }}>
            {chip.value}
          </strong>
        </div>
      )}
    </div>
  )
}

// ─── Capabilities Section ─────────────────────────────────────
function CapabilitiesSection({
  onExpand,
}: {
  onExpand: (title: string, node: React.ReactNode) => void
}) {
  const features: FeaturePanelProps[] = [
    {
      num: '01',
      title: 'General Ledger',
      bg: 'linear-gradient(180deg, #E8EEFE 0%, #F4F6FE 100%)',
      accent: F.blue,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect
            x="4"
            y="3"
            width="16"
            height="18"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M8 7h8M8 11h8M8 15h5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      ),
      desc: 'The double-entry core — chart of accounts, journal workflows, period-locked close, and a real-time trial balance that never goes stale.',
      bullets: [
        'Custom chart of accounts with multi-level hierarchy',
        'Journal entry creation with multi-level approval workflows',
        'Period-lock controls with admin-only override',
        'Real-time trial balance and posting validation',
      ],
      chip: { label: 'Accuracy', value: '99.9%' },
      children: <GLMock />,
      fullChildren: <GLMock full />,
    },
    {
      num: '02',
      title: 'Multi-Entity Management',
      bg: 'linear-gradient(180deg, #E6F6EC 0%, #F1FAF3 100%)',
      accent: F.green,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 21V7l5-3v17M14 21V11l5-2v12M4 21h16"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      desc: 'Maintain fully independent books per entity while consolidating at the group level — server-side, with inter-company eliminations.',
      bullets: [
        'Independent chart of accounts per entity, shared master optional',
        'Server-side consolidation across any entity combination',
        'Inter-company transaction posting and automatic elimination',
        'Role-based access scoped per entity',
        'Consolidated P&L and balance sheet at group level',
      ],
      chip: { label: 'Time saved', value: '40h/mo' },
      children: <EntityMock />,
      fullChildren: <EntityMock full />,
    },
    {
      num: '03',
      title: 'Multi-Currency',
      bg: 'linear-gradient(180deg, #FDEFE0 0%, #FCE9D8 100%)',
      accent: '#C7572B',
      icon: (
        <span style={{ fontFamily: sans, fontWeight: 600, fontSize: 18 }}>
          $
        </span>
      ),
      desc: 'Record transactions in any currency, apply entity-level exchange rates, and run revaluation entries at period end.',
      bullets: [
        'Transaction-level currency assignment',
        'Manual or CSV-imported exchange rates per period',
        'Realized and unrealized FX gain/loss calculation',
        'Multi-currency bank account register',
        'Currency revaluation journal at period close',
      ],
      chip: { label: 'Data sources', value: '50+' },
      children: <FXMock />,
      fullChildren: <FXMock full />,
    },
    {
      num: '04',
      title: 'Accounts Payable',
      bg: 'linear-gradient(180deg, #F1E9FE 0%, #F9F2FE 100%)',
      accent: '#6B5BD6',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M7 7l10 10M17 17V9M17 17H9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ),
      desc: 'Vendor bills flow from entry through approval, three-way matching, and TDS deduction — before a single payment goes out.',
      bullets: [
        'Vendor master with payment terms and TDS applicability',
        'Bill entry with line-level GL coding and cost centre tagging',
        'Configurable multi-level approval workflows',
        'Three-way PO–receipt–invoice matching',
        'TDS deduction at source with challan tracking',
      ],
      chip: { label: 'Compliance', value: '100%' },
      children: <APMock />,
      fullChildren: <APMock full />,
    },
    {
      num: '05',
      title: 'Accounts Receivable',
      bg: 'linear-gradient(180deg, #E8EEFE 0%, #EDEAFE 100%)',
      accent: F.blue,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M7 17l10-10M7 7h10v10"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ),
      desc: 'GST-compliant customer invoices, aging buckets, automated reminders, and advance receipt application — all in one place.',
      bullets: [
        'Customer invoicing with CGST/SGST/IGST line items',
        'Aging report with configurable buckets (0-30, 31-60, 61-90, 90+)',
        'Automated payment reminder scheduling',
        'Receipt application against open invoices and advance management',
        'Customer-level credit limit enforcement',
      ],
      chip: { label: 'Entries saved', value: '−60%' },
      children: <ARMock />,
      fullChildren: <ARMock full />,
    },
    {
      num: '06',
      title: 'Banking & Cash',
      bg: 'linear-gradient(180deg, #E6F6EC 0%, #EEF7F0 100%)',
      accent: F.green,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 10l9-6 9 6M5 10v8M19 10v8M9 10v8M15 10v8M3 20h18"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      ),
      desc: 'Import bank statements, match transactions with rule-based logic, and see a consolidated cash position across every account.',
      bullets: [
        'Multi-bank account register with running balance',
        'Bank statement import via CSV or OFX',
        'Rule-based transaction matching engine',
        'Cash position dashboard across all banks',
        'Reconciliation workflow with exception handling',
      ],
      chip: { label: 'Time saved', value: '40h/mo' },
      children: <BankMock />,
      fullChildren: <BankMock full />,
    },
    {
      num: '07',
      title: 'Fixed Assets',
      bg: 'linear-gradient(180deg, #FDEFE0 0%, #FCE9D8 100%)',
      accent: '#C7572B',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <ellipse
            cx="12"
            cy="6"
            rx="7"
            ry="2.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      ),
      desc: 'Track every asset through its full lifecycle — from capitalisation and depreciation to disposal — with schedule forecasting built in.',
      bullets: [
        'Asset register with category, location, and cost centre',
        'Straight-line and declining-balance depreciation methods',
        'Asset addition, disposal, and inter-entity transfer',
        'Depreciation schedule with future-period forecast',
        'Asset revaluation journal entries',
      ],
      chip: { label: 'Faster reports', value: '5×' },
      children: <FAAssetsMock />,
      fullChildren: <FAAssetsMock full />,
    },
  ]

  return (
    <>
      <div
        style={{
          padding: '56px 22px 8px',
          textAlign: 'center',
          background: F.bg,
        }}
      >
        <div
          style={{
            fontFamily: mono,
            fontSize: 11,
            color: F.muted,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            fontWeight: 500,
          }}
        >
          CAPABILITIES
        </div>
        <h2
          style={{
            fontFamily: sans,
            fontWeight: 800,
            fontSize: 38,
            color: F.ink,
            margin: '14px 0 10px',
            letterSpacing: '-0.028em',
            lineHeight: 1.05,
          }}
        >
          Everything you need
        </h2>
        <p
          style={{
            fontFamily: sans,
            fontSize: 14,
            color: F.inkSoft,
            margin: 0,
            lineHeight: 1.55,
          }}
        >
          Explore the powerful capabilities built into the core of Financial
          Accounting.
        </p>
      </div>
      <div style={{ position: 'relative', padding: '24px 12px 0' }}>
        {features.map((f, i) => (
          <FeaturePanel
            key={f.num}
            {...f}
            first={i === 0}
            last={i === features.length - 1}
            onExpand={() => onExpand(f.title, f.fullChildren ?? f.children)}
          >
            {f.children}
          </FeaturePanel>
        ))}
      </div>
    </>
  )
}

// ─── Industry Section ─────────────────────────────────────────
function IndustrySection() {
  const segs = [
    {
      t: 'Small Businesses',
      d: 'Simple accounting for small businesses with automated workflows and tax compliance.',
      b: [
        'Easy bookkeeping',
        'Automated reconciliation',
        'Financial reports',
        'Tax compliance',
        'Mobile access',
      ],
    },
    {
      t: 'Growing Companies',
      d: 'Scalable accounting for companies with complex financial needs and multi-currency operations.',
      b: [
        'Multi-entity support',
        'Advanced reporting',
        'Workflow automation',
        'Integration ready',
        'Cost accounting',
      ],
      featured: true,
    },
    {
      t: 'Enterprises',
      d: 'Enterprise-grade accounting with advanced features, controls, and multi-entity consolidation.',
      b: [
        'Multi-currency',
        'Consolidation',
        'Advanced security',
        'Custom workflows',
        'Audit compliance',
      ],
    },
    {
      t: 'Multi-Location Businesses',
      d: 'Consolidated accounting across multiple locations with centralized control and local compliance.',
      b: [
        'Branch accounting',
        'Location-wise reports',
        'Inter-branch transfers',
        'Local tax compliance',
      ],
    },
    {
      t: 'Holding Companies',
      d: 'Multi-entity consolidation and reporting for holding companies with inter-company transaction management.',
      b: [
        'Group consolidation',
        'Inter-company eliminations',
        'Investment tracking',
        'Group-level reports',
      ],
    },
  ]

  return (
    <div
      style={{
        background: '#0A1024',
        padding: '56px 16px 64px',
        marginTop: 32,
      }}
    >
      <h2
        style={{
          fontFamily: sans,
          fontWeight: 800,
          fontSize: 32,
          color: '#fff',
          margin: 0,
          textAlign: 'center',
          letterSpacing: '-0.025em',
          lineHeight: 1.1,
        }}
      >
        Built for Your Industry
      </h2>
      <p
        style={{
          fontFamily: sans,
          fontSize: 14,
          color: 'rgba(255,255,255,0.55)',
          margin: '10px 0 0',
          textAlign: 'center',
        }}
      >
        Tailored solutions for specific business needs.
      </p>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginTop: 28,
        }}
      >
        {segs.map((s) => (
          <div
            key={s.t}
            style={{
              padding: '20px 18px',
              borderRadius: 16,
              background: s.featured
                ? 'linear-gradient(180deg, rgba(61,122,232,0.18), rgba(61,122,232,0.06))'
                : 'rgba(255,255,255,0.025)',
              border: s.featured
                ? '1px solid rgba(61,122,232,0.35)'
                : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3
                style={{
                  fontFamily: sans,
                  fontWeight: 800,
                  fontSize: 22,
                  color: s.featured ? '#9CC0F7' : '#fff',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                {s.t}
              </h3>
              {s.featured && (
                <span style={{ color: '#9CC0F7', fontSize: 16 }}>›</span>
              )}
            </div>
            <p
              style={{
                fontFamily: sans,
                fontSize: 13,
                color: 'rgba(255,255,255,0.6)',
                margin: '8px 0 14px',
                lineHeight: 1.5,
              }}
            >
              {s.d}
            </p>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {s.b.map((x) => (
                <li
                  key={x}
                  style={{ display: 'flex', alignItems: 'center', gap: 9 }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 99,
                      background: s.featured ? '#9CC0F7' : '#3D7AE8',
                      flex: '0 0 5px',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: sans,
                      fontSize: 12.5,
                      color: 'rgba(255,255,255,0.7)',
                    }}
                  >
                    {x}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Numbers Band ─────────────────────────────────────────────
function NumbersBand() {
  const rows = [
    { v: '40h', u: '/mo', l: 'Reclaimed from reconciliation' },
    { v: '3.2x', u: '', l: 'Faster monthly close' },
    { v: '₹0', u: '', l: 'Compliance penalties in pilot year' },
    { v: '6', u: ' entities', l: 'Consolidated in a single click' },
  ]
  return (
    <div style={{ background: F.bg, padding: '56px 14px 8px' }}>
      <div style={{ textAlign: 'left', padding: '0 4px 22px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: mono,
            fontSize: 10,
            color: F.muted,
            letterSpacing: '0.28em',
            fontWeight: 600,
          }}
        >
          <span style={{ width: 18, height: 1, background: F.muted }} />
          IN PRACTICE
        </div>
        <h2
          style={{
            fontFamily: sans,
            fontWeight: 800,
            fontSize: 34,
            color: F.ink,
            margin: '12px 0 0',
            letterSpacing: '-0.03em',
            lineHeight: 1.02,
          }}
        >
          What teams find{' '}
          <span
            style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 500 }}
          >
            after switching.
          </span>
        </h2>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              padding: '18px 4px',
              borderTop: i === 0 ? `1px solid ${F.ink}` : `1px solid ${F.line}`,
              borderBottom:
                i === rows.length - 1 ? `1px solid ${F.ink}` : 'none',
              gap: 14,
            }}
          >
            <div
              style={{
                fontFamily: sans,
                fontWeight: 800,
                fontSize: 42,
                color: F.ink,
                letterSpacing: '-0.035em',
                lineHeight: 0.95,
                flex: '0 0 auto',
              }}
            >
              {r.v}
              <span style={{ fontSize: 18, color: F.muted, fontWeight: 600 }}>
                {r.u}
              </span>
            </div>
            <div
              style={{
                fontFamily: sans,
                fontSize: 13,
                color: F.inkSoft,
                textAlign: 'right',
                lineHeight: 1.4,
                maxWidth: 200,
              }}
            >
              {r.l}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Compare Plans ────────────────────────────────────────────
function ComparePlans() {
  const modules = [
    ['AI insights', 0, 0, 1],
    ['Analytics', 1, 1, 1],
    ['Banking', 1, 1, 1],
    ['Bills', 1, 1, 1],
    ['Budgeting', 0, 1, 1],
    ['Chart of accounts', 1, 1, 1],
    ['Compliance', 0, 1, 1],
    ['Customers', 1, 1, 1],
    ['Dashboard', 1, 1, 1],
    ['Documents', 1, 1, 1],
    ['Estimates', 1, 1, 1],
    ['Expense reports', 1, 1, 1],
    ['Fixed assets', 0, 1, 1],
    ['General ledger', 1, 1, 1],
    ['Integrations', 0, 1, 1],
    ['Inventory', 0, 1, 1],
    ['Invoices', 1, 1, 1],
    ['Multi-currency', 0, 1, 1],
    ['Multi-entity', 0, 0, 1],
    ['Payroll', 0, 1, 1],
    ['Receipts', 1, 1, 1],
    ['Reports', 1, 1, 1],
    ['Tax', 1, 1, 1],
    ['Vendors', 1, 1, 1],
  ]

  function Check() {
    return (
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 99,
          background: 'rgba(61,122,232,0.10)',
          display: 'grid',
          placeItems: 'center',
          margin: '0 auto',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 6l3 3 5-6"
            stroke={F.blue}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    )
  }

  return (
    <div style={{ background: F.bg, padding: '56px 0 36px' }}>
      <div style={{ textAlign: 'center', padding: '0 22px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '7px 14px',
            borderRadius: 99,
            background: 'rgba(61,122,232,0.10)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect
              x="1"
              y="1"
              width="5"
              height="5"
              rx="1"
              stroke={F.blue}
              strokeWidth="1.6"
            />
            <rect
              x="8"
              y="1"
              width="5"
              height="5"
              rx="1"
              stroke={F.blue}
              strokeWidth="1.6"
            />
            <rect
              x="1"
              y="8"
              width="5"
              height="5"
              rx="1"
              stroke={F.blue}
              strokeWidth="1.6"
            />
            <rect
              x="8"
              y="8"
              width="5"
              height="5"
              rx="1"
              stroke={F.blue}
              strokeWidth="1.6"
            />
          </svg>
          <span
            style={{
              fontFamily: mono,
              fontSize: 10.5,
              color: F.blue,
              letterSpacing: '0.18em',
              fontWeight: 700,
            }}
          >
            COMPARE PLANS
          </span>
        </div>
        <h2
          style={{
            fontFamily: sans,
            fontWeight: 800,
            fontSize: 34,
            color: F.ink,
            margin: '18px 0 0',
            letterSpacing: '-0.028em',
            lineHeight: 1.05,
          }}
        >
          Modules by plan
        </h2>
      </div>

      <div style={{ marginTop: 28, padding: '0 12px' }}>
        <div
          style={{
            background: '#fff',
            border: `1px solid ${F.line}`,
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 8px 24px -8px rgba(19,32,74,0.08)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 0.9fr 0.9fr 0.9fr',
              background: F.bgSoft,
              borderBottom: `1px solid ${F.line}`,
            }}
          >
            <div
              style={{
                padding: '14px 12px',
                fontFamily: mono,
                fontSize: 9,
                color: F.muted,
                letterSpacing: '0.16em',
                fontWeight: 600,
              }}
            >
              MODULES
            </div>
            {['Starter', 'Professional', 'Enterprise'].map((p) => (
              <div
                key={p}
                style={{
                  padding: '14px 6px',
                  textAlign: 'center',
                  borderLeft: `1px solid ${F.line}`,
                }}
              >
                <div
                  style={{
                    fontFamily: sans,
                    fontWeight: 800,
                    fontSize: 13,
                    color: F.ink,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {p}
                </div>
                <div
                  style={{
                    fontFamily: sans,
                    fontSize: 8.5,
                    color: F.muted,
                    marginTop: 2,
                  }}
                >
                  Annual
                </div>
              </div>
            ))}
          </div>
          {modules.map((row, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr 0.9fr 0.9fr 0.9fr',
                borderBottom:
                  i < modules.length - 1 ? `1px solid ${F.line}` : 'none',
                background: i % 2 ? '#fff' : 'rgba(19,32,74,0.015)',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  padding: '12px',
                  fontFamily: sans,
                  fontSize: 12.5,
                  color: F.ink,
                  fontWeight: 500,
                }}
              >
                {row[0]}
              </div>
              {[1, 2, 3].map((j) => (
                <div
                  key={j}
                  style={{
                    padding: '12px 4px',
                    textAlign: 'center',
                    borderLeft: `1px solid ${F.line}`,
                  }}
                >
                  {row[j] ? (
                    <Check />
                  ) : (
                    <span
                      style={{ color: F.muted, fontFamily: sans, fontSize: 14 }}
                    >
                      —
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Footer ───────────────────────────────────────────────────
function Footer({ onNavigate }: { onNavigate: (to: string) => void }) {
  const sections = [
    { h: 'Product', l: ['Financial Accounting', 'HRMS', 'CRM', 'Operations'] },
    { h: 'Company', l: ['About', 'Pricing', 'Customers', 'Careers'] },
    { h: 'Resources', l: ['Docs', 'Blog', 'Help', 'Status'] },
    { h: 'Legal', l: ['Privacy', 'Terms', 'Security', 'GDPR'] },
  ]

  return (
    <div
      style={{
        background: '#0A1024',
        padding: '40px 18px 100px',
        color: '#fff',
      }}
    >
      <MiniLogo />
      <p
        style={{
          fontFamily: sans,
          fontSize: 13,
          color: 'rgba(255,255,255,0.55)',
          margin: '14px 0 0',
          lineHeight: 1.55,
        }}
      >
        Run your finance stack on one ledger — from chart of accounts to
        consolidated reporting.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24,
          marginTop: 28,
        }}
      >
        {sections.map((c) => (
          <div key={c.h}>
            <div
              style={{
                fontFamily: sans,
                fontSize: 11,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.9)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              {c.h}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 9,
                marginTop: 12,
              }}
            >
              {c.l.map((l) => (
                <button
                  key={l}
                  onClick={() => onNavigate('/landing')}
                  style={{
                    fontFamily: sans,
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.55)',
                    textDecoration: 'none',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: 0,
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 32,
          paddingTop: 18,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          fontFamily: sans,
          fontSize: 11,
          color: 'rgba(255,255,255,0.4)',
        }}
      >
        © 2026 Zopkit. All rights reserved.
      </div>
    </div>
  )
}

// ─── Sticky CTA ───────────────────────────────────────────────
function StickyCTA({
  visible,
  onTrial,
}: {
  visible: boolean
  onTrial: () => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 60,
        padding: '10px 14px 18px',
        background: `linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 30%, rgba(255,255,255,1) 100%)`,
        transform: visible ? 'translateY(0)' : 'translateY(120%)',
        transition: 'transform 350ms cubic-bezier(.4,0,.2,1)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <button
        onClick={onTrial}
        style={{
          width: '100%',
          padding: '15px 16px',
          background: F.ink,
          color: '#fff',
          border: 'none',
          borderRadius: 999,
          fontFamily: sans,
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 8px 22px rgba(19,32,74,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        Start free trial <span style={{ fontSize: 14, opacity: 0.7 }}>→</span>
      </button>
    </div>
  )
}

// ─── Root Page ────────────────────────────────────────────────
export function FAMobileProductPage() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showCTA, setShowCTA] = useState(false)
  const [expandedMock, setExpandedMock] = useState<{
    title: string
    node: React.ReactNode
  } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => setShowCTA(el.scrollTop > 240)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const handleNavigate = (to: string) => {
    navigate({ to })
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100dvh',
        position: 'relative',
        overflow: 'hidden',
        background: F.bg,
      }}
    >
      <div
        ref={scrollRef}
        style={
          {
            width: '100%',
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
          } as React.CSSProperties
        }
      >
        <TopNav onMenu={() => setMenuOpen(true)} />
        <HeroSection />
        <ShiftSection />
        <CapabilitiesSection
          onExpand={(title, node) => setExpandedMock({ title, node })}
        />
        <IndustrySection />
        <NumbersBand />
        <ComparePlans />
        <Footer onNavigate={handleNavigate} />
      </div>
      <StickyCTA
        visible={showCTA && !menuOpen && !expandedMock}
        onTrial={() => handleNavigate('/onboarding')}
      />
      <Menu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={handleNavigate}
      />
      {/* Modal rendered here — outside scroll div — so position:fixed works on all mobile browsers */}
      {expandedMock && (
        <MockExpandModal
          title={expandedMock.title}
          onClose={() => setExpandedMock(null)}
        >
          {expandedMock.node}
        </MockExpandModal>
      )}
    </div>
  )
}
