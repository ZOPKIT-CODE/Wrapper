/**
 * Email Template Preview & Test Tool
 * Route: /dev/email-preview
 *
 * A developer tool — remove the route from router.tsx when done.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Mail, Send, RefreshCw, CheckCircle, AlertCircle,
  Loader2, Monitor, Smartphone, ExternalLink, Copy, ChevronRight
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
  Onboarding:    'bg-blue-100 text-blue-700 border-blue-200',
  Billing:       'bg-emerald-100 text-emerald-700 border-emerald-200',
  Subscriptions: 'bg-violet-100 text-violet-700 border-violet-200',
  general:       'bg-slate-100 text-slate-600 border-slate-200',
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
    <aside className="w-64 shrink-0 flex flex-col border-r border-slate-200 bg-white overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5 mb-0.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0a1628] to-blue-600 flex items-center justify-center">
            <Mail className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-sm">Email Templates</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {loading ? 'Loading…' : `${templates.length} templates`}
        </p>
      </div>

      {/* Groups */}
      <div className="flex-1 px-2 py-3 space-y-4">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse space-y-1.5 px-2">
                <div className="h-3 w-20 bg-slate-100 rounded" />
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-8 bg-slate-50 rounded-lg" />
                ))}
              </div>
            ))
          : Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <p className="px-2 mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {cat}
                </p>
                {items.map(t => (
                  <button
                    key={t.id}
                    onClick={() => onSelect(t.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all ${
                      active === t.id
                        ? 'bg-[#0a1628] text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-medium truncate">{t.label}</span>
                    {active === t.id && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />}
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
      await api.post('/email-preview/send-test', { template: templateId, sendTo: email })
      setLastSent(email)
      toast.success(`Test email sent to ${email}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Failed to send test email')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      {/* Template badge */}
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[category] ?? CATEGORY_COLORS.general}`}>
          {category}
        </span>
        <span className="text-sm font-semibold text-slate-800 truncate">{templateLabel}</span>
      </div>

      {/* Email input + send */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-500">Send test to</label>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            className="flex-1 h-9 text-sm"
          />
          <Button
            onClick={handleSend}
            disabled={sending}
            size="sm"
            className="h-9 px-4 text-white font-semibold"
            style={{ background: 'linear-gradient(135deg, #0a1628, #2563EB)' }}
          >
            {sending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <><Send className="h-3.5 w-3.5 mr-1.5" />Send</>}
          </Button>
        </div>
      </div>

      {lastSent && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
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
  const _rawBase = (import.meta.env.VITE_API_URL || 'http://localhost:3000') as string
  const baseUrl = _rawBase.endsWith('/api') ? _rawBase.slice(0, -4) : _rawBase

  // Load template list
  useEffect(() => {
    api.get('/email-preview/templates')
      .then(res => {
        setTemplates(res.data.templates)
        if (res.data.templates.length > 0) setActiveId(res.data.templates[0].id)
      })
      .catch(() => toast.error('Failed to load email templates'))
      .finally(() => setLoadingList(false))
  }, [])

  const activeTemplate = templates.find(t => t.id === activeId)

  const previewUrl = activeId ? `${baseUrl}/api/email-preview/render?template=${activeId}` : ''

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
    <div className="flex h-screen flex-col bg-slate-50 overflow-hidden">
      {/* ── Top bar ── */}
      <header className="flex items-center gap-4 px-5 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg border border-white/25 bg-white shadow-sm p-1 flex items-center justify-center ring-1 ring-slate-200">
            <img src={ONBOARDING_LOGO_URL} alt="Zopkit" className="h-full w-full object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-none">Email Preview</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Developer tool</p>
          </div>
        </div>

        <div className="flex-1" />

        {/* Viewport toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          {([['desktop', Monitor], ['mobile', Smartphone]] as const).map(([v, Icon]) => (
            <button
              key={v}
              onClick={() => setViewport(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewport === v ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
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
            <Button variant="outline" size="sm" onClick={handleReload} className="h-8 text-xs gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />Reload
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyLink} className="h-8 text-xs gap-1.5">
              <Copy className="h-3.5 w-3.5" />Copy URL
            </Button>
            <a href={previewUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />Open
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
          <div className="flex-1 flex items-start justify-center p-6 overflow-auto bg-[#f1f5f9]">
            {!activeId ? (
              <div className="text-center py-20 text-slate-400">
                <Mail className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a template to preview</p>
              </div>
            ) : (
              <div
                className={`relative bg-white shadow-xl rounded-xl overflow-hidden transition-all duration-300 ${
                  viewport === 'mobile' ? 'w-[390px]' : 'w-full max-w-3xl'
                }`}
                style={{ minHeight: 500 }}
              >
                {/* Loading overlay */}
                {previewLoading && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  </div>
                )}

                {/* Error state */}
                {previewError && !previewLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                    <AlertCircle className="h-8 w-8 text-red-400 mb-3" />
                    <p className="text-sm font-medium text-slate-700">Failed to render template</p>
                    <p className="text-xs text-slate-400 mt-1">{previewError}</p>
                    <Button variant="outline" size="sm" onClick={handleReload} className="mt-4">
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Try again
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
                      setPreviewError('Could not load preview — is the backend running?')
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
          <aside className="w-72 shrink-0 flex flex-col border-l border-slate-200 bg-white overflow-y-auto">
            <div className="px-4 py-5 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">{activeTemplate.label}</h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{activeTemplate.description}</p>
            </div>

            <div className="p-4 space-y-4">
              {/* Send test */}
              <SendPanel
                templateId={activeId}
                templateLabel={activeTemplate.label}
                category={activeTemplate.category}
              />

              {/* Info */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2.5 text-xs text-slate-500">
                <p className="font-semibold text-slate-700 text-[11px] uppercase tracking-widest">Template info</p>
                <div className="flex justify-between">
                  <span>ID</span>
                  <code className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">{activeId}</code>
                </div>
                <div className="flex justify-between">
                  <span>Category</span>
                  <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[activeTemplate.category] ?? ''}`}>
                    {activeTemplate.category}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Viewport</span>
                  <span className="font-medium text-slate-700 capitalize">{viewport}</span>
                </div>
              </div>

              {/* Note */}
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700 leading-relaxed">
                <strong>Dev only.</strong> Remove the <code className="bg-amber-100 px-1 rounded">/dev/email-preview</code> route from <code className="bg-amber-100 px-1 rounded">router.tsx</code> before going to production.
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
