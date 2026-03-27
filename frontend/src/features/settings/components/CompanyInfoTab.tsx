import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Building2, CheckCircle2 } from 'lucide-react';
import type { AccountSettingsData } from '../types';

interface CompanyInfoTabProps {
  form: UseFormReturn<AccountSettingsData>;
  logoPreview: string | null;
  logoFile: File | null;
  handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const CompanyInfoTab: React.FC<CompanyInfoTabProps> = ({
  form,
  logoPreview,
  logoFile,
  handleLogoUpload,
}) => {
  return (
    <TabsContent value="company" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>
            Update your company's legal name and logo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="legalCompanyName">Legal Company Name</Label>
            <Input
              id="legalCompanyName"
              {...form.register('legalCompanyName')}
              placeholder="Enter legal company name"
            />
            <p className="text-sm text-muted-foreground">
              This is your official registered company name (may differ from display name)
            </p>
          </div>

          <Separator />

          <div className="space-y-4">
            <Label>Company Logo</Label>
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Company logo"
                    className="w-32 h-32 object-contain border rounded-lg bg-muted p-2"
                  />
                ) : (
                  <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="cursor-pointer"
                />
                <p className="text-sm text-muted-foreground">
                  Upload your company logo (PNG, JPG, SVG up to 5MB)
                </p>
                {logoFile && (
                  <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                    <CheckCircle2 className="h-3 w-3" />
                    {logoFile.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
};
