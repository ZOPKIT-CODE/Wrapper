import React from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  XCircle,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  HelpCircle,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

const PaymentCancelled: React.FC = () => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, string>;

  const paymentType = search['type'] || 'subscription';
  const error = search['error'];
  const reason = search['reason'];

  const getErrorMessage = () => {
    if (error) {
      switch (error) {
        case 'card_declined':
          return 'Your card was declined. Please try a different payment method or contact your bank.';
        case 'insufficient_funds':
          return 'Insufficient funds on your card. Please check your balance or try a different card.';
        case 'expired_card':
          return 'Your card has expired. Please update your payment information.';
        case 'processing_error':
          return 'There was a processing error. Please try again or contact support.';
        default:
          return 'Payment was cancelled. No charges were made to your account.';
      }
    }
    return 'Payment was cancelled. No charges were made to your account.';
  };

  const getTroubleshootingSteps = () => {
    if (paymentType === 'credit_purchase') {
      return [
        'Check your credit card details and billing address',
        'Ensure sufficient funds are available',
        'Try a different payment method',
        'Contact your bank if the issue persists',
        'Check your internet connection and try again'
      ];
    } else {
      return [
        'Verify your billing information is correct',
        'Check that your card has sufficient funds',
        'Try using a different credit card',
        'Ensure your billing address matches your card',
        'Contact your card issuer if problems continue'
      ];
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          {/* Error Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
              <XCircle className="h-12 w-12 text-red-600" />
            </div>
            <h1 className="text-4xl font-bold text-primary mb-4">
              Payment Cancelled
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              {paymentType === 'credit_purchase'
                ? 'Your credit purchase was not completed.'
                : 'Your subscription upgrade was not completed.'}
            </p>
          </div>

          {/* Error Details */}
          <Card className="mb-8 bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center text-red-700">
                <AlertTriangle className="h-5 w-5 mr-2" />
                What Happened
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-red-800">
                  {getErrorMessage()}
                </AlertDescription>
              </Alert>

              {reason && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <strong>Reason:</strong> {reason}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Troubleshooting Steps */}
          <Card className="mb-8 bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center text-blue-700">
                <HelpCircle className="h-5 w-5 mr-2" />
                How to Fix This
              </CardTitle>
              <CardDescription>
                Try these steps to complete your {paymentType === 'credit_purchase' ? 'credit purchase' : 'subscription'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getTroubleshootingSteps().map((step, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm font-medium text-blue-700">{index + 1}</span>
                    </div>
                    <p className="text-gray-700">{step}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Current Status */}
          <Card className="mb-8 bg-white/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-green-700">Your Current Status</CardTitle>
              <CardDescription>What remains unchanged</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-gray-700">Account Status</span>
                  <span className="font-medium text-green-700">Active</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-gray-700">Current Plan</span>
                  <span className="font-medium text-green-700">Free Plan</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-gray-700">Available Credits</span>
                  <span className="font-medium text-green-700">Check Dashboard</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-gray-700">No Charges Made</span>
                  <span className="font-medium text-green-700">✓ Confirmed</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="text-center space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate({ to: '/dashboard/billing' })}
                className="px-8 py-3 text-lg bg-primary hover:bg-primary-hover"
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate({ to: '/dashboard/applications' })}
                className="px-8 py-3 text-lg border-2"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Dashboard
              </Button>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mt-8">
              <div className="flex items-center justify-center space-x-2 text-blue-700 mb-2">
                <MessageSquare className="h-5 w-5" />
                <span className="font-medium">Need Help?</span>
              </div>
              <p className="text-primary text-center">
                Contact our support team at{' '}
                <a href="mailto:support@yourcompany.com" className="underline hover:text-blue-800">
                  support@yourcompany.com
                </a>
                {' '}or call us at (555) 123-4567
              </p>
            </div>
          </div>

          {/* Additional Info */}
          <div className="text-center mt-8 text-sm text-gray-500">
            <p>Payment attempts are secure and encrypted</p>
            <p className="mt-1">No charges were made to your account</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentCancelled;
