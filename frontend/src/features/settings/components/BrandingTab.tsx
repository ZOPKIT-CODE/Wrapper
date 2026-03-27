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
      <Card>
        <CardHeader>
          <CardTitle>Branding & Customization</CardTitle>
          <CardDescription>
            Customize your company's visual identity and domain
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="primaryColor">Primary Brand Color</Label>
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
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Choose your primary brand color (used in UI elements)
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="customDomain">
              <Globe className="h-4 w-4 inline mr-1" />
              Custom Domain
            </Label>
            <Input
              id="customDomain"
              {...form.register('customDomain')}
              placeholder="app.yourcompany.com"
            />
            <p className="text-sm text-muted-foreground">
              Set up a custom domain for your Zopkit workspace
            </p>
            <div className="mt-2 p-3 bg-muted rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                <p className="text-sm text-muted-foreground">
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
