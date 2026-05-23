// Shared CSS injected into every template's <style> block
// NOTE: Email-safe CSS — no gradients, no position:absolute, no filter, no ::before pseudo-elements.
// Gmail and most email clients strip these properties, causing broken layouts.
export const SHARED_CSS = `
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      background-color: #EFF6FF;
      padding: 40px 16px;
      color: #0D1B3E;
    }
    .wrapper {
      max-width: 620px;
      margin: 0 auto;
      border-radius: 16px;
      overflow: hidden;
    }
    /* Brand bar */
    .brand-bar {
      background-color: #0D1B3E;
      padding: 22px 36px;
      display: table;
      width: 100%;
    }
    .brand-logo {
      display: table-cell;
      height: 30px;
      width: auto;
      vertical-align: middle;
    }
    .brand-badge {
      display: table-cell;
      vertical-align: middle;
      text-align: right;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #93C5FD;
      background-color: rgba(255,255,255,0.10);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 20px;
      padding: 4px 12px;
      white-space: nowrap;
    }
    /* Hero */
    .hero {
      background-color: #0D1B3E;
      padding: 52px 40px 48px;
      text-align: center;
    }
    .hero-icon {
      font-size: 44px;
      display: block;
      margin-bottom: 20px;
    }
    .hero h1 {
      font-size: 28px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.4px;
      margin-bottom: 10px;
    }
    .hero-sub {
      font-size: 15px;
      color: #93C5FD;
      font-weight: 500;
    }
    /* Body card */
    .body-card {
      background-color: #ffffff;
      padding: 40px 40px 36px;
    }
    /* Section labels */
    .label {
      font-size: 11px;
      font-weight: 700;
      color: #2563EB;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 6px;
    }
    /* Info rows */
    .info-table { width:100%; border-collapse:collapse; margin:20px 0; }
    .info-table td { padding:12px 0; border-bottom:1px solid #EFF6FF; vertical-align:top; }
    .info-table tr:last-child td { border-bottom:none; }
    .info-label { width:40%; font-size:13px; color:#64748B; font-weight:500; }
    .info-value { font-size:14px; color:#0D1B3E; font-weight:600; }
    /* Highlight box */
    .highlight-box {
      background-color: #F8FAFF;
      border: 1px solid #DBEAFE;
      border-radius: 10px;
      padding: 20px 24px;
      margin: 20px 0;
    }
    .highlight-box .hl-label {
      font-size: 11px; font-weight:700; color:#2563EB;
      text-transform:uppercase; letter-spacing:0.6px; margin-bottom:8px;
    }
    .highlight-box .hl-value {
      font-size: 22px; font-weight:800; color:#0D1B3E;
    }
    /* CTA button */
    .cta { text-align:center; margin: 32px 0 24px; }
    .cta a {
      display: inline-block;
      padding: 16px 48px;
      background-color: #2563EB;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 10px;
      font-weight: 700;
      font-size: 15px;
      letter-spacing: 0.2px;
    }
    .cta-note { margin-top:10px; font-size:12px; color:#94A3B8; text-align:center; }
    /* Alert strip */
    .alert-strip {
      border-radius: 8px;
      padding: 14px 18px;
      margin: 16px 0;
      font-size: 14px;
      font-weight: 500;
    }
    .alert-warning { background-color:#FFF7ED; border-left:4px solid #F97316; color:#C2410C; }
    .alert-danger  { background-color:#FFF1F2; border-left:4px solid #F43F5E; color:#BE123C; }
    .alert-success { background-color:#F0FDF4; border-left:4px solid #22C55E; color:#15803D; }
    .alert-info    { background-color:#F0F7FF; border-left:4px solid #2563EB; color:#1B2E5A; }
    /* Checklist */
    .checklist { list-style:none; margin:16px 0; padding:0; }
    .checklist li {
      padding: 9px 0 9px 0;
      font-size: 14px;
      color: #475569;
      border-bottom: 1px solid #EFF6FF;
    }
    .checklist li:last-child { border-bottom:none; }
    /* Body text */
    .body-card p {
      font-size: 15px;
      line-height: 1.75;
      color: #475569;
      margin-bottom: 18px;
    }
    .body-card p strong { color:#0D1B3E; }
    /* Footer */
    .footer {
      background-color: #0D1B3E;
      padding: 28px 36px;
      text-align: center;
    }
    .footer-logo { height:24px; width:auto; opacity:0.7; margin-bottom:14px; }
    .footer-divider { width:36px; height:2px; background-color:rgba(255,255,255,0.15); margin:12px auto; border-radius:2px; }
    .footer p { font-size:13px; color:#93C5FD; line-height:1.8; margin:0; }
    .footer strong { color:#ffffff; }
    .footer-copy { font-size:12px; color:rgba(147,197,253,0.7) !important; margin-top:6px !important; }
    /* Responsive */
    @media (max-width:600px) {
      body { padding:20px 10px; }
      .brand-bar { padding:18px 24px; }
      .hero { padding:36px 24px 32px; }
      .body-card { padding:28px 24px 24px; }
      .footer { padding:24px; }
      .cta a { padding:14px 32px; }
    }
`;

export const LOGO_URL = 'https://res.cloudinary.com/dr9vzaa7u/image/upload/v1765126845/Zopkit_Full_Logo_kezq1b.jpg';
