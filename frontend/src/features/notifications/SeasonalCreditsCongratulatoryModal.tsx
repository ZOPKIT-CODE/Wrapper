import React, { useEffect } from 'react';
import { X, CheckCircle, TrendingUp, Award, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SeasonalCreditsCongratulatoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditsAmount?: number;
  campaignName?: string;
}

export const SeasonalCreditsCongratulatoryModal: React.FC<SeasonalCreditsCongratulatoryModalProps> = ({
  isOpen,
  onClose,
  creditsAmount = 200,
  campaignName = 'Seasonal Campaign'
}) => {

  // Ensure we have valid data
  const displayCredits = creditsAmount || 200;
  const displayCampaign = campaignName || 'Seasonal Campaign';
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative max-w-md w-full">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-lg hover:bg-gray-50 text-gray-600 hover:text-gray-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <Card className="shadow-2xl border-0 overflow-hidden">
          {/* Professional Header */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-8 py-6 text-white relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Account Enhancement</h2>
                <p className="text-slate-300 text-sm">Seasonal Credit Allocation</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-slate-200">
                <p className="text-2xl font-bold">{displayCredits.toLocaleString()}</p>
                <p className="text-sm text-slate-400">Credits Added</p>
              </div>
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                {displayCampaign}
              </Badge>
            </div>
          </div>

          {/* Content */}
          <CardContent className="p-8">
            {/* Success Message */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-[#1B2E5A] mb-2">
                Credits Successfully Allocated
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Your account has been enhanced with seasonal credits as part of our ongoing commitment to your success.
              </p>
            </div>

            {/* Benefits Grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-medium text-[#1B2E5A]">Premium Features</span>
                </div>
                <p className="text-xs text-slate-600">
                  Access advanced tools and integrations
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-medium text-[#1B2E5A]">Usage Credits</span>
                </div>
                <p className="text-xs text-slate-600">
                  Apply towards service consumption
                </p>
              </div>
            </div>

            {/* Action Items */}
            <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Recommended Actions
              </h4>
              <div className="space-y-2 text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                  Review available premium features in your dashboard
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                  Explore integration options for your workflow
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                  Monitor credit usage and expiration dates
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  onClose();
                  window.location.href = '/dashboard/billing';
                }}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-medium"
              >
                Manage Credits
              </Button>
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 border-slate-300 hover:bg-slate-50"
              >
                Continue
              </Button>
            </div>

            {/* Footer note */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                Credits are subject to campaign terms and expiration dates.
                <br />
                Contact support for assistance or questions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
