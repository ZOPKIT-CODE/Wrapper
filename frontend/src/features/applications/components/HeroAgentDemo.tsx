import {
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Application } from '@/types/application'

const S = '"Helvetica Neue", Helvetica, Arial, sans-serif'

type Reply =
  | { kind: 'text'; text: string }
  | { kind: 'bullets'; title?: string; items: string[] }
  | {
      kind: 'table'
      title?: string
      columns: string[]
      rows: string[][]
      badgeCol?: number
      note?: string
    }

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  reply: Reply
}

interface Scenario {
  id: string
  tab: string
  url: string
  intro: Reply
  quick: string[]
  respond: (prompt: string) => Reply
}

const PIPELINE_ROWS: string[][] = [
  ['1', 'Prospecting', 'Active'],
  ['2', 'Qualification', 'Active'],
  ['3', 'Demo Scheduled', 'Active'],
  ['4', 'Proposal Sent', 'Active'],
  ['5', 'Negotiation', 'Negotiation'],
  ['6', 'Closed Won', 'Won'],
  ['7', 'Closed Lost', 'Lost'],
]

const INVOICE_ROWS: string[][] = [
  ['#1041', 'Acme Corp', '$12,400', '12d'],
  ['#1038', 'Globex', '$8,950', '21d'],
  ['#1032', 'Initech', '$3,200', '34d'],
]

function crmRespond(prompt: string): Reply {
  const p = prompt.toLowerCase()
  if (/pipe|stage|summar|overview/.test(p))
    return {
      kind: 'table',
      title: 'Sales pipeline',
      columns: ['#', 'Stage', 'Status'],
      rows: PIPELINE_ROWS,
      badgeCol: 2,
      note: '7 stages · 42 open opportunities · $1.2M weighted',
    }
  if (/stuck|stall|stale|idle|risk/.test(p))
    return {
      kind: 'bullets',
      title: '3 deals stalled over 14 days',
      items: [
        'Acme Corp — Negotiation · 18d no activity',
        'Globex — Proposal Sent · 21d no activity',
        'Initech — Demo Scheduled · 16d no activity',
      ],
    }
  if (/follow|draft|email|reply|message/.test(p))
    return {
      kind: 'text',
      text: 'Drafted a follow-up to Acme Corp: “Hi Dana — circling back on the proposal we sent on the 12th. Happy to walk your team through pricing this week. Does Thursday at 2pm work?”',
    }
  if (/lead|contact|create|add|new/.test(p))
    return {
      kind: 'text',
      text: 'Created lead “New Lead” in Prospecting and assigned it to you. Want me to attach a contact and a first task?',
    }
  return {
    kind: 'text',
    text: `On it. For “${prompt}” I can summarize the pipeline, surface stalled deals, draft a follow-up, or create a lead — just pick one or ask.`,
  }
}

function acctRespond(prompt: string): Reply {
  const p = prompt.toLowerCase()
  if (/cash|balance|position|runway/.test(p))
    return {
      kind: 'bullets',
      title: 'Cash position — today',
      items: [
        'Operating account: $248,300',
        'Reserve: $120,000',
        'Expected Net-30 inflows: $86,400',
      ],
    }
  if (/overdue|invoice|receivable|\bar\b|owed/.test(p))
    return {
      kind: 'table',
      title: 'Overdue invoices',
      columns: ['Invoice', 'Customer', 'Amount', 'Overdue'],
      rows: INVOICE_ROWS,
      note: '3 invoices · $24,550 outstanding',
    }
  if (/p&l|pnl|profit|loss|p and l|summar|income|statement/.test(p))
    return {
      kind: 'bullets',
      title: 'P&L — last month',
      items: [
        'Revenue: $412,000',
        'COGS: $173,000',
        'Operating expenses: $128,000',
        'Net income: $111,000 (+9% MoM)',
      ],
    }
  if (/payroll|salary|wages|pay run/.test(p))
    return {
      kind: 'text',
      text: 'Drafted payroll for 24 employees — $96,200 gross, $71,540 net. Nothing is submitted yet; review and approve when you’re ready.',
    }
  return {
    kind: 'text',
    text: `Sure. For “${prompt}” I can show the cash position, overdue invoices, a P&L summary, or draft payroll — choose one or ask.`,
  }
}

const CRM_SCENARIO: Scenario = {
  id: 'crm',
  tab: 'CRM',
  url: 'app.zopkit.com/crm',
  intro: {
    kind: 'text',
    text: 'Hi — I’m your Zopkit agent for CRM. Ask about your pipeline, deals, or contacts.',
  },
  quick: [
    'Summarize pipeline',
    'Stuck deals',
    'Draft follow-up',
    'Create lead',
  ],
  respond: crmRespond,
}

const ACCT_SCENARIO: Scenario = {
  id: 'acct',
  tab: 'Accounting',
  url: 'app.zopkit.com/accounting',
  intro: {
    kind: 'text',
    text: 'I’m your Accounting agent. Ask about cash, invoices, P&L, or payroll.',
  },
  quick: ['Cash position', 'Overdue invoices', 'P&L summary', 'Run payroll'],
  respond: acctRespond,
}

export function buildScenarios(applications: Application[]): Scenario[] {
  const made: Scenario[] = []
  const seen = new Set<string>()
  for (const app of applications) {
    const key = (app.appCode || '').toLowerCase().replace(/[^a-z]/g, '')
    if (key.includes('crm') && !seen.has('crm')) {
      made.push({ ...CRM_SCENARIO, tab: app.appName || CRM_SCENARIO.tab })
      seen.add('crm')
    } else if (
      (key.includes('account') || key.includes('finance')) &&
      !seen.has('acct')
    ) {
      made.push({ ...ACCT_SCENARIO, tab: app.appName || ACCT_SCENARIO.tab })
      seen.add('acct')
    }
    if (made.length >= 3) break
  }
  if (made.length === 0) return [CRM_SCENARIO, ACCT_SCENARIO]
  return made
}

function badgeColors(value: string): [string, string] {
  const t = value.toLowerCase()
  if (t === 'won') return ['#059669', '#d1fae5']
  if (t === 'lost') return ['#dc2626', '#fee2e2']
  if (t === 'negotiation') return ['#d97706', '#fef3c7']
  return ['#16a34a', '#dcfce7']
}

const ReplyBody = memo(function ReplyBody({ reply }: { reply: Reply }) {
  if (reply.kind === 'text') {
    return <span>{reply.text}</span>
  }
  if (reply.kind === 'bullets') {
    return (
      <div>
        {reply.title && (
          <div className="zkm-agent-reply-title">{reply.title}</div>
        )}
        <ul className="zkm-agent-reply-list">
          {reply.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>
    )
  }
  return (
    <div>
      {reply.title && (
        <div className="zkm-agent-reply-title">{reply.title}</div>
      )}
      <div className="zkm-agent-table">
        <div className="zkm-agent-table-head">
          {reply.columns.map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </div>
        {reply.rows.map((row, ri) => (
          <div key={ri} className="zkm-agent-table-row">
            {row.map((cell, ci) => {
              const isBadge = reply.badgeCol === ci
              if (isBadge) {
                const [fg, bg] = badgeColors(cell)
                return (
                  <span key={ci} style={{ flex: 1, display: 'flex' }}>
                    <span
                      style={{
                        background: bg,
                        color: fg,
                        borderRadius: 5,
                        padding: '1px 7px',
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {cell}
                    </span>
                  </span>
                )
              }
              return (
                <span
                  key={ci}
                  className={`zkm-agent-table-cell${ci === 0 ? 'zkm-agent-table-cell--index' : ci === 1 ? 'zkm-agent-table-cell--strong' : ''}`}
                >
                  {cell}
                </span>
              )
            })}
          </div>
        ))}
      </div>
      {reply.note && <div className="zkm-agent-table-note">{reply.note}</div>}
    </div>
  )
})

const MessageRow = memo(function MessageRow({
  message,
}: {
  message: ChatMessage
}) {
  const isUser = message.role === 'user'
  return (
    <div className={`zkm-agent-msg${isUser ? 'zkm-agent-msg--user' : ''}`}>
      <div
        aria-hidden="true"
        className={`zkm-agent-avatar${isUser ? 'zkm-agent-avatar--user' : 'zkm-agent-avatar--bot'}`}
      >
        {isUser ? 'You' : 'Z'}
      </div>
      <div
        className={`zkm-agent-bubble${isUser ? 'zkm-agent-bubble--user' : 'zkm-agent-bubble--assistant'}`}
      >
        <ReplyBody reply={message.reply} />
      </div>
    </div>
  )
})

export const HeroAgentDemo = memo(function HeroAgentDemo({
  scenarios,
}: {
  scenarios: Scenario[]
}) {
  const [tab, setTab] = useState(0)
  const scenario = scenarios[tab] ?? scenarios[0]
  const idRef = useRef(0)
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: 0, role: 'assistant', reply: scenarios[0].intro },
  ])
  const [input, setInput] = useState('')
  const threadRef = useRef<HTMLDivElement>(null)

  const nextId = () => (idRef.current += 1)

  const selectTab = useCallback(
    (i: number) => {
      setTab(i)
      idRef.current = 0
      setMessages([{ id: 0, role: 'assistant', reply: scenarios[i].intro }])
      setInput('')
    },
    [scenarios]
  )

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim()
      if (!text) return
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'user', reply: { kind: 'text', text } },
        { id: nextId(), role: 'assistant', reply: scenario.respond(text) },
      ])
      setInput('')
    },
    [scenario]
  )

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      send(input)
    },
    [input, send]
  )

  useLayoutEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  return (
    <div className="zkm-agent-wrap">
      <div className="zkm-agent-frame">
        <div className="zkm-agent-chrome">
          <div className="zkm-agent-traffic" aria-hidden="true">
            <i className="zkm-agent-dot zkm-agent-dot--close" />
            <i className="zkm-agent-dot zkm-agent-dot--min" />
            <i className="zkm-agent-dot zkm-agent-dot--max" />
          </div>
          <div className="zkm-agent-url-bar">{scenario.url}</div>
        </div>

        {scenarios.length > 1 && (
          <div role="tablist" aria-label="Demo app" className="zkm-agent-tabs">
            {scenarios.map((sc, i) => (
              <button
                key={sc.id}
                role="tab"
                aria-selected={i === tab}
                tabIndex={i === tab ? 0 : -1}
                className="zkm-agent-tab-btn"
                onClick={() => selectTab(i)}
                style={{ fontFamily: S }}
              >
                {sc.tab}
              </button>
            ))}
          </div>
        )}

        <div className="zkm-agent-surface">
          <div className="zkm-agent-status">
            <span className="zkm-agent-status-dot" aria-hidden="true" />
            <span className="zkm-agent-status-label">connected</span>
            <span className="zkm-agent-status-sep" aria-hidden="true">
              ·
            </span>
            <span className="zkm-agent-status-meta">live data</span>
          </div>

          <div
            ref={threadRef}
            role="log"
            aria-live="polite"
            aria-label="Agent conversation"
            className="zkm-agent-thread"
          >
            {messages.map((m) => (
              <MessageRow key={m.id} message={m} />
            ))}
          </div>

          <div className="zkm-agent-quick-row">
            {scenario.quick.map((q) => (
              <button
                key={q}
                type="button"
                className="zkm-agent-quick-btn zkm-quick"
                onClick={() => send(q)}
                style={{ fontFamily: S }}
              >
                + {q}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="zkm-agent-form">
            <div className="zkm-agent-input-row zkm-input">
              <input
                className="zkm-agent-input zkm-textinput"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about a deal, an invoice — or type a request"
                aria-label="Message the Zopkit agent"
                style={{ fontFamily: S }}
              />
              <button
                type="submit"
                className="zkm-agent-send zkm-send"
                disabled={!input.trim()}
                aria-label="Send message"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M12 19V5M5 12l7-7 7 7"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
})
