/**
 * Performance measurement script — Playwright + CDP
 * Tests landing & product pages across device profiles.
 * Run: node perf-measure.mjs
 */

import { chromium } from '/Users/zopkit/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs'

const BASE_URL = 'http://localhost:3001'

const PAGES = [
  { name: 'Landing', path: '/landing' },
  { name: 'Product: Financial Accounting', path: '/products/financial-accounting' },
  { name: 'Product: B2B CRM', path: '/products/b2b-crm' },
]

const PROFILES = [
  { name: 'Desktop (no throttle)', width: 1440, height: 900, cpuSlowdown: 1 },
  { name: 'Mid Phone  (4× CPU)  ', width: 390,  height: 844, cpuSlowdown: 4 },
  { name: 'Low-end    (6× CPU)  ', width: 375,  height: 667, cpuSlowdown: 6 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ms(n) { return n == null ? '  —  ' : `${Math.round(n)}ms` }
function score(n) {
  if (n == null) return '?'
  if (n <= 1800) return '🟢'
  if (n <= 3000) return '🟡'
  return '🔴'
}
function clsScore(n) {
  if (n == null) return '?'
  if (n <= 0.1)  return '🟢'
  if (n <= 0.25) return '🟡'
  return '🔴'
}

// ─── Core measurement ─────────────────────────────────────────────────────────
async function measure(page, cdp, profile, path) {
  // Reset navigation timing metrics
  await page.evaluate(() => window.__perfReady = false)

  // Inject collectors before navigation
  await page.addInitScript(() => {
    window.__metrics = { fcp: null, lcp: null, cls: 0, longTasks: 0, tbt: 0 }

    // FCP
    new PerformanceObserver(list => {
      for (const e of list.getEntries())
        if (e.name === 'first-contentful-paint') window.__metrics.fcp = e.startTime
    }).observe({ type: 'paint', buffered: true })

    // LCP
    new PerformanceObserver(list => {
      const entries = list.getEntries()
      if (entries.length) window.__metrics.lcp = entries[entries.length - 1].startTime
    }).observe({ type: 'largest-contentful-paint', buffered: true })

    // CLS
    new PerformanceObserver(list => {
      for (const e of list.getEntries())
        if (!e.hadRecentInput) window.__metrics.cls += e.value
    }).observe({ type: 'layout-shift', buffered: true })

    // Long tasks → TBT proxy (blocking time > 50ms threshold)
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        window.__metrics.longTasks++
        window.__metrics.tbt += e.duration - 50
      }
    }).observe({ type: 'longtask', buffered: true })
  })

  // Apply CPU throttle via CDP
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuSlowdown })

  const t0 = Date.now()
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  const domReady = Date.now() - t0

  // Wait for load + a bit for LCP to settle
  try { await page.waitForLoadState('load', { timeout: 20000 }) } catch {}
  await page.waitForTimeout(2500)

  const loadTime = Date.now() - t0

  // Read nav timing + web vitals
  const result = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    return {
      ttfb:    nav ? Math.round(nav.responseStart - nav.requestStart) : null,
      domReady: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : null,
      fullLoad: nav ? Math.round(nav.loadEventEnd - nav.startTime) : null,
      ...(window.__metrics || {}),
    }
  })

  // Reset throttle
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })

  return { ...result, wallLoad: loadTime, wallDom: domReady }
}

// ─── Per-page test ────────────────────────────────────────────────────────────
async function testPage(browser, pageConfig) {
  const rows = []

  for (const profile of PROFILES) {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      // Disable caching to simulate first visit
      bypassCSP: true,
    })
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)

    // Clear cache/storage
    await cdp.send('Network.clearBrowserCache')
    await cdp.send('Network.clearBrowserCookies')

    let result
    try {
      result = await measure(page, cdp, profile, pageConfig.path)
    } catch (err) {
      result = { error: err.message }
    }

    rows.push({ profile: profile.name, ...result })
    await context.close()
  }

  return rows
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔍  Zopkit Performance Audit')
  console.log('━'.repeat(80))

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })

  for (const pageConfig of PAGES) {
    console.log(`\n📄  ${pageConfig.name}  (${BASE_URL}${pageConfig.path})`)
    console.log('─'.repeat(80))

    let rows
    try {
      rows = await testPage(browser, pageConfig)
    } catch (err) {
      console.error(`  ❌  Failed: ${err.message}`)
      continue
    }

    // Header
    console.log(
      'Profile'.padEnd(26),
      'TTFB'.padStart(7),
      'FCP'.padStart(8),
      'LCP'.padStart(8),
      'CLS'.padStart(6),
      'TBT'.padStart(7),
      'DOMReady'.padStart(10),
      'FullLoad'.padStart(10),
    )
    console.log('─'.repeat(80))

    for (const r of rows) {
      if (r.error) { console.log(`  ${r.profile}  ❌  ${r.error}`); continue }
      console.log(
        r.profile.padEnd(26),
        ms(r.ttfb).padStart(7),
        (score(r.fcp) + ' ' + ms(r.fcp)).padStart(8),
        (score(r.lcp) + ' ' + ms(r.lcp)).padStart(8),
        (clsScore(r.cls) + ' ' + (r.cls?.toFixed(3) ?? '—')).padStart(6),
        ms(r.tbt).padStart(7),
        ms(r.domReady || r.wallDom).padStart(10),
        ms(r.fullLoad || r.wallLoad).padStart(10),
      )
    }
  }

  await browser.close()

  console.log('\n━'.repeat(80))
  console.log('Legend:  🟢 Good  🟡 Needs work  🔴 Poor')
  console.log('FCP target < 1.8s  |  LCP target < 2.5s  |  CLS target < 0.1  |  TBT target < 200ms')
  console.log()
}

main().catch(err => { console.error(err); process.exit(1) })
