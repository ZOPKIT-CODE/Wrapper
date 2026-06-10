import React from 'react';
import { 
  PageLoading,
  PageError,
  PageEmpty,
  CardLoading,
  CardError,
  CardEmpty,
  InlineLoading,
  InlineError,
  InlineEmpty,
  LoadingOverlay
} from './LoadingStates';
import { useLoadingContext } from '@/contexts/LoadingContext';

interface UnifiedLoadingProps {
  // Loading state
  isLoading: boolean;
  error?: Error | string | null;
  isEmpty?: boolean;
  
  // Content
  children: React.ReactNode;
  
  // Loading configuration
  loadingType?: 'page' | 'card' | 'inline' | 'overlay';
  loadingMessage?: string;
  
  // Error configuration
  errorTitle?: string;
  errorDescription?: string;
  onRetry?: () => void;
  retryLabel?: string;
  
  // Empty configuration
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ComponentType<{ className?: string }>;
  emptyAction?: React.ReactNode;
  
  // Styling
  className?: string;
  showBackground?: boolean;
}

export function UnifiedLoading({
  isLoading,
  error,
  isEmpty = false,
  children,
  loadingType = 'page',
  loadingMessage = 'Loading...',
  errorTitle,
  errorDescription,
  onRetry,
  retryLabel = 'Retry',
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyAction,
  className,
  showBackground = true
}: UnifiedLoadingProps) {
  // Show error state
  if (error) {
    if (loadingType === 'page') {
      return (
        <PageError
          error={error}
          title={errorTitle}
          description={errorDescription}
          onRetry={onRetry}
          retryLabel={retryLabel}
          showBackground={showBackground}
          className={className}
        />
      );
    }
    
    if (loadingType === 'card') {
      return (
        <CardError
          error={error}
          title={errorTitle}
          description={errorDescription}
          onRetry={onRetry}
          retryLabel={retryLabel}
          className={className}
        />
      );
    }
    
    return (
      <InlineError
        error={error}
        onRetry={onRetry}
        retryLabel={retryLabel}
        className={className}
      />
    );
  }

  // Show empty state
  if (isEmpty) {
    if (loadingType === 'page') {
      return (
        <PageEmpty
          title={emptyTitle}
          description={emptyDescription}
          icon={emptyIcon}
          action={emptyAction}
          showBackground={showBackground}
          className={className}
        />
      );
    }
    
    if (loadingType === 'card') {
      return (
        <CardEmpty
          title={emptyTitle}
          description={emptyDescription}
          icon={emptyIcon}
          action={emptyAction}
          className={className}
        />
      );
    }
    
    return (
      <InlineEmpty
        message={emptyDescription}
        icon={emptyIcon}
        className={className}
      />
    );
  }

  // Show loading state
  if (isLoading) {
    if (loadingType === 'page') {
      return (
        <PageLoading
          message={loadingMessage}
          showBackground={showBackground}
          className={className}
        />
      );
    }
    
    if (loadingType === 'card') {
      return (
        <CardLoading
          className={className}
        />
      );
    }
    
    if (loadingType === 'overlay') {
      return (
        <LoadingOverlay
          isLoading={true}
          message={loadingMessage}
          className={className}
        >
          {children}
        </LoadingOverlay>
      );
    }
    
    return (
      <InlineLoading
        message={loadingMessage}
        className={className}
      />
    );
  }

  // Show content
  return <>{children}</>;
}

// Global loading component that uses the loading context
export function GlobalLoadingWrapper({ children }: { children: React.ReactNode }) {
  const { globalLoading } = useLoadingContext();
  
  if (!globalLoading.isLoading) {
    return <>{children}</>;
  }

  const { loadingType, loadingMessage } = globalLoading;

  if (loadingType === 'page') {
    return (
      <PageLoading
        message={loadingMessage}
        showBackground={true}
      />
    );
  }

  if (loadingType === 'overlay') {
    return (
      <LoadingOverlay
        isLoading={true}
        message={loadingMessage}
      >
        {children}
      </LoadingOverlay>
    );
  }

  if (loadingType === 'inline') {
    return (
      <div className="fixed top-4 right-4 z-50">
        <InlineLoading message={loadingMessage} />
      </div>
    );
  }

  if (loadingType === 'button') {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <InlineLoading message={loadingMessage} />
      </div>
    );
  }

  return <>{children}</>;
}

// Higher-order component for easy loading state management
export function withLoadingState<P extends object>(
  Component: React.ComponentType<P>,
  loadingConfig?: {
    loadingType?: 'page' | 'card' | 'inline' | 'overlay';
    loadingMessage?: string;
    errorTitle?: string;
    errorDescription?: string;
    emptyTitle?: string;
    emptyDescription?: string;
  }
) {
  return function WrappedComponent(props: P & {
    isLoading?: boolean;
    error?: Error | string | null;
    isEmpty?: boolean;
    onRetry?: () => void;
  }) {
    const {
      isLoading = false,
      error,
      isEmpty = false,
      onRetry,
      ...componentProps
    } = props;

    return (
      <UnifiedLoading
        isLoading={isLoading}
        error={error}
        isEmpty={isEmpty}
        loadingType={loadingConfig?.loadingType}
        loadingMessage={loadingConfig?.loadingMessage}
        errorTitle={loadingConfig?.errorTitle}
        errorDescription={loadingConfig?.errorDescription}
        emptyTitle={loadingConfig?.emptyTitle}
        emptyDescription={loadingConfig?.emptyDescription}
        onRetry={onRetry}
      >
        <Component {...(componentProps as P)} />
      </UnifiedLoading>
    );
  };
}
