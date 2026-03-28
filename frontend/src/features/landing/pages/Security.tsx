import React from 'react';
import { LegalPageLayout } from '@/components/layout/LegalPageLayout';

const Security: React.FC = () => (
  <LegalPageLayout title="Security" lastUpdated="January 2026">
    <section id="overview">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">1. Overview</h2>
      <p className="text-slate-600 leading-relaxed">
        At Zopkit Inc., we take the security of your data seriously. This page outlines the measures we take to protect our platform, your information, and your use of our services.
      </p>
    </section>

    <section id="infrastructure">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">2. Infrastructure and Operations</h2>
      <p className="text-slate-600 leading-relaxed">
        We use industry-standard infrastructure and practices to host and operate our services. Our systems are designed to maintain availability, integrity, and confidentiality of data.
      </p>
    </section>

    <section id="access-control">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">3. Access Control</h2>
      <p className="text-slate-600 leading-relaxed">
        Access to our systems and to your data is restricted to authorized personnel only. We use strong authentication and role-based access controls to ensure that only those who need access for legitimate purposes can access sensitive information.
      </p>
    </section>

    <section id="data-protection">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">4. Data Protection</h2>
      <p className="text-slate-600 leading-relaxed">
        We protect data in transit and at rest using industry-standard encryption and security protocols. We follow secure development practices and regularly review our systems for vulnerabilities.
      </p>
    </section>

    <section id="incident-response">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">5. Incident Response</h2>
      <p className="text-slate-600 leading-relaxed">
        We have processes in place to detect, respond to, and recover from security incidents. In the event of a breach that affects your data, we will notify affected parties and regulators as required by applicable law.
      </p>
    </section>

    <section id="compliance">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">6. Compliance</h2>
      <p className="text-slate-600 leading-relaxed">
        We work to align our security practices with applicable laws and industry standards. We continuously evaluate and improve our security posture.
      </p>
    </section>

    <section id="contact">
      <h2 className="text-xl font-bold text-[#1B2E5A] mb-4">7. Contact</h2>
      <p className="text-slate-600 leading-relaxed">
        For security-related questions or to report a potential security issue, please contact us at{' '}
        <a href="mailto:hr@zopkit.com" className="text-blue-600 hover:underline">hr@zopkit.com</a> or at Hi-Tech City, Hyderabad.
      </p>
    </section>
  </LegalPageLayout>
);

export default Security;
