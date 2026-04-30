import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { TabsContent } from '@/components/ui/tabs';
import { Globe, AlertCircle } from 'lucide-react';
import type { AccountSettingsData } from '../types';

interface BrandingTabProps {
  form: UseFormReturn<AccountSettingsData>;
}

export const BrandingTab: React.FC<BrandingTabProps> = ({ form }) => {
  return (
    <TabsContent value="branding" className="space-y-6">
      <Card style={{ border: '1px solid var(--zk-line)' }}>
        <CardHeader>
          <CardTitle
            style={{
              fontFamily: 'var(--zk-display)',
              letterSpacing: '-0.025em',
              color: 'var(--zk-ink)',
            }}
          >
            Branding & Customization
          </CardTitle>
          <CardDescription
            style={{
              fontFamily: 'var(--zk-font)',
              color: 'var(--zk-muted)',
              fontSize: 13,
            }}
          >
            Customize your company's visual identity and domain
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label
              htmlFor="primaryColor"
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--zk-muted)',
                fontFamily: 'var(--zk-font)',
              }}
            >
              Primary Brand Color
            </Label>
            <div className="flex items-center gap-4">
              <Input
                id="primaryColor"
                type="color"
                {...form.register('primaryColor')}
                className="w-20 h-10 cursor-pointer"
              />
              <Input
                {...form.register('primaryColor')}
                placeholder="#2563eb"
                className="flex-1"
                style={{ fontSize: 13, fontFamily: 'var(--zk-font)', color: 'var(--zk-ink)' }}
              />
            </div>
            <p
              style={{
                fontSize: 12,
                color: 'var(--zk-muted-2)',
                fontFamily: 'var(--zk-font)',
              }}
            >
              Choose your primary brand color (used in UI elements)
            </p>
          </div>

          <Separator style={{ borderColor: 'var(--zk-line)' }} />

          <div className="space-y-2">
            <Label
              htmlFor="customDomain"
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--zk-muted)',
                fontFamily: 'var(--zk-font)',
              }}
            >
              <Globe className="h-4 w-4 inline mr-1" />
              Custom Domain
            </Label>
            <Input
              id="customDomain"
              {...form.register('customDomain')}
              placeholder="app.yourcompany.com"
              style={{ fontSize: 13, fontFamily: 'var(--zk-font)', color: 'var(--zk-ink)' }}
            />
            <p
              style={{
                fontSize: 12,
                color: 'var(--zk-muted-2)',
                fontFamily: 'var(--zk-font)',
              }}
            >
              Set up a custom domain for your Zopkit workspace
            </p>
            <div
              className="mt-2 p-3 rounded-lg"
              style={{ background: 'var(--zk-bg-2)' }}
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5" style={{ color: 'var(--zk-muted-2)' }} />
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--zk-muted-2)',
                    fontFamily: 'var(--zk-font)',
                  }}
                >
                  After adding your domain, you'll need to configure DNS records.
                  Our support team will guide you through the process.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
};
