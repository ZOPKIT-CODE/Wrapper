export function getFAFeatureSvg(i: number): React.ReactNode {
  // Design tokens — per FA screen brief 2026-04-26
  const NAV = '#0d1f3a' // collapsed sidebar rail
  const W = '#FFFFFF' // content background
  const BD = '#E2E8F0'
  const H = '#0F172A'
  const M = '#64748B'
  const PRM = '#1B2E5A'
  const POS = '#10B981'
  const WARN = '#F59E0B'
  const NEG = '#EF4444'
  const ff = 'system-ui,-apple-system,sans-serif'

  // 28px collapsed sidebar (per brief)
  const Sb = () => (
    <g>
      <rect width="28" height="480" fill={NAV} />
      <rect x="7" y="8" width="14" height="14" rx="3" fill="#3B82F6" />
      {[0, 1, 2, 3, 4].map((j) => (
        <g key={j}>
          <rect
            x="8"
            y={34 + j * 36}
            width="12"
            height="2.5"
            rx="1.25"
            fill="rgba(255,255,255,0.25)"
          />
          <rect
            x="8"
            y={39.5 + j * 36}
            width="8"
            height="1.5"
            rx="0.75"
            fill="rgba(255,255,255,0.12)"
          />
        </g>
      ))}
      <circle cx="14" cy="462" r="7" fill="rgba(255,255,255,0.12)" />
    </g>
  )

  // Header bar
  const Hdr = (title: string, crumb: string, btn?: string) => (
    <g>
      <rect x="28" y="0" width="772" height="44" fill={W} />
      <line x1="28" y1="44" x2="800" y2="44" stroke={BD} strokeWidth="0.5" />
      <text
        x="40"
        y="18"
        fontFamily={ff}
        fontSize="13"
        fontWeight="700"
        fill={H}
      >
        {title}
      </text>
      <text x="40" y="34" fontFamily={ff} fontSize="9" fill={M}>
        {crumb}
      </text>
      {btn && (
        <>
          <rect
            x={796 - btn.length * 6 - 14}
            y="11"
            width={btn.length * 6 + 14}
            height="22"
            rx="5"
            fill={PRM}
          />
          <text
            x={796 - btn.length * 3}
            y="25"
            fontFamily={ff}
            fontSize="9"
            fontWeight="600"
            fill={W}
            textAnchor="middle"
          >
            {btn}
          </text>
        </>
      )}
    </g>
  )

  // 4-wide KPI (x: 36,226,416,606 | w=182)
  const K4 = (
    x: number,
    y: number,
    lbl: string,
    val: string,
    help: string,
    hc = M
  ) => (
    <g key={`k${x}`}>
      <rect
        x={x}
        y={y}
        width="182"
        height="66"
        rx="6"
        fill={W}
        stroke={BD}
        strokeWidth="1"
      />
      <text
        x={x + 12}
        y={y + 15}
        fontFamily={ff}
        fontSize="7.5"
        fontWeight="700"
        fill={M}
        letterSpacing="0.06em"
      >
        {lbl}
      </text>
      <text
        x={x + 12}
        y={y + 39}
        fontFamily={ff}
        fontSize="17"
        fontWeight="700"
        fill={H}
      >
        {val}
      </text>
      <text x={x + 12} y={y + 54} fontFamily={ff} fontSize="8.5" fill={hc}>
        {help}
      </text>
    </g>
  )

  // 3-wide KPI (x: 36,289,542 | w=245)
  const K3 = (
    x: number,
    y: number,
    lbl: string,
    val: string,
    help: string,
    hc = M
  ) => (
    <g key={`k${x}`}>
      <rect
        x={x}
        y={y}
        width="245"
        height="66"
        rx="6"
        fill={W}
        stroke={BD}
        strokeWidth="1"
      />
      <text
        x={x + 12}
        y={y + 15}
        fontFamily={ff}
        fontSize="7.5"
        fontWeight="700"
        fill={M}
        letterSpacing="0.06em"
      >
        {lbl}
      </text>
      <text
        x={x + 12}
        y={y + 39}
        fontFamily={ff}
        fontSize="17"
        fontWeight="700"
        fill={H}
      >
        {val}
      </text>
      <text x={x + 12} y={y + 54} fontFamily={ff} fontSize="8.5" fill={hc}>
        {help}
      </text>
    </g>
  )

  // Status pill
  const Pill = (
    x: number,
    y: number,
    text: string,
    bg: string,
    tc: string,
    pw = 44
  ) => (
    <g key={`p${x}${y}`}>
      <rect x={x} y={y - 11} width={pw} height="15" rx="7" fill={bg} />
      <text
        x={x + pw / 2}
        y={y + 1}
        fontFamily={ff}
        fontSize="8.5"
        fontWeight="600"
        fill={tc}
        textAnchor="middle"
      >
        {text}
      </text>
    </g>
  )

  const ThRow = (y: number, x = 36, w = 752) => (
    <rect
      x={x}
      y={y}
      width={w}
      height="22"
      rx="4"
      fill="#F8FAFC"
      stroke={BD}
      strokeWidth="0.5"
    />
  )

  const Tr = (y: number, even: boolean, x = 36, w = 752) => (
    <rect
      x={x}
      y={y}
      width={w}
      height="32"
      rx="3"
      fill={even ? W : '#F8FAFC'}
      stroke={BD}
      strokeWidth="0.5"
    />
  )

  const T = (
    x: number,
    y: number,
    txt: string,
    sz = 9.5,
    bold = false,
    color = H,
    anchor: 'start' | 'middle' | 'end' = 'start'
  ) => (
    <text
      key={`t${x}${y}${txt.slice(0, 8)}`}
      x={x}
      y={y}
      fontFamily={ff}
      fontSize={sz}
      fontWeight={bold ? '700' : '400'}
      fill={color}
      textAnchor={anchor}
    >
      {txt}
    </text>
  )

  switch (i) {
    // ── 0. General Ledger ───────────────────────────────────────────────────
    case 0:
      return (
        <svg
          viewBox="0 0 800 480"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
        >
          <rect width="800" height="480" fill={W} />
          <Sb />
          {Hdr(
            'General Ledger',
            '0 entries · Complete transaction history with running balances',
            '+ New JV'
          )}
          {K4(36, 52, 'TOTAL ENTRIES', '0', 'No entries yet')}
          {K4(226, 52, 'TOTAL DEBITS', '₹2,84,50,000', 'Current period')}
          {K4(416, 52, 'TOTAL CREDITS', '₹2,84,50,000', 'Current period')}
          {K4(606, 52, 'PERIOD BALANCE', '₹0', '✓ Balanced', POS)}
          {ThRow(126)}
          {T(48, 141, 'DATE', 7.5, true, M)}
          {T(112, 141, 'ENTRY #', 7.5, true, M)}
          {T(192, 141, 'ACCOUNT', 7.5, true, M)}
          {T(360, 141, 'DESCRIPTION', 7.5, true, M)}
          {T(530, 141, 'DEBIT', 7.5, true, M)}
          {T(616, 141, 'CREDIT', 7.5, true, M)}
          {T(700, 141, 'BALANCE', 7.5, true, M)}
          {(
            [
              {
                dt: 'Apr 26',
                no: 'JE-0142',
                acct: '1100 Cash',
                desc: 'Customer receipt',
                dr: '₹1,20,000',
                cr: '—',
                bal: '₹50,10,000',
              },
              {
                dt: 'Apr 25',
                no: 'JE-0141',
                acct: '4000 Revenue',
                desc: 'Sales invoice INV-22',
                dr: '—',
                cr: '₹3,40,000',
                bal: '₹48,90,000',
              },
              {
                dt: 'Apr 25',
                no: 'JE-0140',
                acct: '2100 AP',
                desc: 'Vendor bill BL-7820',
                dr: '—',
                cr: '₹80,000',
                bal: '₹48,10,000',
              },
              {
                dt: 'Apr 24',
                no: 'JE-0139',
                acct: '6000 Salaries',
                desc: 'April payroll',
                dr: '₹2,10,000',
                cr: '—',
                bal: '₹50,20,000',
              },
              {
                dt: 'Apr 24',
                no: 'JE-0138',
                acct: '3000 Capital',
                desc: 'Owner contribution',
                dr: '—',
                cr: '₹5,00,000',
                bal: '₹55,20,000',
              },
            ] as const
          ).map((r, idx) => (
            <g key={idx}>
              {Tr(148 + idx * 34, idx % 2 === 0)}
              {T(48, 168 + idx * 34, r.dt, 9, false, M)}
              {T(112, 168 + idx * 34, r.no, 9, true, PRM)}
              {T(192, 168 + idx * 34, r.acct, 9)}
              {T(360, 168 + idx * 34, r.desc, 9, false, M)}
              {T(530, 168 + idx * 34, r.dr, 9.5, r.dr !== '—')}
              {T(616, 168 + idx * 34, r.cr, 9.5, r.cr !== '—')}
              {T(700, 168 + idx * 34, r.bal, 9.5, true)}
            </g>
          ))}
          <rect
            x="36"
            y="322"
            width="752"
            height="26"
            rx="5"
            fill="#ECFDF5"
            stroke="#A7F3D0"
            strokeWidth="0.5"
          />
          {T(48, 339, 'Trial Balance Reconciled ✓', 9, true, '#047857')}
          {T(788, 339, 'Debits = Credits · Apr 2026', 9, false, M, 'end')}
        </svg>
      )

    // ── 1. Multi-Entity Management ──────────────────────────────────────────
    case 1:
      return (
        <svg
          viewBox="0 0 800 480"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
        >
          <rect width="800" height="480" fill={W} />
          <Sb />
          {Hdr(
            'Entity Management',
            'Manage your group structure and consolidations',
            '+ Add Entity'
          )}
          {K4(36, 52, 'TOTAL ENTITIES', '6', 'All registered')}
          {K4(226, 52, 'ACTIVE', '6', 'Currently running')}
          {K4(416, 52, 'SUBSIDIARIES', '4', 'Under group')}
          {K4(606, 52, 'COUNTRIES', '3', 'IN · US · SG')}
          {/* Org tree */}
          <rect
            x="36"
            y="130"
            width="296"
            height="334"
            rx="6"
            fill={W}
            stroke={BD}
            strokeWidth="1"
          />
          {T(52, 150, 'Group Structure', 11, true, H)}
          <rect x="88" y="162" width="152" height="34" rx="6" fill={PRM} />
          {T(164, 183, 'Group HoldCo', 10, true, W, 'middle')}
          <line
            x1="164"
            y1="196"
            x2="164"
            y2="218"
            stroke={BD}
            strokeWidth="1.5"
          />
          <line
            x1="76"
            y1="218"
            x2="252"
            y2="218"
            stroke={BD}
            strokeWidth="1.5"
          />
          <line
            x1="76"
            y1="218"
            x2="76"
            y2="234"
            stroke={BD}
            strokeWidth="1.5"
          />
          <line
            x1="164"
            y1="218"
            x2="164"
            y2="234"
            stroke={BD}
            strokeWidth="1.5"
          />
          <line
            x1="252"
            y1="218"
            x2="252"
            y2="234"
            stroke={BD}
            strokeWidth="1.5"
          />
          {[
            { x: 40, label: 'IN-Subsidiary', sub: 'TCS India' },
            { x: 128, label: 'US-Subsidiary', sub: 'Acme LLC' },
            { x: 216, label: 'SG-Subsidiary', sub: 'Acme Pte' },
          ].map((c, idx) => (
            <g key={idx}>
              <rect
                x={c.x}
                y="234"
                width="80"
                height="40"
                rx="5"
                fill="#F8FAFC"
                stroke={BD}
                strokeWidth="1"
              />
              {T(c.x + 40, 251, c.label, 7.5, true, H, 'middle')}
              {T(c.x + 40, 264, c.sub, 7, false, M, 'middle')}
            </g>
          ))}
          <rect x="44" y="290" width="280" height="20" rx="4" fill="#EFF6FF" />
          {T(
            52,
            304,
            'Equity method · Full consolidation',
            8,
            false,
            '#1D4ED8'
          )}
          <rect x="44" y="316" width="280" height="20" rx="4" fill="#F8FAFC" />
          {T(52, 330, 'Intercompany eliminations: 3 active', 8, false, M)}
          <rect x="44" y="342" width="280" height="20" rx="4" fill="#ECFDF5" />
          {T(52, 356, 'Dec 2025 consolidation: complete ✓', 8, true, '#047857')}
          {/* Entity table */}
          <rect
            x="344"
            y="130"
            width="444"
            height="334"
            rx="6"
            fill={W}
            stroke={BD}
            strokeWidth="1"
          />
          {T(360, 150, 'Entity Registry', 11, true, H)}
          {ThRow(158, 352, 428)}
          {['CODE', 'ENTITY NAME', 'TYPE', 'CURRENCY', 'COUNTRY', 'STATUS'].map(
            (h, hidx) =>
              T([364, 440, 540, 596, 644, 696][hidx], 170, h, 7.5, true, M)
          )}
          {[
            {
              code: 'GRP-HQ',
              name: 'Group HoldCo Ltd',
              type: 'Parent',
              curr: 'INR',
              ctry: 'India',
              st: 'Active',
              bg: '#ECFDF5',
              tc: '#047857',
              pw: 44,
            },
            {
              code: 'TCS-IN',
              name: 'TCS India Ltd',
              type: 'Subsidiary',
              curr: 'INR',
              ctry: 'India',
              st: 'Active',
              bg: '#ECFDF5',
              tc: '#047857',
              pw: 44,
            },
            {
              code: 'AcmeUS-LLC',
              name: 'Acme US LLC',
              type: 'Subsidiary',
              curr: 'USD',
              ctry: 'US',
              st: 'Active',
              bg: '#ECFDF5',
              tc: '#047857',
              pw: 44,
            },
            {
              code: 'AcmeSG-Pte',
              name: 'Acme SG Pte',
              type: 'Subsidiary',
              curr: 'SGD',
              ctry: 'SG',
              st: 'Active',
              bg: '#ECFDF5',
              tc: '#047857',
              pw: 44,
            },
            {
              code: 'AcmeUK-Ltd',
              name: 'Acme UK Ltd',
              type: 'Associate',
              curr: 'GBP',
              ctry: 'UK',
              st: 'Inactive',
              bg: '#F1F5F9',
              tc: '#475569',
              pw: 48,
            },
          ].map((r, idx) => (
            <g key={idx}>
              <rect
                x="352"
                y={182 + idx * 32}
                width="428"
                height="28"
                rx="3"
                fill={idx % 2 === 0 ? W : '#F8FAFC'}
                stroke={BD}
                strokeWidth="0.5"
              />
              {T(364, 199 + idx * 32, r.code, 8.5, true, PRM)}
              {T(440, 199 + idx * 32, r.name, 8.5)}
              {T(540, 199 + idx * 32, r.type, 8.5, false, M)}
              {T(596, 199 + idx * 32, r.curr, 8.5, false, M)}
              {T(644, 199 + idx * 32, r.ctry, 8.5, false, M)}
              {Pill(696, 199 + idx * 32, r.st, r.bg, r.tc, r.pw)}
            </g>
          ))}
        </svg>
      )

    // ── 2. Multi-Currency ───────────────────────────────────────────────────
    case 2:
      return (
        <svg
          viewBox="0 0 800 480"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
        >
          <rect width="800" height="480" fill={W} />
          <Sb />
          {Hdr('Multi-Currency', 'Currency settings and FX rate management')}
          <rect
            x="36"
            y="52"
            width="200"
            height="36"
            rx="6"
            fill="#EFF6FF"
            stroke="#BFDBFE"
            strokeWidth="1"
          />
          {T(48, 64, 'FUNCTIONAL CURRENCY', 7.5, true, '#1D4ED8')}
          {T(48, 77, '₹ INR — Indian Rupee', 10, true, H)}
          <rect
            x="248"
            y="52"
            width="540"
            height="36"
            rx="6"
            fill="#F8FAFC"
            stroke={BD}
            strokeWidth="1"
          />
          {T(260, 64, 'RATE SOURCE', 7.5, true, M)}
          {T(
            260,
            77,
            'RBI Reference Rate · Updated every 2 hours',
            9,
            false,
            H
          )}
          {/* 3 currency rate cards */}
          {[
            {
              curr: 'USD',
              rate: '83.45',
              chg: '+0.12%',
              sub: 'Updated 2h ago',
              up: true,
            },
            {
              curr: 'EUR',
              rate: '89.12',
              chg: '−0.04%',
              sub: 'Updated 2h ago',
              up: false,
            },
            {
              curr: 'SGD',
              rate: '61.78',
              chg: '+0.21%',
              sub: 'Updated 2h ago',
              up: true,
            },
          ].map((c, idx) => (
            <g key={idx}>
              <rect
                x={36 + idx * 256}
                y="100"
                width="240"
                height="78"
                rx="8"
                fill={W}
                stroke={BD}
                strokeWidth="1"
              />
              {T(52 + idx * 256, 118, c.curr, 12, true, H)}
              {T(52 + idx * 256, 142, `${c.rate} ₹`, 20, true, PRM)}
              {T(52 + idx * 256, 158, c.chg, 9, true, c.up ? POS : NEG)}
              {T(268 + idx * 256, 158, c.sub, 8, false, M, 'end')}
              {/* sparkline hint */}
              {[0, 1, 2, 3, 4, 5].map((k) => (
                <line
                  key={k}
                  x1={182 + idx * 256 + k * 8}
                  y1={c.up ? 138 - k * 1.5 : 138 + k * 1.2}
                  x2={182 + idx * 256 + (k + 1) * 8}
                  y2={c.up ? 138 - (k + 1) * 1.5 : 138 + (k + 1) * 1.2}
                  stroke={c.up ? POS : NEG}
                  strokeWidth="1.5"
                />
              ))}
            </g>
          ))}
          {/* Recent FX Postings */}
          <rect
            x="36"
            y="190"
            width="752"
            height="254"
            rx="6"
            fill={W}
            stroke={BD}
            strokeWidth="1"
          />
          {T(52, 210, 'Recent FX Postings', 11, true, H)}
          {ThRow(216, 44, 736)}
          {[
            'DATE',
            'DOCUMENT',
            'FROM → TO',
            'RATE',
            'AMOUNT (₹)',
            'GAIN / LOSS',
          ].map((h, hidx) =>
            T([56, 144, 240, 360, 468, 596][hidx], 228, h, 7.5, true, M)
          )}
          {(
            [
              {
                dt: 'Apr 26',
                doc: 'INV-000022',
                fx: 'USD → INR',
                rate: '83.45',
                amt: '₹4,91,955',
                gl: '+₹840',
                pos: true,
              },
              {
                dt: 'Apr 24',
                doc: 'BL-7820',
                fx: 'USD → INR',
                rate: '83.38',
                amt: '₹2,83,492',
                gl: '+₹240',
                pos: true,
              },
              {
                dt: 'Apr 22',
                doc: 'INV-000019',
                fx: 'EUR → INR',
                rate: '89.08',
                amt: '₹2,20,728',
                gl: '−₹360',
                pos: false,
              },
              {
                dt: 'Apr 20',
                doc: 'BL-7801',
                fx: 'SGD → INR',
                rate: '61.72',
                amt: '₹1,23,440',
                gl: '+₹600',
                pos: true,
              },
              {
                dt: 'Apr 18',
                doc: 'INV-000015',
                fx: 'USD → INR',
                rate: '83.31',
                amt: '₹2,35,627',
                gl: '+₹660',
                pos: true,
              },
            ] as const
          ).map((r, idx) => (
            <g key={idx}>
              {Tr(238 + idx * 36, idx % 2 === 0, 44, 736)}
              {T(56, 256 + idx * 36, r.dt, 9, false, M)}
              {T(144, 256 + idx * 36, r.doc, 9, true, PRM)}
              {T(240, 256 + idx * 36, r.fx, 9)}
              {T(360, 256 + idx * 36, r.rate, 9, true, H)}
              {T(468, 256 + idx * 36, r.amt, 9.5, true, H)}
              {T(596, 256 + idx * 36, r.gl, 9.5, true, r.pos ? POS : NEG)}
            </g>
          ))}
          <rect
            x="44"
            y="420"
            width="200"
            height="20"
            rx="5"
            fill="#ECFDF5"
            stroke="#A7F3D0"
            strokeWidth="0.5"
          />
          {T(56, 434, 'Realized FX Gain ₹2,140 ✓', 9, true, '#047857')}
        </svg>
      )

    // ── 3. Accounts Payable ─────────────────────────────────────────────────
    case 3:
      return (
        <svg
          viewBox="0 0 800 480"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
        >
          <rect width="800" height="480" fill={W} />
          <Sb />
          {Hdr(
            'Bills · TCS · Apr 2026',
            'AP · Vendor bills, 3-way matching, and payment approvals',
            '+ New Bill'
          )}
          {K4(36, 52, 'OPEN BILLS', '23', 'Awaiting action')}
          {K4(226, 52, 'OPEN AMOUNT', '₹63,30,315', 'Across 23 bills')}
          {K4(416, 52, 'DUE THIS WEEK', '7', 'Urgent payment', WARN)}
          {K4(606, 52, 'AWAITING APPROVAL', '4', 'Pending sign-off', WARN)}
          {/* Workflow strip */}
          <rect
            x="36"
            y="130"
            width="752"
            height="54"
            rx="6"
            fill="#F8FAFC"
            stroke={BD}
            strokeWidth="1"
          />
          {T(48, 149, 'Procurement Workflow', 8, true, M)}
          {[
            { label: 'PR', sub: 'Requisition', hi: false },
            { label: 'PO', sub: 'Order', hi: false },
            { label: 'GRN', sub: 'Goods Receipt', hi: true },
            { label: 'Bill', sub: 'Invoice', hi: true },
            { label: 'Payment', sub: 'Settlement', hi: false },
          ].map((s, idx) => (
            <g key={idx}>
              <rect
                x={56 + idx * 142}
                y="152"
                width="86"
                height="24"
                rx="4"
                fill={s.hi ? PRM : W}
                stroke={s.hi ? PRM : BD}
                strokeWidth="1"
              />
              {T(99 + idx * 142, 168, s.label, 9, true, s.hi ? W : H, 'middle')}
              {idx < 4 && (
                <line
                  x1={142 + idx * 142}
                  y1="164"
                  x2={194 + idx * 142}
                  y2="164"
                  stroke={BD}
                  strokeWidth="1.5"
                />
              )}
              {idx < 4 && (
                <polygon
                  points={`${193 + idx * 142},160 ${199 + idx * 142},164 ${193 + idx * 142},168`}
                  fill={BD}
                />
              )}
            </g>
          ))}
          <rect
            x="336"
            y="145"
            width="108"
            height="16"
            rx="8"
            fill="#ECFDF5"
            stroke="#A7F3D0"
            strokeWidth="0.5"
          />
          {T(390, 156, '3-way matched ✓', 7.5, true, '#047857', 'middle')}
          {/* Bills table */}
          {ThRow(196)}
          {[
            'VENDOR',
            'BILL #',
            'ISSUE DATE',
            'DUE DATE',
            'AMOUNT (₹)',
            'STATUS',
            '',
          ].map((h, hidx) =>
            T([48, 196, 312, 394, 482, 574, 696][hidx], 209, h, 7.5, true, M)
          )}
          {[
            {
              vnd: 'Infosys Ltd',
              bill: 'BL-7823',
              iss: 'Apr 20',
              due: 'May 20',
              amt: '₹18,40,000',
              st: 'Approved',
              bg: '#ECFDF5',
              tc: '#047857',
              pw: 56,
            },
            {
              vnd: 'TCS Pvt Ltd',
              bill: 'BL-7820',
              iss: 'Apr 18',
              due: 'Apr 28',
              amt: '₹3,40,000',
              st: 'Pending',
              bg: '#FFFBEB',
              tc: '#B45309',
              pw: 52,
            },
            {
              vnd: 'Wipro Ltd',
              bill: 'BL-7818',
              iss: 'Apr 15',
              due: 'Apr 25',
              amt: '₹12,80,000',
              st: 'Paid',
              bg: '#ECFDF5',
              tc: '#047857',
              pw: 36,
            },
            {
              vnd: 'HCL Technologies',
              bill: 'BL-7812',
              iss: 'Apr 10',
              due: 'May 10',
              amt: '₹28,70,315',
              st: 'Draft',
              bg: '#F1F5F9',
              tc: '#475569',
              pw: 40,
            },
          ].map((r, idx) => (
            <g key={idx}>
              {Tr(218 + idx * 38, idx % 2 === 0)}
              {T(48, 238 + idx * 38, r.vnd, 9)}
              {T(196, 238 + idx * 38, r.bill, 9, true, PRM)}
              {T(312, 238 + idx * 38, r.iss, 9, false, M)}
              {T(394, 238 + idx * 38, r.due, 9, false, M)}
              {T(482, 238 + idx * 38, r.amt, 9.5, true, H)}
              {Pill(574, 238 + idx * 38, r.st, r.bg, r.tc, r.pw)}
              <rect
                x="698"
                y={228 + idx * 38}
                width="56"
                height="16"
                rx="4"
                fill="#F1F5F9"
                stroke={BD}
                strokeWidth="0.5"
              />
              {T(726, 239 + idx * 38, 'Pay Now', 8, true, M, 'middle')}
            </g>
          ))}
        </svg>
      )

    // ── 4. Accounts Receivable ──────────────────────────────────────────────
    case 4:
      return (
        <svg
          viewBox="0 0 800 480"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
        >
          <rect width="800" height="480" fill={W} />
          <Sb />
          {Hdr(
            'Customer Invoices',
            '19 INVOICES · AR · Customer invoice history and receivables',
            '+ New Invoice'
          )}
          {K4(36, 52, 'TOTAL INVOICES', '19', '12 draft · 0 active')}
          {K4(226, 52, 'OUTSTANDING', '₹40,00,200', '15 unpaid')}
          {K4(416, 52, 'OVERDUE', '₹0', 'No overdue invoices', POS)}
          {K4(606, 52, 'PAID (MTD)', '₹0', 'Apr 2026', M)}
          {ThRow(126)}
          {[
            'INVOICE #',
            'CUSTOMER',
            'ISSUE DATE',
            'DUE DATE',
            'AMOUNT',
            'REMAINING',
            'STATUS',
          ].map((h, hidx) =>
            T([48, 156, 288, 368, 452, 548, 644][hidx], 139, h, 7.5, true, M)
          )}
          {(
            [
              {
                no: 'INV-000022',
                cust: 'Zoho Corp',
                iss: 'Apr 9',
                due: 'May 9',
                amt: '₹5,90,000',
                rem: '₹5,90,000',
                st: 'Draft',
                bg: '#F1F5F9',
                tc: '#475569',
                pw: 40,
              },
              {
                no: 'INV-000019',
                cust: 'CleverTap',
                iss: 'Mar 2',
                due: 'Apr 1',
                amt: '₹2,47,800',
                rem: '₹1,23,900',
                st: 'partially_paid',
                bg: '#FFFBEB',
                tc: '#B45309',
                pw: 76,
              },
              {
                no: 'INV-000018',
                cust: 'Chargebee',
                iss: 'Feb 9',
                due: 'Mar 11',
                amt: '₹88,500',
                rem: '₹0',
                st: 'Paid',
                bg: '#ECFDF5',
                tc: '#047857',
                pw: 36,
              },
              {
                no: 'INV-000016',
                cust: 'PhonePe',
                iss: 'Jan 17',
                due: 'Feb 16',
                amt: '₹1,12,100',
                rem: '₹0',
                st: 'Paid',
                bg: '#ECFDF5',
                tc: '#047857',
                pw: 36,
              },
              {
                no: 'INV-000015',
                cust: 'Zoho Corp',
                iss: 'Jan 25',
                due: 'Feb 24',
                amt: '₹2,83,200',
                rem: '₹0',
                st: 'Paid',
                bg: '#ECFDF5',
                tc: '#047857',
                pw: 36,
              },
            ] as const
          ).map((r, idx) => (
            <g key={idx}>
              {Tr(148 + idx * 42, idx % 2 === 0)}
              {T(48, 170 + idx * 42, r.no, 9.5, true, PRM)}
              {T(156, 170 + idx * 42, r.cust, 9)}
              {T(288, 170 + idx * 42, r.iss, 9, false, M)}
              {T(368, 170 + idx * 42, r.due, 9, false, M)}
              {T(452, 170 + idx * 42, r.amt, 9.5, true, H)}
              {T(
                548,
                170 + idx * 42,
                r.rem,
                9.5,
                false,
                r.rem === '₹0' ? POS : M
              )}
              {Pill(644, 170 + idx * 42, r.st, r.bg, r.tc, r.pw)}
            </g>
          ))}
        </svg>
      )

    // ── 5. Banking & Cash ───────────────────────────────────────────────────
    case 5:
      return (
        <svg
          viewBox="0 0 800 480"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
        >
          <rect width="800" height="480" fill={W} />
          <Sb />
          {Hdr(
            'Banking Dashboard',
            'Monitor bank accounts, transactions, and reconciliations'
          )}
          {/* 3 bank account cards */}
          {[
            {
              bank: 'HDFC Bank',
              acct: '··2841',
              bal: '₹38,40,000',
              st: 'Reconciled ✓',
              stbg: '#ECFDF5',
              sttc: '#047857',
              pw: 72,
            },
            {
              bank: 'ICICI Bank',
              acct: '··9012',
              bal: '₹11,50,000',
              st: '3 unreconciled',
              stbg: '#FFFBEB',
              sttc: '#B45309',
              pw: 80,
            },
            {
              bank: 'Axis Bank',
              acct: '··5503',
              bal: '₹20,000',
              st: 'Reconciled ✓',
              stbg: '#ECFDF5',
              sttc: '#047857',
              pw: 72,
            },
          ].map((b, idx) => (
            <g key={idx}>
              <rect
                x={36 + idx * 256}
                y="52"
                width="240"
                height="72"
                rx="8"
                fill={W}
                stroke={BD}
                strokeWidth="1"
              />
              {T(52 + idx * 256, 70, b.bank, 10, true, H)}
              {T(52 + idx * 256, 84, b.acct, 9, false, M)}
              {T(52 + idx * 256, 106, b.bal, 18, true, PRM)}
              <rect
                x={268 + idx * 256 - b.pw}
                y="54"
                width={b.pw}
                height="15"
                rx="7"
                fill={b.stbg}
              />
              {T(
                268 + idx * 256 - b.pw / 2,
                64,
                b.st,
                7.5,
                true,
                b.sttc,
                'middle'
              )}
            </g>
          ))}
          {/* Transactions */}
          <rect
            x="36"
            y="136"
            width="752"
            height="236"
            rx="6"
            fill={W}
            stroke={BD}
            strokeWidth="1"
          />
          {T(52, 156, 'Recent Transactions', 11, true, H)}
          {T(788, 156, 'HDFC ··2841', 9, false, M, 'end')}
          {ThRow(162, 44, 736)}
          {[
            'DATE',
            'DESCRIPTION',
            'RULE MATCHED',
            'AMOUNT',
            'MATCH STATUS',
          ].map((h, hidx) =>
            T([56, 148, 344, 508, 620][hidx], 174, h, 7.5, true, M)
          )}
          {(
            [
              {
                dt: 'Apr 26',
                desc: 'Customer NEFT — Zoho Corp',
                rule: 'Auto: Customer Receipts',
                amt: '+₹5,90,000',
                ms: 'Matched ✓',
                mbg: '#ECFDF5',
                mtc: '#047857',
                pos: true,
                pw: 60,
              },
              {
                dt: 'Apr 25',
                desc: 'RTGS — AWS India Pvt Ltd',
                rule: 'Recurring · AWS India',
                amt: '−₹1,42,800',
                ms: 'Matched ✓',
                mbg: '#ECFDF5',
                mtc: '#047857',
                pos: false,
                pw: 60,
              },
              {
                dt: 'Apr 25',
                desc: 'Payroll batch — April',
                rule: 'Auto: Payroll',
                amt: '−₹18,40,000',
                ms: 'Matched ✓',
                mbg: '#ECFDF5',
                mtc: '#047857',
                pos: false,
                pw: 60,
              },
              {
                dt: 'Apr 24',
                desc: 'NEFT credit — Chargebee',
                rule: 'Reviewing…',
                amt: '+₹88,500',
                ms: 'Unmatched',
                mbg: '#FFFBEB',
                mtc: '#B45309',
                pos: true,
                pw: 60,
              },
            ] as const
          ).map((r, idx) => (
            <g key={idx}>
              {Tr(184 + idx * 42, idx % 2 === 0, 44, 736)}
              {T(56, 205 + idx * 42, r.dt, 9, false, M)}
              {T(148, 205 + idx * 42, r.desc, 9)}
              {T(344, 205 + idx * 42, r.rule, 9, false, M)}
              {T(508, 205 + idx * 42, r.amt, 9.5, true, r.pos ? POS : NEG)}
              {Pill(620, 205 + idx * 42, r.ms, r.mbg, r.mtc, r.pw)}
            </g>
          ))}
          {/* Cash position */}
          <rect
            x="36"
            y="384"
            width="752"
            height="80"
            rx="6"
            fill="#EFF6FF"
            stroke="#BFDBFE"
            strokeWidth="1"
          />
          {T(52, 402, 'TOTAL CASH ACROSS ACCOUNTS', 7.5, true, '#1D4ED8')}
          {T(52, 428, '₹50,10,000', 22, true, PRM)}
          {T(788, 406, '3 accounts · Last sync 5 min ago', 9, false, M, 'end')}
          {T(788, 424, 'HDFC + ICICI + Axis', 9, false, M, 'end')}
        </svg>
      )

    // ── 6. Fixed Assets ─────────────────────────────────────────────────────
    case 6:
      return (
        <svg
          viewBox="0 0 800 480"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
        >
          <rect width="800" height="480" fill={W} />
          <Sb />
          {Hdr(
            'Fixed Assets',
            'Asset register, depreciation, and asset lifecycle management',
            '+ Add Asset'
          )}
          {K3(36, 52, 'ASSET COUNT', '142', 'Active assets')}
          {K3(289, 52, 'NET BOOK VALUE', '₹2,10,40,000', 'As at Apr 2026')}
          {K3(542, 52, 'DEPRECIATION YTD', '₹18,60,000', 'FY 2025–26', WARN)}
          {/* Asset table */}
          <rect
            x="36"
            y="130"
            width="444"
            height="334"
            rx="6"
            fill={W}
            stroke={BD}
            strokeWidth="1"
          />
          {T(52, 150, 'Asset Register', 11, true, H)}
          {ThRow(158, 44, 428)}
          {['ASSET #', 'ASSET NAME', 'CATEGORY', 'METHOD', 'NBV (₹)'].map(
            (h, hidx) => T([56, 128, 268, 348, 430][hidx], 170, h, 7.5, true, M)
          )}
          {[
            {
              id: 'FA-0042',
              name: 'Dell PowerEdge R750',
              cat: 'IT Hardware',
              meth: 'SLM',
              nbv: '₹3,40,000',
              st: 'Active',
              bg: '#ECFDF5',
              tc: '#047857',
            },
            {
              id: 'FA-0089',
              name: 'Office Lease HSR',
              cat: 'Buildings',
              meth: 'SLM',
              nbv: '₹78,00,000',
              st: 'Active',
              bg: '#ECFDF5',
              tc: '#047857',
            },
            {
              id: 'FA-0114',
              name: 'Toyota Innova 2023',
              cat: 'Vehicles',
              meth: 'DBM',
              nbv: '₹6,20,000',
              st: 'Active',
              bg: '#ECFDF5',
              tc: '#047857',
            },
            {
              id: 'FA-0001',
              name: 'HP LaserJet M404',
              cat: 'IT Hardware',
              meth: 'SLM',
              nbv: '₹12,000',
              st: 'Fully Dep.',
              bg: '#F1F5F9',
              tc: '#475569',
            },
            {
              id: 'FA-0072',
              name: 'Boardroom Furniture',
              cat: 'Furniture',
              meth: 'SLM',
              nbv: '₹1,80,000',
              st: 'Active',
              bg: '#ECFDF5',
              tc: '#047857',
            },
          ].map((r, idx) => (
            <g key={idx}>
              <rect
                x="44"
                y={182 + idx * 38}
                width="428"
                height="33"
                rx="3"
                fill={idx % 2 === 0 ? W : '#F8FAFC'}
                stroke={BD}
                strokeWidth="0.5"
              />
              {T(56, 200 + idx * 38, r.id, 8.5, true, PRM)}
              {T(128, 200 + idx * 38, r.name, 8.5)}
              {T(268, 200 + idx * 38, r.cat, 8.5, false, M)}
              {T(348, 200 + idx * 38, r.meth, 8.5, false, M)}
              {T(460, 200 + idx * 38, r.nbv, 9, true, H, 'end')}
            </g>
          ))}
          {/* Depreciation line chart */}
          <rect
            x="492"
            y="130"
            width="296"
            height="334"
            rx="6"
            fill={W}
            stroke={BD}
            strokeWidth="1"
          />
          {T(508, 150, 'Depreciation Forecast', 11, true, H)}
          {T(508, 165, 'Net Book Value decline · 12 months', 8.5, false, M)}
          <line
            x1="520"
            y1="196"
            x2="520"
            y2="370"
            stroke={BD}
            strokeWidth="1"
          />
          <line
            x1="520"
            y1="370"
            x2="770"
            y2="370"
            stroke={BD}
            strokeWidth="1"
          />
          {(() => {
            const ys = [
              370, 356, 342, 328, 315, 302, 290, 278, 268, 258, 248, 239,
            ]
            const ms = [
              'A',
              'M',
              'J',
              'J',
              'A',
              'S',
              'O',
              'N',
              'D',
              'J',
              'F',
              'M',
            ]
            return (
              <>
                {ys.map(
                  (y, k) =>
                    k < 11 && (
                      <line
                        key={k}
                        x1={520 + k * 22}
                        y1={y}
                        x2={520 + (k + 1) * 22}
                        y2={ys[k + 1]}
                        stroke={PRM}
                        strokeWidth="1.5"
                      />
                    )
                )}
                {ys.map((y, k) => (
                  <circle key={k} cx={520 + k * 22} cy={y} r="2.5" fill={PRM} />
                ))}
                {ms.map((m, k) => (
                  <text
                    key={k}
                    x={520 + k * 22}
                    y="383"
                    fontFamily={ff}
                    fontSize="7"
                    fill={M}
                    textAnchor="middle"
                  >
                    {m}
                  </text>
                ))}
                <text
                  x="508"
                  y="200"
                  fontFamily={ff}
                  fontSize="7"
                  fill={M}
                  textAnchor="end"
                >
                  ₹2.1Cr
                </text>
                <text
                  x="508"
                  y="374"
                  fontFamily={ff}
                  fontSize="7"
                  fill={M}
                  textAnchor="end"
                >
                  ₹0
                </text>
                <text
                  x="762"
                  y="235"
                  fontFamily={ff}
                  fontSize="7"
                  fill={M}
                  textAnchor="end"
                >
                  NBV Mar
                </text>
                <text
                  x="762"
                  y="248"
                  fontFamily={ff}
                  fontSize="8"
                  fontWeight="700"
                  fill={PRM}
                  textAnchor="end"
                >
                  ₹1,91,80,000
                </text>
              </>
            )
          })()}
          <rect
            x="500"
            y="400"
            width="280"
            height="52"
            rx="5"
            fill="#F8FAFC"
            stroke={BD}
            strokeWidth="0.5"
          />
          {T(512, 416, 'Depreciation method: SLM avg 10%', 8.5, true, H)}
          {T(
            512,
            432,
            '₹18,60,000 charged YTD of ₹2,10,40,000 NBV',
            8.5,
            false,
            M
          )}
        </svg>
      )

    // ── 7. Cost Accounting ──────────────────────────────────────────────────
    case 7:
      return (
        <svg
          viewBox="0 0 800 480"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
        >
          <rect width="800" height="480" fill={W} />
          <Sb />
          {Hdr(
            'Cost Accounting',
            'Cost centres, ABC costing, and variance analysis',
            '+ New Cost Centre'
          )}
          {K3(36, 52, 'COST CENTRES', '18', 'Active cost centres')}
          {K3(289, 52, 'ALLOCATED YTD', '₹1,42,30,000', 'FY 2025–26')}
          {K3(542, 52, 'VARIANCE', '₹-3,10,000', 'Under budget 2.1%', NEG)}
          {/* Dept bars */}
          <rect
            x="36"
            y="130"
            width="436"
            height="240"
            rx="6"
            fill={W}
            stroke={BD}
            strokeWidth="1"
          />
          {T(52, 150, 'Department-wise Cost (YTD)', 11, true, H)}
          {[
            { dept: 'Engineering', amt: '₹65L', pct: 0.76, color: PRM },
            { dept: 'Sales', amt: '₹42L', pct: 0.49, color: '#6366F1' },
            { dept: 'Operations', amt: '₹35L', pct: 0.41, color: '#8B5CF6' },
            { dept: 'Admin', amt: '₹18L', pct: 0.21, color: '#94A3B8' },
          ].map((d, idx) => (
            <g key={idx}>
              {T(52, 174 + idx * 46, d.dept, 9, false, M)}
              <rect
                x="52"
                y={179 + idx * 46}
                width="350"
                height="12"
                rx="6"
                fill="#F1F5F9"
              />
              <rect
                x="52"
                y={179 + idx * 46}
                width={350 * d.pct}
                height="12"
                rx="6"
                fill={d.color}
                opacity="0.85"
              />
              {T(408, 187 + idx * 46, d.amt, 9, true, H, 'end')}
            </g>
          ))}
          <rect
            x="44"
            y="350"
            width="420"
            height="22"
            rx="5"
            fill="#ECFDF5"
            stroke="#A7F3D0"
            strokeWidth="0.5"
          />
          {T(
            56,
            365,
            'Approval gate: All cost postings require sign-off ✓',
            9,
            true,
            '#047857'
          )}
          {/* Allocation table */}
          <rect
            x="484"
            y="130"
            width="304"
            height="334"
            rx="6"
            fill={W}
            stroke={BD}
            strokeWidth="1"
          />
          {T(500, 150, 'Cost Allocations', 11, true, H)}
          {ThRow(158, 492, 288)}
          {['CC CODE', 'DEPARTMENT', 'METHOD', 'ALLOCATED'].map((h, hidx) =>
            T([504, 564, 648, 768][hidx], 170, h, 7.5, true, M)
          )}
          {[
            {
              cc: 'CC-ENG',
              dept: 'Engineering',
              meth: 'Headcount',
              alloc: '₹65,00,000',
            },
            {
              cc: 'CC-SLS',
              dept: 'Sales',
              meth: 'Revenue',
              alloc: '₹42,00,000',
            },
            {
              cc: 'CC-OPS',
              dept: 'Operations',
              meth: 'Activity',
              alloc: '₹35,00,000',
            },
            {
              cc: 'CC-ADM',
              dept: 'Admin',
              meth: 'Direct',
              alloc: '₹18,00,000',
            },
            {
              cc: 'CC-RND',
              dept: 'R&D',
              meth: 'Headcount',
              alloc: '₹14,30,000',
            },
            {
              cc: 'CC-MKT',
              dept: 'Marketing',
              meth: 'Revenue',
              alloc: '₹8,00,000',
            },
            {
              cc: 'CC-FIN',
              dept: 'Finance',
              meth: 'Direct',
              alloc: '₹6,00,000',
            },
          ].map((r, idx) => (
            <g key={idx}>
              <rect
                x="492"
                y={182 + idx * 34}
                width="288"
                height="29"
                rx="3"
                fill={idx % 2 === 0 ? W : '#F8FAFC'}
                stroke={BD}
                strokeWidth="0.5"
              />
              {T(504, 198 + idx * 34, r.cc, 8.5, true, PRM)}
              {T(564, 198 + idx * 34, r.dept, 8.5)}
              {T(648, 198 + idx * 34, r.meth, 8.5, false, M)}
              {T(772, 198 + idx * 34, r.alloc, 9, true, H, 'end')}
            </g>
          ))}
        </svg>
      )

    // ── 8. Financial Reporting ──────────────────────────────────────────────
    case 8:
      return (
        <svg
          viewBox="0 0 800 480"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
        >
          <rect width="800" height="480" fill={W} />
          <Sb />
          {Hdr(
            'Reports',
            'Financial statements, analysis, and custom report builder'
          )}
          {/* Toolbar */}
          <rect
            x="36"
            y="52"
            width="752"
            height="32"
            rx="6"
            fill="#F8FAFC"
            stroke={BD}
            strokeWidth="1"
          />
          {T(48, 72, 'Date Range: YTD', 9, false, M)}
          {T(168, 72, '·', 9, false, M)}
          {T(180, 72, 'Compare prior period', 9, false, M)}
          {T(338, 72, '·', 9, false, M)}
          {T(350, 72, 'Export', 9, false, M)}
          <rect
            x="670"
            y="57"
            width="44"
            height="20"
            rx="4"
            fill={W}
            stroke={BD}
            strokeWidth="1"
          />
          {T(692, 71, 'PDF', 8.5, true, M, 'middle')}
          <rect
            x="718"
            y="57"
            width="48"
            height="20"
            rx="4"
            fill={W}
            stroke={BD}
            strokeWidth="1"
          />
          {T(742, 71, 'XLSX', 8.5, true, M, 'middle')}
          {/* 3×3 report grid */}
          {[
            [
              { n: 'Profit & Loss', s: 'Income vs Expenses', c: '#EFF6FF' },
              { n: 'Balance Sheet', s: 'Assets & Liabilities', c: '#F0FDF4' },
              { n: 'Cash Flow', s: 'Cash in & outflows', c: '#FFFBEB' },
            ],
            [
              { n: 'Trial Balance', s: 'Debit / Credit listing', c: '#F8FAFC' },
              { n: 'Aged Receivables', s: 'Outstanding by age', c: '#F8FAFC' },
              { n: 'Aged Payables', s: 'Bills by due date', c: '#F8FAFC' },
            ],
            [
              { n: 'Budget vs Actual', s: 'Variance analysis', c: '#F8FAFC' },
              {
                n: 'Financial Ratios',
                s: 'Liquidity & leverage',
                c: '#F8FAFC',
              },
              { n: 'Custom Builder', s: 'Build your report', c: '#EFF6FF' },
            ],
          ].map((row, ri) =>
            row.map((card, ci) => (
              <g key={`${ri}-${ci}`}>
                <rect
                  x={36 + ci * 256}
                  y={94 + ri * 120}
                  width="240"
                  height="106"
                  rx="8"
                  fill={W}
                  stroke={BD}
                  strokeWidth="1"
                />
                <rect
                  x={52 + ci * 256}
                  y={108 + ri * 120}
                  width="36"
                  height="36"
                  rx="8"
                  fill={card.c}
                />
                {T(
                  70 + ci * 256,
                  130 + ri * 120,
                  ri === 0 && ci === 0
                    ? '📊'
                    : ri === 0 && ci === 1
                      ? '⚖️'
                      : ri === 0 && ci === 2
                        ? '💰'
                        : ri === 1 && ci === 0
                          ? '📋'
                          : ri === 1 && ci === 1
                            ? '📅'
                            : ri === 1 && ci === 2
                              ? '📆'
                              : ri === 2 && ci === 0
                                ? '📈'
                                : ri === 2 && ci === 1
                                  ? '🔢'
                                  : '🛠',
                  13,
                  false,
                  H,
                  'middle'
                )}
                {T(98 + ci * 256, 120 + ri * 120, card.n, 10, true, H)}
                {T(98 + ci * 256, 134 + ri * 120, card.s, 8.5, false, M)}
                <rect
                  x={52 + ci * 256}
                  y={172 + ri * 120}
                  width="68"
                  height="18"
                  rx="9"
                  fill={PRM}
                />
                {T(
                  86 + ci * 256,
                  184 + ri * 120,
                  'View Report',
                  8,
                  true,
                  W,
                  'middle'
                )}
                <rect
                  x={224 + ci * 256}
                  y={104 + ri * 120}
                  width="36"
                  height="13"
                  rx="6"
                  fill="#F8FAFC"
                  stroke={BD}
                  strokeWidth="0.5"
                />
                {T(
                  242 + ci * 256,
                  114 + ri * 120,
                  'YTD',
                  7,
                  false,
                  M,
                  'middle'
                )}
              </g>
            ))
          )}
        </svg>
      )

    // ── 9. Tax Management ───────────────────────────────────────────────────
    case 9:
      return (
        <svg
          viewBox="0 0 800 480"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
        >
          <rect width="800" height="480" fill={W} />
          <Sb />
          {Hdr(
            'Indian Tax Management',
            'Comprehensive tax management for GST, TDS, and compliance in India',
            '+ File Return'
          )}
          {K4(36, 52, 'GST TRANSACTIONS', '124', '₹4,28,500 collected')}
          {K4(226, 52, 'TDS TRANSACTIONS', '38', '₹78,200 deducted')}
          {K4(416, 52, 'PENDING COMPLIANCE', '2', 'Action required', WARN)}
          {K4(606, 52, 'OVERDUE', '0', 'All filed ✓', POS)}
          {/* 2-col block */}
          <rect
            x="36"
            y="130"
            width="368"
            height="176"
            rx="6"
            fill={W}
            stroke={BD}
            strokeWidth="1"
          />
          {T(52, 150, 'GST Summary', 11, true, H)}
          {T(396, 150, '₹4,28,500 collected', 9, true, POS, 'end')}
          {[
            { type: 'CGST', amt: '₹2,14,250', pct: 0.5 },
            { type: 'SGST', amt: '₹2,14,250', pct: 0.5 },
            { type: 'IGST', amt: '₹0', pct: 0 },
          ].map((g, idx) => (
            <g key={idx}>
              {T(52, 172 + idx * 44, g.type, 9, true, M)}
              <rect
                x="52"
                y={178 + idx * 44}
                width="284"
                height="10"
                rx="5"
                fill="#F1F5F9"
              />
              {g.pct > 0 && (
                <rect
                  x="52"
                  y={178 + idx * 44}
                  width={284 * g.pct}
                  height="10"
                  rx="5"
                  fill={POS}
                  opacity="0.7"
                />
              )}
              {T(396, 187 + idx * 44, g.amt, 9.5, true, H, 'end')}
            </g>
          ))}
          <rect
            x="416"
            y="130"
            width="372"
            height="176"
            rx="6"
            fill={W}
            stroke={BD}
            strokeWidth="1"
          />
          {T(432, 150, 'TDS Summary', 11, true, H)}
          {T(432, 170, 'TOTAL DEDUCTED', 7.5, true, M)}
          {T(432, 190, '₹78,200', 18, true, H)}
          {T(432, 208, 'AVERAGE RATE', 7.5, true, M)}
          {T(432, 226, '7.5%', 13, true, M)}
          {[
            { sec: 'Sec 194C — Contractor', rate: '2%', amt: '₹24,000' },
            { sec: 'Sec 194J — Professional', rate: '10%', amt: '₹30,000' },
            { sec: 'Sec 194I — Rent', rate: '10%', amt: '₹24,200' },
          ].map((t, idx) => (
            <g key={idx}>
              <rect
                x="424"
                y={244 + idx * 24}
                width="356"
                height="20"
                rx="3"
                fill={idx % 2 === 0 ? '#F8FAFC' : W}
                stroke={BD}
                strokeWidth="0.5"
              />
              {T(432, 257 + idx * 24, t.sec, 8.5)}
              {T(600, 257 + idx * 24, t.rate, 8.5, false, M)}
              {T(772, 257 + idx * 24, t.amt, 9, true, H, 'end')}
            </g>
          ))}
          {/* Recent compliance */}
          <rect
            x="36"
            y="318"
            width="752"
            height="148"
            rx="6"
            fill={W}
            stroke={BD}
            strokeWidth="1"
          />
          {T(52, 338, 'Recent Compliance', 11, true, H)}
          {ThRow(344, 44, 736)}
          {['RETURN', 'PERIOD', 'AMOUNT', 'DUE DATE', 'STATUS'].map((h, hidx) =>
            T([56, 196, 316, 440, 556][hidx], 356, h, 7.5, true, M)
          )}
          {(
            [
              {
                ret: 'GSTR-3B',
                per: '2024-06',
                amt: '₹50,000',
                due: '20 Jul 2024',
                st: 'Due',
                bg: '#FFFBEB',
                tc: '#B45309',
                pw: 36,
              },
              {
                ret: 'Form 26Q',
                per: '2024-Q2',
                amt: '₹25,000',
                due: '31 Jul 2024',
                st: 'Filed ✓',
                bg: '#ECFDF5',
                tc: '#047857',
                pw: 48,
              },
              {
                ret: 'GSTR-1',
                per: '2024-06',
                amt: '₹3,12,000',
                due: '11 Jul 2024',
                st: 'Pending',
                bg: '#FFFBEB',
                tc: '#B45309',
                pw: 52,
              },
            ] as const
          ).map((r, idx) => (
            <g key={idx}>
              {Tr(364 + idx * 38, idx % 2 === 0, 44, 736)}
              {T(56, 383 + idx * 38, r.ret, 9.5, true, PRM)}
              {T(196, 383 + idx * 38, r.per, 9, false, M)}
              {T(316, 383 + idx * 38, r.amt, 9.5, true, H)}
              {T(440, 383 + idx * 38, r.due, 9, false, M)}
              {Pill(556, 383 + idx * 38, r.st, r.bg, r.tc, r.pw)}
            </g>
          ))}
        </svg>
      )

    // ── 10. Compliance & Audit ──────────────────────────────────────────────
    case 10:
      return (
        <svg
          viewBox="0 0 800 480"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
        >
          <rect width="800" height="480" fill={W} />
          <Sb />
          {Hdr(
            'Audit Trail',
            '1,284 events this period · Field-level change tracking'
          )}
          {/* Filter tabs */}
          <rect
            x="36"
            y="52"
            width="752"
            height="32"
            rx="6"
            fill="#F8FAFC"
            stroke={BD}
            strokeWidth="1"
          />
          {T(48, 72, '1,284 events this period', 10, true, H)}
          {[
            { l: 'All', n: '1284', a: true },
            { l: 'Critical', n: '0' },
            { l: 'High', n: '2' },
            { l: 'Medium', n: '8' },
            { l: 'Info', n: '24' },
          ].map((tab, ti) => (
            <g key={ti}>
              <rect
                x={180 + ti * 116}
                y="58"
                width="88"
                height="20"
                rx="4"
                fill={tab.a ? PRM : '#F1F5F9'}
                stroke={tab.a ? PRM : BD}
                strokeWidth="0.5"
              />
              {T(
                224 + ti * 116,
                71,
                tab.a ? `All (${tab.n})` : tab.l + (tab.n ? ` (${tab.n})` : ''),
                8,
                true,
                tab.a ? W : M,
                'middle'
              )}
            </g>
          ))}
          {/* Timeline */}
          <rect
            x="36"
            y="94"
            width="600"
            height="380"
            rx="6"
            fill={W}
            stroke={BD}
            strokeWidth="1"
          />
          {T(52, 114, 'Activity Timeline', 11, true, H)}
          {(
            [
              {
                ts: 'Apr 26 14:32',
                ini: 'LE',
                col: '#3B82F6',
                action: 'Posted JE-0142',
                diff: 'debit 1100 · ₹1,20,000',
                sev: 'Info',
                sbg: '#EFF6FF',
                stc: '#1D4ED8',
                pw: 28,
              },
              {
                ts: 'Apr 26 11:08',
                ini: 'NK',
                col: '#8B5CF6',
                action: 'Period locked · 2026-Q1',
                diff: 'status: open → locked',
                sev: 'High',
                sbg: '#FEF2F2',
                stc: '#B91C1C',
                pw: 28,
              },
              {
                ts: 'Apr 25 17:45',
                ini: 'LE',
                col: '#3B82F6',
                action: 'Updated Vendor V-0042',
                diff: 'payment_terms: Net 30 → Net 45',
                sev: 'Medium',
                sbg: '#FFFBEB',
                stc: '#B45309',
                pw: 44,
              },
              {
                ts: 'Apr 25 09:12',
                ini: 'NK',
                col: '#8B5CF6',
                action: 'Approved Bill BL-7820',
                diff: '₹3,40,000 → POSTED',
                sev: 'Info',
                sbg: '#EFF6FF',
                stc: '#1D4ED8',
                pw: 28,
              },
              {
                ts: 'Apr 24 16:01',
                ini: 'SY',
                col: '#10B981',
                action: 'Banking rule R-08 auto-matched',
                diff: '12 transactions matched',
                sev: 'Info',
                sbg: '#EFF6FF',
                stc: '#1D4ED8',
                pw: 28,
              },
            ] as const
          ).map((ev, idx) => (
            <g key={idx}>
              {idx < 4 && (
                <line
                  x1="72"
                  y1={143 + idx * 62}
                  x2="72"
                  y2={160 + idx * 62}
                  stroke={BD}
                  strokeWidth="1.5"
                />
              )}
              <circle
                cx="72"
                cy={133 + idx * 62}
                r="13"
                fill={ev.col}
                opacity="0.15"
              />
              {T(72, 137 + idx * 62, ev.ini, 8.5, true, ev.col, 'middle')}
              <rect
                x="94"
                y={120 + idx * 62}
                width="490"
                height="46"
                rx="4"
                fill={idx % 2 === 0 ? '#F8FAFC' : W}
                stroke={BD}
                strokeWidth="0.5"
              />
              {T(106, 136 + idx * 62, ev.ts, 8.5, false, M)}
              {T(106, 150 + idx * 62, ev.action, 9.5, true, H)}
              <rect
                x="268"
                y={126 + idx * 62}
                width={ev.diff.length * 5 + 8}
                height="14"
                rx="3"
                fill="#F1F5F9"
              />
              {T(272, 137 + idx * 62, ev.diff, 7.5, false, '#475569')}
              {Pill(546, 141 + idx * 62, ev.sev, ev.sbg, ev.stc, ev.pw + 16)}
            </g>
          ))}
          {/* Severity legend */}
          <rect
            x="648"
            y="94"
            width="140"
            height="380"
            rx="6"
            fill={W}
            stroke={BD}
            strokeWidth="1"
          />
          {T(664, 114, 'Severity', 10, true, H)}
          {[
            { label: 'Critical', count: '0', bg: '#FEF2F2', tc: '#B91C1C' },
            { label: 'High', count: '2', bg: '#FEF2F2', tc: '#B91C1C' },
            { label: 'Medium', count: '8', bg: '#FFFBEB', tc: '#B45309' },
            { label: 'Info', count: '24', bg: '#EFF6FF', tc: '#1D4ED8' },
          ].map((s, idx) => (
            <g key={idx}>
              <rect
                x="656"
                y={128 + idx * 62}
                width="124"
                height="52"
                rx="4"
                fill="#F8FAFC"
                stroke={BD}
                strokeWidth="0.5"
              />
              <rect
                x="664"
                y={136 + idx * 62}
                width={s.label.length * 5.5 + 8}
                height="14"
                rx="7"
                fill={s.bg}
              />
              {T(
                664 + (s.label.length * 5.5 + 8) / 2,
                147 + idx * 62,
                s.label,
                7.5,
                true,
                s.tc,
                'middle'
              )}
              {T(664, 168 + idx * 62, s.count, 20, true, H)}
            </g>
          ))}
        </svg>
      )

    default:
      return null
  }
}
