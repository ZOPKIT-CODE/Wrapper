import React from 'react';
import { LegalPageLayout } from '@/components/layout/LegalPageLayout';

const PrivacyPolicy: React.FC = () => (
  <LegalPageLayout title="Privacy Policy" lastUpdated="January 2026">
    <section id="introduction">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">1. Introduction</h2>
      <p className="text-slate-600 leading-relaxed">
        This Privacy Policy describes how Zopkit Inc. (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collects, uses, and protects your information when you use our website and services. This policy applies to our platform and related offerings. If you have questions about this policy, please contact us at{' '}
        <a href="mailto:hr@zopkit.com" className="text-blue-600 hover:underline">hr@zopkit.com</a>.
      </p>
    </section>

    <section id="information-we-collect">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">2. Information We Collect</h2>
      <p className="text-slate-600 leading-relaxed mb-3">We may collect the following categories of information:</p>
      <ul className="list-disc pl-6 text-slate-600 space-y-2">
        <li><strong>Information you provide:</strong> Account and sign-up details, information you submit through contact or demo request forms, support requests, and billing-related information.</li>
        <li><strong>Information from your use of our services:</strong> Usage data, device information, and log data when you access our platform.</li>
        <li><strong>Cookies and similar technologies:</strong> We use cookies and similar technologies for essential operation of our services. Where we use non-essential cookies (e.g. for analytics), we do so in line with applicable law.</li>
      </ul>
    </section>

    <section id="how-we-use">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">3. How We Use Your Information</h2>
      <p className="text-slate-600 leading-relaxed mb-3">We use the information we collect to:</p>
      <ul className="list-disc pl-6 text-slate-600 space-y-2">
        <li>Provide, operate, and improve our services</li>
        <li>Process payments and manage your account</li>
        <li>Communicate with you about our services and, where permitted, marketing</li>
        <li>Ensure security, prevent fraud, and comply with legal obligations</li>
      </ul>
    </section>

    <section id="sharing">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">4. Sharing of Information</h2>
      <p className="text-slate-600 leading-relaxed">
        We may share your information with service providers that assist us in operating our business (such as hosting, payments, and support). We may also disclose information when required by law or to protect our rights and safety. We do not sell your personal information.
      </p>
    </section>

    <section id="retention">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">5. Data Retention</h2>
      <p className="text-slate-600 leading-relaxed">
        We retain your information for as long as your account is active or as needed to provide our services. We may retain certain information for a reasonable period thereafter and as required by law (for example, for tax or legal compliance).
      </p>
    </section>

    <section id="security">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">6. Security</h2>
      <p className="text-slate-600 leading-relaxed">
        We take reasonable measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
      </p>
    </section>

    <section id="your-rights">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">7. Your Rights</h2>
      <p className="text-slate-600 leading-relaxed">
        Depending on your location, you may have rights to access, correct, delete, or restrict the use of your data, and to object to certain processing or withdraw consent where it applies. You may also have the right to lodge a complaint with a data protection authority. To exercise your rights, please contact us at{' '}
        <a href="mailto:hr@zopkit.com" className="text-blue-600 hover:underline">hr@zopkit.com</a>.
      </p>
    </section>

    <section id="children">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">8. Children</h2>
      <p className="text-slate-600 leading-relaxed">
        Our services are not directed to children. We do not knowingly collect personal information from children.
      </p>
    </section>

    <section id="changes">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">9. Changes to This Policy</h2>
      <p className="text-slate-600 leading-relaxed">
        We may update this Privacy Policy from time to time. We will post the updated policy on this page and indicate the effective date. Your continued use of our services after changes are posted constitutes your acceptance of the updated policy.
      </p>
    </section>

    <section id="contact">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">10. Contact</h2>
      <p className="text-slate-600 leading-relaxed">
        For privacy-related questions or requests, please contact us at{' '}
        <a href="mailto:hr@zopkit.com" className="text-blue-600 hover:underline">hr@zopkit.com</a>. You may also reach us at Hi-Tech City, Hyderabad.
      </p>
    </section>
  </LegalPageLayout>
);

export default PrivacyPolicy;
