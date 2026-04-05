import React from 'react';
import { Link } from '@tanstack/react-router';
import { LegalPageLayout } from '@/components/layout/LegalPageLayout';
import { LegalSection } from '@/components/legal/LegalSection';
import { LEGAL_CONTACT } from '@/lib/legal-contact';

const securityToc = [
  { id: 'overview', label: 'Overview' },
  { id: 'infrastructure', label: 'Infrastructure & operations' },
  { id: 'access-control', label: 'Access control' },
  { id: 'data-protection', label: 'Data protection in transit & at rest' },
  { id: 'development', label: 'Secure development & reviews' },
  { id: 'incident-response', label: 'Incident response & notifications' },
  { id: 'reporting', label: 'How to report a security issue' },
  { id: 'compliance', label: 'Compliance & improvement' },
  { id: 'contact', label: 'Contact' },
] as const;

const Security: React.FC = () => (
  <LegalPageLayout
    title="Security"
    lastUpdated="January 2026"
    docIntro={
      <>
        This page summarizes how {LEGAL_CONTACT.companyLegalName} approaches security for the Zopkit platform. It is provided for general awareness and is not an exhaustive security specification. For how we handle personal data, see our{' '}
        <Link to="/privacy" className="text-blue-600 hover:underline">
          Privacy Policy
        </Link>
        .
      </>
    }
    tableOfContents={[...securityToc]}
  >
    <LegalSection id="overview" title="1. Overview">
      <p>
        We design and operate our services with security in mind, using layered controls across infrastructure, applications, and operations. No system is perfectly secure; we work continuously to reduce risk and respond to new threats.
      </p>
    </LegalSection>

    <LegalSection id="infrastructure" title="2. Infrastructure & operations">
      <p>
        We host our services on reputable cloud infrastructure with controls for network isolation, redundancy, monitoring, and operational resilience. Access to production environments is limited and logged according to least-privilege principles.
      </p>
    </LegalSection>

    <LegalSection id="access-control" title="3. Access control">
      <p>
        Access to customer data and production systems is restricted to authorized personnel who need it for their job (for example, support with your permission or engineering for maintenance). We use strong authentication and role-based access for internal tools.
      </p>
    </LegalSection>

    <LegalSection id="data-protection" title="4. Data protection in transit & at rest">
      <p>
        We use industry-standard encryption for data in transit (such as TLS) and protect data at rest with encryption and key management practices appropriate to our environment. Exact implementations may evolve as technology improves.
      </p>
    </LegalSection>

    <LegalSection id="development" title="5. Secure development & reviews">
      <p>
        We follow secure development practices including code review, dependency management, and vulnerability assessment appropriate to our release process. We aim to patch critical issues in a timely manner.
      </p>
    </LegalSection>

    <LegalSection id="incident-response" title="6. Incident response & notifications">
      <p>
        We maintain procedures to detect, investigate, and recover from security incidents affecting our services. If a breach materially affects personal data we process on behalf of users, we will notify affected parties and regulators as required by applicable law.
      </p>
    </LegalSection>

    <LegalSection id="reporting" title="7. How to report a security issue">
      <p>
        If you believe you have found a security vulnerability in our services, please report it responsibly. <strong>Do not</strong> perform testing that could harm users, degrade production systems, or access data that is not yours.
      </p>
      <p>
        <strong>What to include in your report:</strong>
      </p>
      <ul>
        <li>A clear description of the issue and affected product or URL</li>
        <li>Steps to reproduce (if possible) and estimated severity</li>
        <li>Your contact information so we can follow up</li>
      </ul>
      <p>
        Send reports to:{' '}
        <a href={`mailto:${LEGAL_CONTACT.securityEmail}?subject=Security%20report`}>{LEGAL_CONTACT.securityEmail}</a>
        . We appreciate good-faith disclosures and will work with you to understand and address valid findings.
      </p>
    </LegalSection>

    <LegalSection id="compliance" title="8. Compliance & improvement">
      <p>
        We align our practices with applicable legal requirements and industry expectations where relevant to our business. Security is an ongoing process—we regularly review and improve controls as our services evolve.
      </p>
    </LegalSection>

    <LegalSection id="contact" title="9. Contact">
      <p>
        General security inquiries:{' '}
        <a href={`mailto:${LEGAL_CONTACT.securityEmail}`}>{LEGAL_CONTACT.securityEmail}</a>
      </p>
      <p>Address: {LEGAL_CONTACT.addressLine}</p>
    </LegalSection>
  </LegalPageLayout>
);

export default Security;
