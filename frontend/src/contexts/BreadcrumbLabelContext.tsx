import { createContext, useContext, useState, type ReactNode } from 'react';

interface BreadcrumbLabelContextType {
  lastSegmentLabel: string | null;
  setLastSegmentLabel: (label: string | null) => void;
}

const BreadcrumbLabelContext = createContext<BreadcrumbLabelContextType | undefined>(undefined);

export function BreadcrumbLabelProvider({ children }: { children: ReactNode }) {
  const [lastSegmentLabel, setLastSegmentLabel] = useState<string | null>(null);

  return (
    <BreadcrumbLabelContext.Provider value={{ lastSegmentLabel, setLastSegmentLabel }}>
      {children}
    </BreadcrumbLabelContext.Provider>
  );
}

export function useBreadcrumbLabel() {
  const context = useContext(BreadcrumbLabelContext);
  if (context === undefined) {
    throw new Error('useBreadcrumbLabel must be used within a BreadcrumbLabelProvider');
  }
  return context;
}
