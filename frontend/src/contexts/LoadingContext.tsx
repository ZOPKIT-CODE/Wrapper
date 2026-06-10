import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';

export interface GlobalLoadingState {
  isLoading: boolean;
  loadingMessage: string;
  loadingProgress?: number;
  loadingType: 'page' | 'overlay' | 'inline' | 'button';
}

export interface LoadingContextType {
  // Global loading state
  globalLoading: GlobalLoadingState;
  
  // Actions
  setGlobalLoading: (loading: Partial<GlobalLoadingState>) => void;
  clearGlobalLoading: () => void;
  
  // Specific loading states
  setPageLoading: (message?: string) => void;
  setOverlayLoading: (message?: string, progress?: number) => void;
  setInlineLoading: (message?: string) => void;
  setButtonLoading: (message?: string) => void;
  
  // Loading state management
  startLoading: (type: GlobalLoadingState['loadingType'], message?: string, progress?: number) => void;
  stopLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export interface LoadingProviderProps {
  children: ReactNode;
}

export function LoadingProvider({ children }: LoadingProviderProps) {
  const [globalLoading, setGlobalLoadingState] = useState<GlobalLoadingState>({
    isLoading: false,
    loadingMessage: '',
    loadingType: 'page'
  });

  const setGlobalLoading = useCallback((loading: Partial<GlobalLoadingState>) => {
    setGlobalLoadingState(prev => ({
      ...prev,
      ...loading,
      isLoading: loading.isLoading ?? true
    }));
  }, []);

  const clearGlobalLoading = useCallback(() => {
    setGlobalLoadingState({
      isLoading: false,
      loadingMessage: '',
      loadingType: 'page'
    });
  }, []);

  const setPageLoading = useCallback((message = 'Loading...') => {
    setGlobalLoading({
      isLoading: true,
      loadingMessage: message,
      loadingType: 'page'
    });
  }, [setGlobalLoading]);

  const setOverlayLoading = useCallback((message = 'Loading...', progress?: number) => {
    setGlobalLoading({
      isLoading: true,
      loadingMessage: message,
      loadingProgress: progress,
      loadingType: 'overlay'
    });
  }, [setGlobalLoading]);

  const setInlineLoading = useCallback((message = 'Loading...') => {
    setGlobalLoading({
      isLoading: true,
      loadingMessage: message,
      loadingType: 'inline'
    });
  }, [setGlobalLoading]);

  const setButtonLoading = useCallback((message = 'Loading...') => {
    setGlobalLoading({
      isLoading: true,
      loadingMessage: message,
      loadingType: 'button'
    });
  }, [setGlobalLoading]);

  const startLoading = useCallback((
    type: GlobalLoadingState['loadingType'], 
    message = 'Loading...', 
    progress?: number
  ) => {
    setGlobalLoading({
      isLoading: true,
      loadingMessage: message,
      loadingProgress: progress,
      loadingType: type
    });
  }, [setGlobalLoading]);

  const stopLoading = useCallback(() => {
    clearGlobalLoading();
  }, [clearGlobalLoading]);

  const value: LoadingContextType = {
    globalLoading,
    setGlobalLoading,
    clearGlobalLoading,
    setPageLoading,
    setOverlayLoading,
    setInlineLoading,
    setButtonLoading,
    startLoading,
    stopLoading
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoadingContext(): LoadingContextType {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoadingContext must be used within a LoadingProvider');
  }
  return context;
}

// Hook for easy access to global loading state
export function useGlobalLoading() {
  const { globalLoading, startLoading, stopLoading } = useLoadingContext();
  
  return {
    isLoading: globalLoading.isLoading,
    message: globalLoading.loadingMessage,
    progress: globalLoading.loadingProgress,
    type: globalLoading.loadingType,
    startLoading,
    stopLoading
  };
}
