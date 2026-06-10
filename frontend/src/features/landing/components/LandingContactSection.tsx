import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { toast } from 'sonner';

export type ContactFormState = {
  name: string;
  email: string;
  company: string;
  phone: string;
  jobTitle: string;
  companySize: string;
  preferredTime: string;
  comments: string;
};

type LandingContactSectionProps = {
  contactForm: ContactFormState;
  setContactForm: React.Dispatch<React.SetStateAction<ContactFormState>>;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
};

export function LandingContactSection({
  contactForm,
  setContactForm,
  isSubmitting,
  setIsSubmitting,
}: LandingContactSectionProps) {
  return (
    <section id="contact" className="py-16 sm:py-24 bg-background border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14">
          <div className="lg:col-span-4 lg:pt-2">
            <p className="landing-section-eyebrow landing-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Sales
            </p>
            <h2 className="mt-2 landing-display text-3xl font-semibold text-foreground">
              Talk to sales
            </h2>
            <p className="mt-3 text-muted-foreground text-sm leading-relaxed max-w-xs">
              We reply within one business day. Hyderabad office, Mon-Fri 9-6 IST.
            </p>
            <dl className="mt-8 space-y-4 text-sm">
              <div>
                <dt className="landing-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Email
                </dt>
                <dd className="mt-1">
                  <a
                    href="mailto:sales@zopkit.com"
                    className="text-foreground hover:text-primary transition-colors"
                  >
                    sales@zopkit.com
                  </a>
                </dd>
              </div>
              <div>
                <dt className="landing-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Phone
                </dt>
                <dd className="mt-1">
                  <a href="tel:8971055515" className="text-foreground hover:text-primary transition-colors">
                    8971055515
                  </a>
                </dd>
              </div>
              <div>
                <dt className="landing-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Office
                </dt>
                <dd className="mt-1 text-foreground">Hi-Tech City, Hyderabad</dd>
              </div>
            </dl>
          </div>

          <form
            className="lg:col-span-8 landing-contact-form grid sm:grid-cols-2 gap-x-6 gap-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              setIsSubmitting(true);
              try {
                const response = await api.post('/contact/submit', contactForm);
                if (response.data.success) {
                  toast.success("Thanks. We'll be in touch within one business day.");
                  setContactForm({
                    name: '',
                    email: '',
                    company: '',
                    phone: '',
                    jobTitle: '',
                    companySize: '',
                    preferredTime: '',
                    comments: '',
                  });
                } else {
                  throw new Error(response.data.message || 'Failed to submit');
                }
              } catch (error: unknown) {
                const message =
                  error &&
                  typeof error === 'object' &&
                  'response' in error &&
                  error.response &&
                  typeof error.response === 'object' &&
                  'data' in error.response &&
                  error.response.data &&
                  typeof error.response.data === 'object' &&
                  'message' in error.response.data &&
                  typeof error.response.data.message === 'string'
                    ? error.response.data.message
                    : 'Something went wrong. Please try again.';
                toast.error(message);
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            <div className="space-y-1.5 sm:col-span-1">
              <label htmlFor="c-name" className="text-sm font-medium">
                Name
              </label>
              <input
                id="c-name"
                required
                value={contactForm.name}
                onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full h-10 px-3 rounded-sm border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Priya Mehta"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <label htmlFor="c-email" className="text-sm font-medium">
                Work email
              </label>
              <input
                id="c-email"
                type="email"
                required
                value={contactForm.email}
                onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full h-10 px-3 rounded-sm border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="priya@company.com"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <label htmlFor="c-company" className="text-sm font-medium">
                Company
              </label>
              <input
                id="c-company"
                required
                value={contactForm.company}
                onChange={(e) => setContactForm((p) => ({ ...p, company: e.target.value }))}
                className="w-full h-10 px-3 rounded-sm border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Northline Logistics"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <label htmlFor="c-size" className="text-sm font-medium">
                Team size
              </label>
              <select
                id="c-size"
                value={contactForm.companySize}
                onChange={(e) => setContactForm((p) => ({ ...p, companySize: e.target.value }))}
                className="w-full h-10 px-3 rounded-sm border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select</option>
                <option value="1-10">1-10</option>
                <option value="11-50">11-50</option>
                <option value="51-200">51-200</option>
                <option value="201-500">201-500</option>
                <option value="500+">500+</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="c-msg" className="text-sm font-medium">
                Message
              </label>
              <textarea
                id="c-msg"
                rows={4}
                value={contactForm.comments}
                onChange={(e) => setContactForm((p) => ({ ...p, comments: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-sm border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                placeholder="What should connect first in your stack?"
              />
            </div>
            <div className="sm:col-span-2 flex items-center justify-between gap-4 flex-wrap">
                  <Button type="submit" disabled={isSubmitting} className="landing-btn-primary rounded-full h-10 px-6 font-medium">
                {isSubmitting ? 'Sending...' : 'Send message'}
              </Button>
              <p className="text-xs text-muted-foreground landing-mono">
                Typical reply within 1 business day
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
