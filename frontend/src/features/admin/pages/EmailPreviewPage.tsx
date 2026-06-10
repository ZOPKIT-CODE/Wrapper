/**
 * Email Template Preview & Test Tool
 * Route: /dev/email-preview
 *
 * A developer tool — remove the route from router.tsx when done.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Mail,
  Send,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Monitor,
  Smartphone,
  ExternalLink,
  Copy,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { ONBOARDING_LOGO_URL } from '@/lib/config'

// ── Types ─────────────────────────────────────────────────────────────────────
interface TemplateInfo {
  id: string
  label: string
  description: string
  category: string
}

// ── Category colours ──────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  Onboarding: 'bg-blue-100 text-blue-700 border-blue-200',
  Billing: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Subscriptions: 'bg-violet-100 text-violet-700 border-violet-200',
  general: 'bg-slate-100 text-slate-600 border-slate-200',
}

// ── Sidebar template list ─────────────────────────────────────────────────────
function TemplateSidebar({
  templates,
  active,
  loading,
  onSelect,
}: {
  templates: TemplateInfo[]
  active: string
  loading: boolean
  onSelect: (id: string) => void
}) {
  const grouped = templates.reduce<Record<string, TemplateInfo[]>>((acc, t) => {
    const cat = t.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(t)
    return acc
  }, {})

  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white">
      {/* Header */}
      <div className="border-b border-slate-100 px-4 py-5">
        <div className="mb-0.5 flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#0a1628] to-blue-600">
            <Mail className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-slate-900">
            Email Templates
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {loading ? 'Loading…' : `${templates.length} templates`}
        </p>
      </div>

      {/* Groups */}
      <div className="flex-1 space-y-4 px-2 py-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse space-y-1.5 px-2">
                <div className="h-3 w-20 rounded bg-slate-100" />
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-8 rounded-lg bg-slate-50" />
                ))}
              </div>
            ))
          : Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <p className="mb-1 px-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  {cat}
                </p>
                {items.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onSelect(t.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all ${
                      active === t.id
                        ? 'bg-[#0a1628] text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate font-medium">{t.label}</span>
                    {active === t.id && (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    )}
                  </button>
                ))}
              </div>
            ))}
      </div>
    </aside>
  )
}

// ── Send test panel ───────────────────────────────────────────────────────────
function SendPanel({
  templateId,
  templateLabel,
  category,
}: {
  templateId: string
  templateLabel: string
  category: string
}) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [lastSent, setLastSent] = useState<string | null>(null)

  const handleSend = async () => {
    if (!email.includes('@')) {
      toast.error('Enter a valid email address')
      return
    }
    setSending(true)
    try {
      await api.post('/email-preview/send-test', {
        template: templateId,
        sendTo: email,
      })
      setLastSent(email)
      toast.success(`Test email sent to ${email}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error
      toast.error(msg || 'Failed to send test email')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      {/* Template badge */}
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${CATEGORY_COLORS[category] ?? CATEGORY_COLORS.general}`}
        >
          {category}
        </span>
        <span className="truncate text-sm font-semibold text-slate-800">
          {templateLabel}
        </span>
      </div>

      {/* Email input + send */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-500">
          Send test to
        </label>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="h-9 flex-1 text-sm"
          />
          <Button
            onClick={handleSend}
            disabled={sending}
            size="sm"
            className="h-9 px-4 font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #0a1628, #2563EB)' }}
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Send
              </>
            )}
          </Button>
        </div>
      </div>

      {lastSent && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-600">
          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
          Last sent to <strong>{lastSent}</strong>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function EmailPreviewPage() {
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [activeId, setActiveId] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop')
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // Strip trailing /api if present so previewUrl doesn't double-up (/api/api/...)
  const _rawBase = (import.meta.env.VITE_API_URL ||
    'http://localhost:3000') as string
  const baseUrl = _rawBase.endsWith('/api') ? _rawBase.slice(0, -4) : _rawBase

  // Load template list
  useEffect(() => {
    api
      .get('/email-preview/templates')
      .then((res) => {
        setTemplates(res.data.templates)
        if (res.data.templates.length > 0) setActiveId(res.data.templates[0].id)
      })
      .catch(() => toast.error('Failed to load email templates'))
      .finally(() => setLoadingList(false))
  }, [])

  const activeTemplate = templates.find((t) => t.id === activeId)

  const previewUrl = activeId
    ? `${baseUrl}/api/email-preview/render?template=${activeId}`
    : ''

  const handleReload = useCallback(() => {
    if (!iframeRef.current || !activeId) return
    setPreviewLoading(true)
    setPreviewError(null)
    iframeRef.current.src = previewUrl + '&_t=' + Date.now()
  }, [activeId, previewUrl])

  const handleCopyLink = () => {
    navigator.clipboard.writeText(previewUrl)
    toast.success('Preview URL copied')
  }

  const handleSelect = (id: string) => {
    setActiveId(id)
    setPreviewLoading(true)
    setPreviewError(null)
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      {/* ── Top bar ── */}
      <header className="flex shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/25 bg-white p-1 shadow-sm ring-1 ring-slate-200">
            <img
              src={ONBOARDING_LOGO_URL}
              alt="Zopkit"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-sm leading-none font-bold text-slate-900">
              Email Preview
            </h1>
            <p className="mt-0.5 text-[11px] text-slate-400">Developer tool</p>
          </div>
        </div>

        <div className="flex-1" />

        {/* Viewport toggle */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
          {(
            [
              ['desktop', Monitor],
              ['mobile', Smartphone],
            ] as const
          ).map(([v, Icon]) => (
            <button
              key={v}
              onClick={() => setViewport(v)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                viewport === v
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="capitalize">{v}</span>
            </button>
          ))}
        </div>

        {/* Actions */}
        {activeId && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReload}
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reload
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="h-8 gap-1.5 text-xs"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy URL
            </Button>
            <a href={previewUrl} target="_blank" rel="noreferrer">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open
              </Button>
            </a>
          </div>
        )}
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <TemplateSidebar
          templates={templates}
          active={activeId}
          loading={loadingList}
          onSelect={handleSelect}
        />

        {/* Preview area */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Preview canvas */}
          <div className="flex flex-1 items-start justify-center overflow-auto bg-[#f1f5f9] p-6">
            {!activeId ? (
              <div className="py-20 text-center text-slate-400">
                <Mail className="mx-auto mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm">Select a template to preview</p>
              </div>
            ) : (
              <div
                className={`relative overflow-hidden rounded-xl bg-white shadow-xl transition-all duration-300 ${
                  viewport === 'mobile' ? 'w-[390px]' : 'w-full max-w-3xl'
                }`}
                style={{ minHeight: 500 }}
              >
                {/* Loading overlay */}
                {previewLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  </div>
                )}

                {/* Error state */}
                {previewError && !previewLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                    <AlertCircle className="mb-3 h-8 w-8 text-red-400" />
                    <p className="text-sm font-medium text-slate-700">
                      Failed to render template
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {previewError}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReload}
                      className="mt-4"
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Try again
                    </Button>
                  </div>
                )}

                {/* Iframe */}
                {!previewError && (
                  <iframe
                    ref={iframeRef}
                    key={activeId}
                    src={previewUrl}
                    title={`Preview: ${activeTemplate?.label}`}
                    className="w-full border-0"
                    style={{ height: viewport === 'mobile' ? 700 : 900 }}
                    onLoad={() => setPreviewLoading(false)}
                    onError={() => {
                      setPreviewLoading(false)
                      setPreviewError(
                        'Could not load preview — is the backend running?'
                      )
                    }}
                    sandbox="allow-same-origin allow-scripts"
                  />
                )}
              </div>
            )}
          </div>
        </main>

        {/* Right panel */}
        {activeTemplate && (
          <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-5">
              <h2 className="text-sm font-bold text-slate-900">
                {activeTemplate.label}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {activeTemplate.description}
              </p>
            </div>

            <div className="space-y-4 p-4">
              {/* Send test */}
              <SendPanel
                templateId={activeId}
                templateLabel={activeTemplate.label}
                category={activeTemplate.category}
              />

              {/* Info */}
              <div className="space-y-2.5 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-500">
                <p className="text-[11px] font-semibold tracking-widest text-slate-700 uppercase">
                  Template info
                </p>
                <div className="flex justify-between">
                  <span>ID</span>
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-800">
                    {activeId}
                  </code>
                </div>
                <div className="flex justify-between">
                  <span>Category</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${CATEGORY_COLORS[activeTemplate.category] ?? ''}`}
                  >
                    {activeTemplate.category}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Viewport</span>
                  <span className="font-medium text-slate-700 capitalize">
                    {viewport}
                  </span>
                </div>
              </div>

              {/* Note */}
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-relaxed text-amber-700">
                <strong>Dev only.</strong> Remove the{' '}
                <code className="rounded bg-amber-100 px-1">
                  /dev/email-preview
                </code>{' '}
                route from{' '}
                <code className="rounded bg-amber-100 px-1">router.tsx</code>{' '}
                before going to production.
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
