import React from 'react';
import { Link } from '@tanstack/react-router';
import { LegalPageLayout } from '@/components/layout/LegalPageLayout';
import { LegalSection } from '@/components/legal/LegalSection';
import { LEGAL_CONTACT } from '@/lib/legal-contact';

const cookieToc = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'what-are-cookies', label: 'What are cookies?' },
  { id: 'how-we-use', label: 'How we use cookies' },
  { id: 'types', label: 'Types & duration' },
  { id: 'third-party', label: 'Third-party technologies' },
  { id: 'managing', label: 'How to manage or disable cookies' },
  { id: 'changes', label: 'Changes' },
  { id: 'contact', label: 'Contact' },
] as const;

const CookiePolicy: React.FC = () => (
  <LegalPageLayout
    title="Cookie Policy"
    lastUpdated="January 2026"
    docIntro={
      <>
        This policy describes how {LEGAL_CONTACT.companyLegalName} uses cookies and similar technologies on our websites and services. For how we process personal data more broadly, read our{' '}
        <Link to="/privacy" className="text-blue-600 hover:underline">
          Privacy Policy
        </Link>
        .
      </>
    }
    tableOfContents={[...cookieToc]}
  >
    <LegalSection id="introduction" title="1. Introduction">
      <p>
        When we say &quot;cookies,&quot; we also mean similar technologies such as local storage, pixels, and SDK features that store or read information on your device, where applicable.
      </p>
    </LegalSection>

    <LegalSection id="what-are-cookies" title="2. What are cookies?">
      <p>
        Cookies are small text files stored on your device when you visit a site. They are commonly used to keep you signed in, remember preferences, measure performance, and protect against fraud.
      </p>
    </LegalSection>

    <LegalSection id="how-we-use" title="3. How we use cookies">
      <p>We use cookies for purposes such as:</p>
      <ul>
        <li>
          <strong>Strictly necessary:</strong> Authentication, session management, load balancing, and security (these are typically required for the service to function).
        </li>
        <li>
          <strong>Functional:</strong> Remembering preferences (such as language or UI settings) where we offer those features.
        </li>
        <li>
          <strong>Analytics &amp; performance:</strong> Understanding how our sites and products are used so we can improve them. Where we use non-essential analytics cookies, we do so in line with applicable law and your choices.
        </li>
      </ul>
    </LegalSection>

    <LegalSection id="types" title="4. Types & duration">
      <p>
        We may use <strong>session</strong> cookies (removed when you close your browser) and <strong>persistent</strong> cookies (which remain for a defined period or until you delete them). We use both <strong>first-party</strong> cookies (set by us) and, where applicable, <strong>third-party</strong> cookies (set by partners who provide services to us).
      </p>
    </LegalSection>

    <LegalSection id="third-party" title="5. Third-party technologies">
      <p>
        Some cookies or trackers are placed by third parties—for example, our authentication provider, hosting or analytics vendors, or embedded content. Those providers have their own privacy notices. We encourage you to review their policies and your account settings with them where relevant.
      </p>
    </LegalSection>

    <LegalSection id="managing" title="6. How to manage or disable cookies">
      <p>
        <strong>Browser settings:</strong> Most browsers let you block or delete cookies. The exact steps depend on your browser and version. General instructions:
      </p>
      <ol>
        <li>Open your browser&apos;s <strong>Settings</strong> or <strong>Preferences</strong>.</li>
        <li>Find the <strong>Privacy</strong>, <strong>Security</strong>, or <strong>Cookies</strong> section.</li>
        <li>Choose whether to block third-party cookies, block all cookies, or delete existing cookies.</li>
        <li>Save your settings and, if needed, restart the browser.</li>
      </ol>
      <p>
        Blocking or deleting <strong>strictly necessary</strong> cookies may prevent sign-in or core features from working correctly.
      </p>
      <p>
        <strong>Industry opt-outs:</strong> Where applicable, you may use tools such as the Digital Advertising Alliance or similar regional programs to manage interest-based advertising—availability varies by region.
      </p>
    </LegalSection>

    <LegalSection id="changes" title="7. Changes">
      <p>
        We may update this Cookie Policy to reflect changes in our practices or for legal, operational, or regulatory reasons. We will post the updated policy on this page and revise the &quot;Last updated&quot; date.
      </p>
    </LegalSection>

    <LegalSection id="contact" title="8. Contact">
      <p>Questions about cookies or this policy:</p>
      <ul>
        <li>
          Email:{' '}
          <a href={`mailto:${LEGAL_CONTACT.privacyEmail}`}>{LEGAL_CONTACT.privacyEmail}</a>
        </li>
        <li>
          Address: {LEGAL_CONTACT.addressLine}
        </li>
      </ul>
    </LegalSection>
  </LegalPageLayout>
);

export default CookiePolicy;
