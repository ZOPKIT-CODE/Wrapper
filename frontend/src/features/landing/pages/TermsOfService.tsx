import React from 'react';
import { LegalPageLayout } from '@/components/layout/LegalPageLayout';

const TermsOfService: React.FC = () => (
  <LegalPageLayout title="Terms of Service" lastUpdated="January 2026">
    <section id="acceptance">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">1. Acceptance of Terms</h2>
      <p className="text-slate-600 leading-relaxed">
        By accessing or using our website and services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
      </p>
    </section>

    <section id="use-of-service">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">2. Use of Service</h2>
      <p className="text-slate-600 leading-relaxed mb-3">
        You agree to use our services only for lawful purposes and in accordance with these terms. You must not use our services in any way that could harm, disable, or impair the service or any user&apos;s access to it.
      </p>
      <ul className="list-disc pl-6 text-slate-600 space-y-2">
        <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
        <li>You are responsible for all activity that occurs under your account.</li>
        <li>You must notify us promptly of any unauthorized use of your account.</li>
      </ul>
    </section>

    <section id="accounts">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">3. Accounts and Registration</h2>
      <p className="text-slate-600 leading-relaxed">
        To use certain features of our services, you may need to register for an account. You agree to provide accurate and complete information during registration and to keep such information up to date.
      </p>
    </section>

    <section id="payment">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">4. Payment and Billing</h2>
      <p className="text-slate-600 leading-relaxed">
        If you purchase services from us, you agree to pay all applicable fees as described at the time of purchase. Fees are non-refundable unless otherwise specified or required by law. We may change our pricing with reasonable notice.
      </p>
    </section>

    <section id="intellectual-property">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">5. Intellectual Property</h2>
      <p className="text-slate-600 leading-relaxed">
        Our services, including all content, features, and functionality, are owned by us or our licensors and are protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works from our services without our prior written consent.
      </p>
    </section>

    <section id="disclaimer">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">6. Disclaimer of Warranties</h2>
      <p className="text-slate-600 leading-relaxed">
        Our services are provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either express or implied. We do not warrant that our services will be uninterrupted, error-free, or free of harmful components.
      </p>
    </section>

    <section id="limitation">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">7. Limitation of Liability</h2>
      <p className="text-slate-600 leading-relaxed">
        To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, or goodwill.
      </p>
    </section>

    <section id="indemnity">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">8. Indemnification</h2>
      <p className="text-slate-600 leading-relaxed">
        You agree to indemnify and hold us harmless from any claims, damages, losses, or expenses (including reasonable legal fees) arising out of your use of our services or your violation of these terms.
      </p>
    </section>

    <section id="termination">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">9. Termination</h2>
      <p className="text-slate-600 leading-relaxed">
        We may suspend or terminate your access to our services at any time, with or without cause or notice. Upon termination, your right to use our services will cease immediately.
      </p>
    </section>

    <section id="governing-law">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">10. Governing Law</h2>
      <p className="text-slate-600 leading-relaxed">
        These terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions.
      </p>
    </section>

    <section id="changes">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">11. Changes to Terms</h2>
      <p className="text-slate-600 leading-relaxed">
        We may update these Terms of Service from time to time. We will post the updated terms on this page and indicate the effective date. Your continued use of our services after changes are posted constitutes your acceptance of the updated terms.
      </p>
    </section>

    <section id="contact">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">12. Contact</h2>
      <p className="text-slate-600 leading-relaxed">
        For questions about these Terms of Service, please contact us at{' '}
        <a href="mailto:hr@zopkit.com" className="text-blue-600 hover:underline">hr@zopkit.com</a> or at Hi-Tech City, Hyderabad.
      </p>
    </section>
  </LegalPageLayout>
);

export default TermsOfService;
