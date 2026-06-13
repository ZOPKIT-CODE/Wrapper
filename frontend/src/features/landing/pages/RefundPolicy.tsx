import React from 'react'
import { Link } from '@tanstack/react-router'
import { LegalPageLayout } from '@/components/layout/LegalPageLayout'
import { LegalSection } from '@/components/legal/LegalSection'
import { LEGAL_CONTACT } from '@/lib/legal-contact'

const refundToc = [
  { id: 'overview', label: 'Overview' },
  { id: 'subscriptions', label: 'Subscriptions & billing' },
  { id: 'cancellation', label: 'Cancellation & non-renewal' },
  { id: 'refunds', label: 'No refunds after purchase' },
  { id: 'trials', label: 'Trials & promotions' },
  { id: 'digital', label: 'Digital delivery' },
  { id: 'changes', label: 'Changes to this policy' },
  { id: 'contact', label: 'Contact & billing help' },
] as const

const RefundPolicy: React.FC = () => (
  <LegalPageLayout
    title="Cancellation & Refund Policy"
    lastUpdated="January 2026"
    docIntro={
      <div className="space-y-3">
        <p className="text-primary font-semibold">Summary</p>
        <ul className="list-disc space-y-1.5 pl-5 text-slate-700">
          <li>
            <strong>No refunds</strong> of subscription fees once payment has
            been successfully processed for a billing period.
          </li>
          <li>
            You are <strong>committed for the full prepaid term</strong> you
            purchase (for example, a full year on an annual plan). We do not
            refund unused time or remaining months.
          </li>
          <li>
            You may <strong>turn off auto-renewal</strong> so you are not
            charged again after the current term ends; this does not refund the
            current term.
          </li>
        </ul>
        <p className="pt-1 text-slate-600">
          This Policy works together with our{' '}
          <Link
            to="/terms"
            className="font-medium text-blue-600 hover:underline"
          >
            Terms of Service
          </Link>
          . Nothing here limits mandatory rights under applicable law.
        </p>
      </div>
    }
    tableOfContents={[...refundToc]}
  >
    <LegalSection id="overview" title="1. Overview">
      <p>
        This Cancellation &amp; Refund Policy (&quot;Policy&quot;) explains how
        subscriptions, renewals, cancellations, and refunds work for{' '}
        {LEGAL_CONTACT.companyLegalName}&apos;s (&quot;Zopkit,&quot;
        &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) software and
        services.{' '}
        <strong>
          Once you purchase a paid plan, fees are non-refundable for that
          subscription term.
        </strong>{' '}
        You remain committed for the full prepaid period you selected (for
        example, a full year on an annual plan) until that term ends.
      </p>
    </LegalSection>

    <LegalSection id="subscriptions" title="2. Subscriptions & billing">
      <p>
        Paid plans are billed according to the plan you choose at checkout (for
        example, monthly or annually). Fees are charged{' '}
        <strong>in advance</strong> for each billing period. Your subscription
        runs for the entire period you pay for—such as a full twelve months on
        an annual subscription—and you are obligated for that period.
      </p>
      <p>We do not provide refunds or credits for:</p>
      <ul>
        <li>Partial periods or unused time within a prepaid term</li>
        <li>Choosing not to use the product during the subscription</li>
        <li>
          Downgrading or cancelling mid-term (see below for what
          &quot;cancel&quot; means)
        </li>
      </ul>
      <p>
        You are responsible for keeping billing and contact information
        accurate. Taxes and government charges (such as GST) may apply based on
        your location and will be shown before you complete payment where
        required.
      </p>
    </LegalSection>

    <LegalSection id="cancellation" title="3. Cancellation & non-renewal">
      <p>
        In this Policy, &quot;cancellation&quot; means{' '}
        <strong>stopping future renewals</strong>, not receiving money back for
        time you already paid for.
      </p>
      <p>
        <strong>How to turn off automatic renewal:</strong>
      </p>
      <ol>
        <li>
          Sign in to your account and open <strong>Billing</strong> or{' '}
          <strong>Subscription</strong> settings (exact labels may vary by
          product), <em>or</em>
        </li>
        <li>
          Email{' '}
          <a href={`mailto:${LEGAL_CONTACT.billingEmail}`}>
            {LEGAL_CONTACT.billingEmail}
          </a>{' '}
          from your registered email and ask to disable auto-renewal for your
          subscription.
        </li>
      </ol>
      <p>
        When auto-renewal is off, you will <strong>not</strong> be charged for
        the next period after your current prepaid term ends. Your access to
        paid features typically continues until the end of the period you
        already paid for.
      </p>
      <p>
        We may suspend or terminate access for non-payment, breach of our Terms
        of Service, or as permitted by law or contract.
      </p>
    </LegalSection>

    <LegalSection id="refunds" title="4. No refunds after purchase">
      <p>
        <strong>
          All fees are final once payment is successfully processed.
        </strong>{' '}
        We do not offer refunds, returns, or credits for subscription fees after
        purchase, including if you change your mind, cancel mid-term, or do not
        use the service.
      </p>
      <p>
        For annual and other multi-month plans, you must remain through the{' '}
        <strong>full subscription period you paid for</strong>; we do not refund
        remaining months or weeks.
      </p>
      <p>
        <strong>Billing errors only:</strong> Nothing in this Policy limits
        rights you may have under mandatory law. If you believe a charge was{' '}
        <strong>duplicated</strong> or made in <strong>clear error</strong> (for
        example, you were charged twice for the same period), contact us at{' '}
        <a href={`mailto:${LEGAL_CONTACT.billingEmail}`}>
          {LEGAL_CONTACT.billingEmail}
        </a>{' '}
        with your account ID, invoice or transaction reference, and dates. We
        will review genuine billing mistakes; we do not provide discretionary
        refunds of valid subscription fees.
      </p>
    </LegalSection>

    <LegalSection id="trials" title="5. Trials & promotional offers">
      <p>
        If we offer a free trial or promotional pricing, the terms shown at
        sign-up or checkout apply. When a trial converts to a paid plan, the
        same no-refund rules and full-term commitment apply to each billing
        period you pay for, unless the offer explicitly states otherwise in
        writing.
      </p>
    </LegalSection>

    <LegalSection id="digital" title="6. Digital delivery">
      <p>
        Our services are delivered digitally. There are no physical goods or
        shipping charges for standard software access. If delivery methods
        change, we will describe them in your order confirmation or account.
      </p>
    </LegalSection>

    <LegalSection id="changes" title="7. Changes to this policy">
      <p>
        We may update this Policy from time to time. The &quot;Last
        updated&quot; date at the top of this page reflects the latest version.
        Continued use of paid services after updates may constitute acceptance
        of the revised Policy where permitted by law.
      </p>
    </LegalSection>

    <LegalSection id="contact" title="8. Contact & billing help">
      <p>For subscriptions, billing, or questions about this Policy:</p>
      <ul>
        <li>
          Email:{' '}
          <a href={`mailto:${LEGAL_CONTACT.billingEmail}`}>
            {LEGAL_CONTACT.billingEmail}
          </a>
        </li>
        <li>
          Phone:{' '}
          <a href={`tel:${LEGAL_CONTACT.phoneTel}`}>
            {LEGAL_CONTACT.phoneDisplay}
          </a>
        </li>
        <li>Address: {LEGAL_CONTACT.addressLine}</li>
      </ul>
    </LegalSection>
  </LegalPageLayout>
)

export default RefundPolicy
