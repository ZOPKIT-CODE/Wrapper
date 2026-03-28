/**
 * TEST PAGE - Loading/Progress Screen
 * Route: /test/loading
 * 
 * This is a test page for the LoadingSpinner component with progress.
 * Once testing is complete, this route should be removed and the component
 * integrated into the normal onboarding flow.
 */

import React, { useState } from 'react';
import { LoadingSpinner } from '@/features/onboarding/components/LoadingSpinner';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

const TestLoadingScreen: React.FC = () => {
  const [isCompleted, setIsCompleted] = useState(false);
  const navigate = useNavigate();

  const handleComplete = () => {
    setIsCompleted(true);
    // After completion, redirect to welcome screen
    setTimeout(() => {
      navigate({ to: '/test/welcome' });
    }, 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-pink-200/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      
      <div className="relative z-10 w-full max-w-4xl px-4">
        {isCompleted ? (
          <div className="text-center bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-green-600 mb-4">✅ Setup Complete!</h2>
            <p className="text-gray-600 mb-6">Redirecting to welcome screen...</p>
            <Button onClick={() => navigate({ to: '/test/welcome' })} className="bg-[#1B2E5A] hover:bg-[#162447]">
              Go to Welcome Screen
            </Button>
          </div>
        ) : (
          <LoadingSpinner 
            size="lg" 
            message="Setting up your organization..." 
            showProgress={true}
            onComplete={handleComplete}
            userName="Test User"
            companyName="Acme Corporation"
          />
        )}
      </div>

      {/* Test Navigation */}
      <div className="absolute top-4 left-4 z-20">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200">
          <p className="text-xs font-semibold text-gray-600 mb-2">Test Navigation:</p>
          <div className="flex flex-col gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate({ to: '/test/welcome' })}
              className="text-xs"
            >
              Welcome Screen
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setIsCompleted(false);
                window.location.reload();
              }}
              className="text-xs"
            >
              Restart Loading
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestLoadingScreen;
