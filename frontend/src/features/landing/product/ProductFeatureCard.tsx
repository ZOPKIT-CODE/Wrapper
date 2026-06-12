import React, { useState } from 'react'
import { Check, Maximize2, X, Zap } from 'lucide-react'
import { cardThemes } from './productCardThemes'
import { getFAFeatureSvg } from './getFAFeatureSvg'
import { getCRMFeatureSvg } from '../pages/getCRMFeatureSvg'
import type { FeatureCardProps } from './types'

export const ProductFeatureCard: React.FC<FeatureCardProps> = ({
  feature,
  i,
  productId,
}) => {
  const stickyTop = 80 + i * 10
  const t = cardThemes[i % cardThemes.length]
  const [fullscreen, setFullscreen] = useState(false)

  return (
    <>
      {/* Fullscreen modal */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{
            background: 'rgba(0,0,0,0.88)',
            backdropFilter: 'blur(10px)',
          }}
          onClick={() => setFullscreen(false)}
        >
          {/* ── Monitor assembly ──
                    max-width: min(1100px, (100vh − chrome) / 0.6)
                    ensures SVG (800×480 = 5:3 ratio) always fits in the viewport.
                    On 900 vh → max 1040px wide; on 1080 vh → max 1100px wide. ── */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              maxWidth: 'min(1100px, calc((100vh - 280px) / 0.6))',
              padding: '0 16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Monitor bezel */}
            <div
              style={{
                width: '100%',
                background:
                  'linear-gradient(160deg, #23232f 0%, #18181f 60%, #111118 100%)',
                borderRadius: '18px',
                padding: '8px 8px 10px',
                boxShadow:
                  '0 0 0 1px rgba(255,255,255,0.07), 0 40px 80px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.10)',
              }}
            >
              {/* Screen — no height cap, SVG renders at its natural size */}
              <div
                style={{
                  borderRadius: '10px',
                  overflow: 'hidden',
                  background: '#fff',
                }}
              >
                {/* macOS title bar */}
                <div className="flex items-center border-b border-slate-100 bg-white px-5 py-3">
                  <div className="mr-5 flex gap-[7px]">
                    <button
                      onClick={() => setFullscreen(false)}
                      className="flex h-[13px] w-[13px] items-center justify-center rounded-full bg-[#FF5F57] transition-all hover:brightness-90"
                    >
                      <X
                        size={7}
                        className="text-red-800 opacity-0 hover:opacity-100"
                      />
                    </button>
                    <div className="h-[13px] w-[13px] rounded-full bg-[#FFBD2E]" />
                    <div className="h-[13px] w-[13px] rounded-full bg-[#28C840]" />
                  </div>
                  <div className="flex flex-1 justify-center">
                    <div className="rounded-[7px] bg-slate-100 px-4 py-[5px] font-mono text-[12px] text-slate-400">
                      {feature.title} — {productId?.replace(/-/g, ' ')}
                    </div>
                  </div>
                  <button
                    onClick={() => setFullscreen(false)}
                    className="ml-5 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X size={16} />
                  </button>
                </div>
                {/* Full content — no maxHeight, shows everything */}
                {productId === 'financial-accounting' ? (
                  <div style={{ lineHeight: 0 }}>{getFAFeatureSvg(i)}</div>
                ) : productId === 'b2b-crm' ? (
                  <div style={{ lineHeight: 0 }}>{getCRMFeatureSvg(i)}</div>
                ) : (
                  <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 bg-slate-50 p-8">
                    <span className="text-sm text-slate-400">
                      No full preview available
                    </span>
                  </div>
                )}
              </div>
              {/* LED chin strip */}
              <div
                style={{
                  marginTop: '8px',
                  height: '3px',
                  borderRadius: '3px',
                  background:
                    'linear-gradient(to right, transparent 10%, rgba(46,79,140,0.5) 40%, rgba(60,105,200,0.75) 50%, rgba(46,79,140,0.5) 60%, transparent 90%)',
                  filter: 'blur(1px)',
                }}
              />
            </div>

            {/* Monitor neck */}
            <div
              style={{
                width: '56px',
                height: '22px',
                background:
                  'linear-gradient(to bottom, #1e1e28 0%, #141420 100%)',
                clipPath: 'polygon(22% 0%, 78% 0%, 100% 100%, 0% 100%)',
              }}
            />

            {/* Puck base */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  bottom: '46px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '160px',
                  height: '44px',
                  background:
                    'linear-gradient(to top, rgba(46,79,140,0.55) 0%, rgba(60,100,200,0.14) 70%, transparent 100%)',
                  filter: 'blur(12px)',
                  pointerEvents: 'none',
                  borderRadius: '50% 50% 0 0',
                }}
              />
              <div
                className="pp-puck-float"
                style={{
                  position: 'relative',
                  width: '200px',
                  height: '70px',
                  flexShrink: 0,
                  filter:
                    'drop-shadow(0 14px 26px rgba(0,0,0,0.85)) drop-shadow(0 0 40px rgba(27,46,90,0.65))',
                }}
              >
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
                      boxShadow: 'inset 0 0 12px rgba(0,0,0,0.75)',
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
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-14%',
                    left: '18%',
                    right: '18%',
                    height: '18%',
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.7)',
                    filter: 'blur(14px)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className="sticky mb-3 last:mb-0"
        style={{ top: `${stickyTop}px`, zIndex: i + 1 }}
      >
        <div
          className="relative overflow-hidden rounded-3xl border"
          style={{
            background: t.bg,
            borderColor: 'rgba(0,0,0,0.07)',
          }}
        >
          {/* Soft orb tints */}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse 60% 60% at ${t.orb1Pos}, ${t.orb1} 0%, transparent 100%)`,
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse 55% 55% at ${t.orb2Pos}, ${t.orb2} 0%, transparent 100%)`,
              }}
            />
          </div>

          <div className="relative z-10 grid min-h-[620px] lg:grid-cols-[1fr_1.1fr]">
            {/* LEFT — content */}
            <div className="order-2 flex flex-col justify-center px-10 py-14 lg:order-1 lg:px-16">
              {/* Overline label */}
              <div className="mb-7 flex items-center gap-2.5">
                <div className="h-px w-5" style={{ background: t.accent }} />
                <span
                  className="text-[10px] font-semibold tracking-[0.18em] uppercase"
                  style={{ color: t.accent }}
                >
                  Feature {String(i + 1).padStart(2, '0')}
                </span>
              </div>

              {/* Icon */}
              <div
                className="mb-8 flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ background: t.accentDim, color: t.accent }}
              >
                <feature.icon size={20} strokeWidth={1.75} />
              </div>

              {/* Title */}
              <h3
                className="mb-4 text-[1.85rem] leading-[1.18] font-bold tracking-[-0.025em] lg:text-[2.1rem]"
                style={{ color: t.titleColor }}
              >
                {feature.title}
              </h3>

              <p
                className="mb-9 text-[15px] leading-[1.8] font-normal"
                style={{ color: t.descColor }}
              >
                {feature.description}
              </p>

              <ul className="space-y-3.5">
                {(feature.subFeatures || feature.benefits || []).map(
                  (benefit: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div
                        className="mt-[2px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
                        style={{ background: t.checkRing }}
                      >
                        <Check
                          size={9}
                          strokeWidth={2.5}
                          style={{ color: t.checkColor }}
                        />
                      </div>
                      <span
                        className="text-[13.5px] leading-[1.6]"
                        style={{ color: t.benefitColor }}
                      >
                        {benefit}
                      </span>
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* RIGHT — tilted browser window */}
            <div className="order-1 flex items-center justify-center overflow-hidden px-2 py-6 lg:order-2 lg:px-4 lg:py-8">
              <div
                className="relative w-full"
                style={{ perspective: '1200px' }}
              >
                {/* Glow behind frame */}
                <div
                  className="absolute inset-4 rounded-2xl"
                  style={{ background: t.frameGlowColor }}
                />

                {/* Browser frame */}
                <div
                  className="relative overflow-hidden rounded-2xl border"
                  style={{
                    background: t.frameBg,
                    borderColor: t.frameBorder,
                    transform: 'rotateY(-4deg) rotateX(2deg)',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  {/* macOS-style title bar */}
                  <div
                    className="flex items-center gap-0 border-b px-4 py-[10px]"
                    style={{
                      background: 'rgba(255,255,255,0.6)',
                      borderColor: 'rgba(0,0,0,0.07)',
                    }}
                  >
                    <div className="mr-4 flex gap-[6px]">
                      <div className="h-[11px] w-[11px] rounded-full bg-[#FF5F57]" />
                      <div className="h-[11px] w-[11px] rounded-full bg-[#FFBD2E]" />
                      <div className="h-[11px] w-[11px] rounded-full bg-[#28C840]" />
                    </div>
                    <div className="flex-1">
                      <div
                        className="mx-auto truncate rounded-[6px] px-3 py-[5px] text-center font-mono text-[11px]"
                        style={{
                          background: 'rgba(0,0,0,0.05)',
                          color: 'rgba(0,0,0,0.35)',
                          maxWidth: '220px',
                        }}
                      >
                        app.zopkit.com/dashboard
                      </div>
                    </div>
                    <button
                      onClick={() => setFullscreen(true)}
                      className="ml-2 rounded-md p-1 transition-colors hover:bg-black/5"
                      title="Expand"
                    >
                      <Maximize2
                        size={11}
                        style={{ color: 'rgba(0,0,0,0.35)' }}
                      />
                    </button>
                  </div>

                  {/* Screenshot */}
                  <div
                    className="relative overflow-hidden"
                    style={{ maxHeight: '480px' }}
                  >
                    {productId === 'financial-accounting' ? (
                      <div style={{ lineHeight: 0, display: 'block' }}>
                        {getFAFeatureSvg(i)}
                      </div>
                    ) : productId === 'b2b-crm' ? (
                      <div style={{ lineHeight: 0, display: 'block' }}>
                        {getCRMFeatureSvg(i)}
                      </div>
                    ) : (
                      <div
                        className="flex flex-col gap-3 p-5"
                        style={{
                          background: 'rgba(255,255,255,0.5)',
                          minHeight: '280px',
                        }}
                      >
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { v: '2.4k', l: 'Users' },
                            { v: '98%', l: 'Uptime' },
                            { v: '1.2s', l: 'Response' },
                            { v: '99.9', l: 'Score' },
                          ].map((m, k) => (
                            <div
                              key={k}
                              className="flex flex-col items-center gap-1 rounded-xl p-3"
                              style={{
                                background: 'rgba(255,255,255,0.8)',
                                border: '1px solid rgba(0,0,0,0.07)',
                              }}
                            >
                              <span
                                className="text-base font-bold"
                                style={{ color: t.titleColor }}
                              >
                                {m.v}
                              </span>
                              <span
                                className="text-[10px]"
                                style={{ color: t.descColor }}
                              >
                                {m.l}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div
                          className="flex flex-1 flex-col gap-2 rounded-xl p-4"
                          style={{
                            background: 'rgba(255,255,255,0.7)',
                            border: '1px solid rgba(0,0,0,0.06)',
                          }}
                        >
                          <div
                            className="mb-2 h-2.5 w-28 rounded-full"
                            style={{ background: 'rgba(0,0,0,0.08)' }}
                          />
                          {[1, 0.8, 0.65, 0.9, 0.55].map((w, k) => (
                            <div key={k} className="flex items-center gap-2">
                              <div
                                className="h-2 rounded-full"
                                style={{
                                  width: `${w * 100}%`,
                                  background: `linear-gradient(90deg, ${t.gradientFrom}80, ${t.gradientTo}50)`,
                                }}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <div
                            className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5"
                            style={{
                              background: 'rgba(255,255,255,0.8)',
                              border: '1px solid rgba(0,0,0,0.07)',
                            }}
                          >
                            <Zap size={12} className="text-yellow-500" />
                            <span
                              className="text-xs"
                              style={{ color: t.descColor }}
                            >
                              Automated
                            </span>
                          </div>
                          <div
                            className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5"
                            style={{
                              background: 'rgba(255,255,255,0.8)',
                              border: '1px solid rgba(0,0,0,0.07)',
                            }}
                          >
                            <Check size={12} className="text-green-600" />
                            <span
                              className="text-xs"
                              style={{ color: t.descColor }}
                            >
                              All clear
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Floating stat chips */}
                <div
                  className="absolute -bottom-3 -left-2 flex items-center gap-2 rounded-full border px-3.5 py-1.5 backdrop-blur-md"
                  style={{
                    background: t.floatChipBg,
                    borderColor: t.floatChipBorder,
                    transform: 'translateZ(20px)',
                  }}
                >
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ background: t.floatChip1.color }}
                  />
                  <span
                    className="text-[11px]"
                    style={{ color: t.floatChipText }}
                  >
                    {t.floatChip1.label}
                  </span>
                  <span
                    className="text-[11px] font-bold"
                    style={{ color: t.floatChip1.color }}
                  >
                    {t.floatChip1.value}
                  </span>
                </div>
                <div
                  className="absolute -top-3 -right-2 flex items-center gap-2 rounded-full border px-3.5 py-1.5 backdrop-blur-md"
                  style={{
                    background: t.floatChipBg,
                    borderColor: t.floatChipBorder,
                    transform: 'translateZ(20px)',
                  }}
                >
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ background: t.floatChip2.color }}
                  />
                  <span
                    className="text-[11px]"
                    style={{ color: t.floatChipText }}
                  >
                    {t.floatChip2.label}
                  </span>
                  <span
                    className="text-[11px] font-bold"
                    style={{ color: t.floatChip2.color }}
                  >
                    {t.floatChip2.value}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
