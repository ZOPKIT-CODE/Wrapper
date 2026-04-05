import React from 'react';
import { Link } from '@tanstack/react-router';
import { LegalPageLayout } from '@/components/layout/LegalPageLayout';
import { LegalSection } from '@/components/legal/LegalSection';
import { LEGAL_CONTACT } from '@/lib/legal-contact';

const privacyToc = [
  { id: 'who-we-are', label: 'Who we are & scope' },
  { id: 'information-we-collect', label: 'Information we collect' },
  { id: 'how-we-use', label: 'How we use information' },
  { id: 'legal-bases', label: 'Legal bases (where applicable)' },
  { id: 'sharing', label: 'Sharing & processors' },
  { id: 'international', label: 'International transfers' },
  { id: 'retention', label: 'Retention' },
  { id: 'security', label: 'Security' },
  { id: 'your-rights', label: 'Your rights & how to exercise them' },
  { id: 'children', label: 'Children' },
  { id: 'changes', label: 'Changes to this policy' },
  { id: 'contact', label: 'Contact' },
] as const;

const PrivacyPolicy: React.FC = () => (
  <LegalPageLayout
    title="Privacy Policy"
    lastUpdated="January 2026"
    docIntro={
      <>
        This policy explains how {LEGAL_CONTACT.companyLegalName} (&quot;Zopkit,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) handles personal information when you visit our website, use our cloud software, or interact with us. It should be read together with our{' '}
        <Link to="/cookies" className="text-blue-600 hover:underline">
          Cookie Policy
        </Link>
        . For subscription and payment rules, see our{' '}
        <Link to="/terms" className="text-blue-600 hover:underline">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link to="/refund-policy" className="text-blue-600 hover:underline">
          Cancellation &amp; Refund Policy
        </Link>
        .
      </>
    }
    tableOfContents={[...privacyToc]}
  >
    <LegalSection id="who-we-are" title="1. Who we are & scope">
      <p>
        <strong>Data controller:</strong> {LEGAL_CONTACT.companyLegalName}, operating the Zopkit platform and related services.
      </p>
      <p>
        This policy applies to personal information we process about visitors, trial users, paying customers, and authorized users of customer organizations (&quot;you&quot;). It covers data we process as a service provider to your employer or organization when they use Zopkit on your behalf—in those cases, your organization may also have policies that apply to you.
      </p>
    </LegalSection>

    <LegalSection id="information-we-collect" title="2. Information we collect">
      <p>We may collect the following categories of information:</p>
      <ul>
        <li>
          <strong>Information you provide:</strong> Name, email, company, role, account credentials (managed via our identity provider where applicable), information you submit through contact or demo forms, support tickets, billing and tax details, and other content you choose to provide.
        </li>
        <li>
          <strong>Information from your use of our services:</strong> Usage data, feature interactions, approximate location derived from IP address, device and browser type, diagnostics, and log data needed to operate and secure the service.
        </li>
        <li>
          <strong>Cookies and similar technologies:</strong> As described in our{' '}
          <Link to="/cookies" className="text-blue-600 hover:underline">
            Cookie Policy
          </Link>
          .
        </li>
      </ul>
    </LegalSection>

    <LegalSection id="how-we-use" title="3. How we use information">
      <p>We use personal information to:</p>
      <ul>
        <li>Provide, operate, maintain, and improve our services</li>
        <li>Authenticate users, enforce security, and prevent fraud and abuse</li>
        <li>Process payments, invoices, and subscriptions</li>
        <li>Communicate with you about the service, security, and (where permitted) relevant product information</li>
        <li>Meet legal, regulatory, and tax obligations</li>
        <li>Analyze aggregated or de-identified usage to improve our products</li>
      </ul>
    </LegalSection>

    <LegalSection id="legal-bases" title="4. Legal bases (where applicable)">
      <p>
        Depending on your jurisdiction, we rely on one or more of: <strong>performance of a contract</strong> (providing the services you or your organization requested); <strong>legitimate interests</strong> (such as securing our platform and improving our products), balanced against your rights; <strong>legal obligation</strong>; and, where required, <strong>your consent</strong> (for example, certain marketing cookies or communications where consent is the appropriate basis).
      </p>
    </LegalSection>

    <LegalSection id="sharing" title="5. Sharing & processors">
      <p>
        We may share information with subprocessors and service providers who help us run our business—such as cloud hosting, authentication, payment processing, email delivery, analytics (where used), and customer support—under contracts that require them to protect the data and use it only for the purposes we specify.
      </p>
      <p>
        We may disclose information if required by law, regulation, legal process, or governmental request, or to protect the rights, safety, and security of Zopkit, our users, or others. We do not sell your personal information as a product.
      </p>
    </LegalSection>

    <LegalSection id="international" title="6. International transfers">
      <p>
        Your information may be processed in India and in other countries where we or our subprocessors operate. Where we transfer personal data across borders, we use appropriate safeguards as required by applicable law (such as contractual clauses or other approved mechanisms).
      </p>
    </LegalSection>

    <LegalSection id="retention" title="7. Retention">
      <p>
        We retain personal information for as long as your account is active or as needed to provide the services. We may retain certain records after closure of an account where necessary for legal, tax, accounting, or security purposes, or as required by law. Retention periods vary by data category and context.
      </p>
    </LegalSection>

    <LegalSection id="security" title="8. Security">
      <p>
        We implement technical and organizational measures designed to protect personal information against unauthorized access, loss, or misuse. See our{' '}
        <Link to="/security" className="text-blue-600 hover:underline">
          Security
        </Link>{' '}
        page for a high-level overview. No method of transmission over the Internet is completely secure; we encourage you to use strong passwords and protect your credentials.
      </p>
    </LegalSection>

    <LegalSection id="your-rights" title="9. Your rights & how to exercise them">
      <p>
        Depending on where you live, you may have rights to access, correct, delete, or export your personal information; restrict or object to certain processing; withdraw consent where processing is consent-based; and lodge a complaint with a supervisory or data protection authority.
      </p>
      <p>
        <strong>To submit a request:</strong>
      </p>
      <ol>
        <li>Email us at{' '}
          <a href={`mailto:${LEGAL_CONTACT.privacyEmail}`}>{LEGAL_CONTACT.privacyEmail}</a> from the email address associated with your account (or describe your relationship to the data if you have no account).
        </li>
        <li>Include your full name, organization (if any), and a clear description of your request (e.g. access, correction, deletion).</li>
        <li>We may need to verify your identity before fulfilling certain requests. We will respond within the timeframe required by applicable law or, where no specific deadline applies, within a reasonable period.</li>
      </ol>
    </LegalSection>

    <LegalSection id="children" title="10. Children">
      <p>
        Our services are not directed at children under 16 (or the age required in your jurisdiction). We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us and we will take appropriate steps to delete it.
      </p>
    </LegalSection>

    <LegalSection id="changes" title="11. Changes to this policy">
      <p>
        We may update this Privacy Policy from time to time. We will post the revised policy on this page and update the &quot;Last updated&quot; date. Where required by law, we will provide additional notice. Your continued use of the services after the effective date of changes may constitute acceptance of the updated policy, to the extent permitted by law.
      </p>
    </LegalSection>

    <LegalSection id="contact" title="12. Contact">
      <p>
        For privacy-related questions or requests, contact {LEGAL_CONTACT.companyLegalName}:
      </p>
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

export default PrivacyPolicy;
