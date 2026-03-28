import React from 'react';
import { LegalPageLayout } from '@/components/layout/LegalPageLayout';

const CookiePolicy: React.FC = () => (
  <LegalPageLayout title="Cookie Policy" lastUpdated="January 2026">
    <section id="introduction">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">1. Introduction</h2>
      <p className="text-slate-600 leading-relaxed">
        This Cookie Policy explains how Zopkit Inc. (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) uses cookies and similar technologies when you use our website and services. For more information about how we handle your personal data, please see our{' '}
        <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>.
      </p>
    </section>

    <section id="what-are-cookies">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">2. What Are Cookies</h2>
      <p className="text-slate-600 leading-relaxed">
        Cookies are small text files that are stored on your device when you visit a website. They are widely used to make websites work more efficiently, to remember your preferences, and to provide information to the site owners.
      </p>
    </section>

    <section id="how-we-use">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">3. How We Use Cookies</h2>
      <p className="text-slate-600 leading-relaxed mb-3">
        We use cookies and similar technologies for the following purposes:
      </p>
      <ul className="list-disc pl-6 text-slate-600 space-y-2">
        <li><strong>Essential:</strong> Required for the operation of our website and services (e.g. authentication, security).</li>
        <li><strong>Functionality:</strong> To remember your preferences and settings.</li>
        <li><strong>Analytics:</strong> To understand how visitors use our website and to improve our services (where we use such cookies, we do so in line with applicable law).</li>
      </ul>
    </section>

    <section id="types">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">4. Types of Cookies We Use</h2>
      <p className="text-slate-600 leading-relaxed mb-3">
        We may use session cookies (which expire when you close your browser) and persistent cookies (which remain on your device for a set period or until you delete them). We may also use first-party cookies (set by us) and third-party cookies (set by service providers that assist us).
      </p>
    </section>

    <section id="managing">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">5. Managing Cookies</h2>
      <p className="text-slate-600 leading-relaxed">
        Most browsers allow you to refuse or accept cookies, and to delete existing cookies. You can usually adjust your cookie settings in your browser&apos;s preferences or settings. Please note that disabling certain cookies may affect the functionality of our website.
      </p>
    </section>

    <section id="changes">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">6. Changes to This Policy</h2>
      <p className="text-slate-600 leading-relaxed">
        We may update this Cookie Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will post the updated policy on this page and indicate the effective date.
      </p>
    </section>

    <section id="contact">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">7. Contact</h2>
      <p className="text-slate-600 leading-relaxed">
        If you have questions about our use of cookies, please contact us at{' '}
        <a href="mailto:hr@zopkit.com" className="text-blue-600 hover:underline">hr@zopkit.com</a> or at Hi-Tech City, Hyderabad.
      </p>
    </section>
  </LegalPageLayout>
);

export default CookiePolicy;
