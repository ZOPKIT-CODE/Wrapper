import React from 'react';
import { Link } from '@tanstack/react-router';
import { LegalPageLayout } from '@/components/layout/LegalPageLayout';
import { LegalSection } from '@/components/legal/LegalSection';
import { LEGAL_CONTACT } from '@/lib/legal-contact';

const termsToc = [
  { id: 'acceptance', label: 'Acceptance & other documents' },
  { id: 'eligibility', label: 'Eligibility & account' },
  { id: 'use-of-service', label: 'Acceptable use' },
  { id: 'payment', label: 'Payment, subscriptions & taxes' },
  { id: 'intellectual-property', label: 'Intellectual property' },
  { id: 'disclaimer', label: 'Disclaimer of warranties' },
  { id: 'limitation', label: 'Limitation of liability' },
  { id: 'indemnity', label: 'Indemnification' },
  { id: 'termination', label: 'Suspension & termination' },
  { id: 'governing-law', label: 'Governing law & disputes' },
  { id: 'changes', label: 'Changes to these terms' },
  { id: 'contact', label: 'Contact' },
] as const;

const TermsOfService: React.FC = () => (
  <LegalPageLayout
    title="Terms of Service"
    lastUpdated="January 2026"
    docIntro={
      <>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of websites, applications, and services offered by {LEGAL_CONTACT.companyLegalName} (&quot;Zopkit,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By using our services, you agree to these Terms and to our{' '}
        <Link to="/privacy" className="text-blue-600 hover:underline">
          Privacy Policy
        </Link>
        . Paid subscriptions are also subject to our{' '}
        <Link to="/refund-policy" className="text-blue-600 hover:underline">
          Cancellation &amp; Refund Policy
        </Link>
        .
      </>
    }
    tableOfContents={[...termsToc]}
  >
    <LegalSection id="acceptance" title="1. Acceptance & other documents">
      <p>
        If you do not agree to these Terms, do not access or use our services. If you are accepting these Terms on behalf of a company or other legal entity, you represent that you have authority to bind that entity.
      </p>
      <p>
        Additional terms (such as order forms, data processing terms, or product-specific terms) may apply; if there is a conflict, the more specific terms govern for that subject matter.
      </p>
    </LegalSection>

    <LegalSection id="eligibility" title="2. Eligibility & account">
      <p>
        You must be able to form a binding contract under applicable law to use the services. You are responsible for providing accurate registration information and for maintaining the confidentiality of your account credentials.
      </p>
      <ul>
        <li>You are responsible for all activity that occurs under your account.</li>
        <li>You must notify us promptly of any unauthorized access or security incident at the contact below.</li>
        <li>We may refuse registration or suspend accounts that violate these Terms or pose a security risk.</li>
      </ul>
    </LegalSection>

    <LegalSection id="use-of-service" title="3. Acceptable use">
      <p>You agree to use our services only for lawful purposes and in accordance with these Terms. You must not:</p>
      <ul>
        <li>Attempt to gain unauthorized access to our systems, other users&apos; data, or third-party systems through our services</li>
        <li>Introduce malware, overload or disrupt the service, or circumvent security or usage limits</li>
        <li>Use the services to violate applicable laws, infringe intellectual property, or harass others</li>
        <li>Reverse engineer, resell, or sublicense the services except as expressly permitted in writing</li>
      </ul>
    </LegalSection>

    <LegalSection id="payment" title="4. Payment, subscriptions & taxes">
      <p>
        If you purchase paid services, you agree to pay all fees shown at checkout or in an order form, when due. Fees are typically billed in advance for each subscription term. <strong>Fees are non-refundable for the prepaid term except as stated in our</strong>{' '}
        <Link to="/refund-policy" className="text-blue-600 hover:underline font-semibold">
          Cancellation &amp; Refund Policy
        </Link>{' '}
        <strong>or as required by mandatory law.</strong>
      </p>
      <p>
        You are responsible for applicable taxes (such as GST) unless we state otherwise. We may change pricing for future renewal terms with reasonable notice where required by law or contract.
      </p>
      <p>
        <strong>How to manage billing:</strong> Subscription changes, cancellation of auto-renewal, and payment methods are managed through your account billing settings or by contacting{' '}
        <a href={`mailto:${LEGAL_CONTACT.billingEmail}`}>{LEGAL_CONTACT.billingEmail}</a>, as described in the Cancellation &amp; Refund Policy.
      </p>
    </LegalSection>

    <LegalSection id="intellectual-property" title="5. Intellectual property">
      <p>
        The services, including software, branding, documentation, and content we provide (excluding your data and content you upload), are owned by Zopkit or our licensors and are protected by intellectual property laws. We grant you a limited, non-exclusive, non-transferable right to access and use the services during your subscription in line with these Terms.
      </p>
      <p>You may not copy, modify, distribute, sell, or create derivative works from our services except as expressly allowed in writing.</p>
    </LegalSection>

    <LegalSection id="disclaimer" title="6. Disclaimer of warranties">
      <p>
        To the maximum extent permitted by law, the services are provided <strong>&quot;as is&quot;</strong> and <strong>&quot;as available&quot;</strong> without warranties of any kind, whether express or implied, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the services will be uninterrupted, error-free, or free of harmful components.
      </p>
    </LegalSection>

    <LegalSection id="limitation" title="7. Limitation of liability">
      <p>
        To the maximum extent permitted by law, neither Zopkit nor its suppliers shall be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, revenues, goodwill, data, or business opportunities, arising out of or related to these Terms or the services, even if advised of the possibility of such damages.
      </p>
      <p>
        Our aggregate liability for all claims arising out of or related to the services or these Terms shall not exceed the greater of (a) the amounts you paid to us for the services in the twelve (12) months before the event giving rise to the claim, or (b) the minimum amount permitted by applicable law. Some jurisdictions do not allow certain limitations; in those cases, our liability is limited to the fullest extent permitted.
      </p>
    </LegalSection>

    <LegalSection id="indemnity" title="8. Indemnification">
      <p>
        You agree to defend, indemnify, and hold harmless Zopkit and its affiliates, officers, and employees from any claims, damages, losses, liabilities, and expenses (including reasonable attorneys&apos; fees) arising from your use of the services, your content or data, or your violation of these Terms, except to the extent caused by our gross negligence or willful misconduct.
      </p>
    </LegalSection>

    <LegalSection id="termination" title="9. Suspension & termination">
      <p>
        We may suspend or terminate access to the services if you materially breach these Terms, fail to pay fees when due, or if we must do so to comply with law or protect security. You may stop using the services at any time; turning off renewal is described in our Cancellation &amp; Refund Policy.
      </p>
      <p>Upon termination, your right to access the services ends; provisions that by their nature should survive (including payment obligations accrued, liability limits, and intellectual property) will survive.</p>
    </LegalSection>

    <LegalSection id="governing-law" title="10. Governing law & disputes">
      <p>
        These Terms are governed by the laws of <strong>India</strong>, without regard to conflict-of-law rules that would apply another jurisdiction&apos;s laws. Courts located in India shall have exclusive jurisdiction over disputes arising from these Terms or the services, subject to any mandatory rights you may have in your country of residence.
      </p>
    </LegalSection>

    <LegalSection id="changes" title="11. Changes to these terms">
      <p>
        We may modify these Terms from time to time. We will post the updated Terms on this page and update the &quot;Last updated&quot; date. For material changes, we may provide additional notice (for example, by email or in-product notice) where required by law. Continued use of the services after the effective date may constitute acceptance of the revised Terms.
      </p>
    </LegalSection>

    <LegalSection id="contact" title="12. Contact">
      <p>For questions about these Terms, contact:</p>
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

export default TermsOfService;
