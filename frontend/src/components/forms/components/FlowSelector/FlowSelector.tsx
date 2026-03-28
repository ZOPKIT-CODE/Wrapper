import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronRight } from 'lucide-react';
import { FlowConfig, FlowSelectorProps } from './types';

/**
 * FlowSelector component for selecting from a list of flow configurations
 * 
 * Features:
 * - Responsive grid/list layout
 * - Keyboard navigation support
 * - Custom renderer support
 * - Accessibility compliant
 * - Default card UI with shadcn/ui components
 */
export const FlowSelector: React.FC<FlowSelectorProps> = ({
  flows,
  onSelect,
  defaultFlowId,
  renderItem,
  className,
  disabled = false,
  title,
  description,
  variant = 'grid',
  maxColumns = 3
}) => {
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(defaultFlowId || null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Initialize selected flow on mount
  useEffect(() => {
    if (defaultFlowId && flows.some(flow => flow.id === defaultFlowId)) {
      setSelectedFlowId(defaultFlowId);
      const defaultFlow = flows.find(flow => flow.id === defaultFlowId);
      if (defaultFlow) {
        onSelect(defaultFlow);
      }
    }
  }, [defaultFlowId, flows, onSelect]);

  // Handle flow selection
  const handleFlowSelect = useCallback((flow: FlowConfig) => {
    if (disabled) return;
    
    setSelectedFlowId(flow.id);
    onSelect(flow);
  }, [disabled, onSelect]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled) return;

    const { key } = event;
    const totalFlows = flows.length;

    switch (key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => {
          const nextIndex = variant === 'grid' 
            ? Math.min(prev + 1, totalFlows - 1)
            : (prev + 1) % totalFlows;
          return nextIndex;
        });
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev => {
          const prevIndex = variant === 'grid'
            ? Math.max(prev - 1, 0)
            : prev === 0 ? totalFlows - 1 : prev - 1;
          return prevIndex;
        });
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < totalFlows) {
          handleFlowSelect(flows[focusedIndex]);
        }
        break;
      case 'Home':
        event.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setFocusedIndex(totalFlows - 1);
        break;
    }
  }, [disabled, flows, focusedIndex, variant, handleFlowSelect]);

  // Focus management
  useEffect(() => {
    if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  // Default card renderer
  const renderDefaultCard = (flow: FlowConfig, isSelected: boolean, onClick: () => void) => (
    <Card
      className={cn(
        'relative cursor-pointer transition-all duration-200 hover:shadow-md',
        'focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2',
        isSelected && 'ring-2 ring-primary ring-offset-2 shadow-md',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              {flow.icon && (
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                  {flow.icon}
                </div>
              )}
              <h3 className="text-lg font-semibold text-[#1B2E5A] truncate">
                {flow.name}
              </h3>
            </div>
            {flow.description && (
              <p className="text-sm text-gray-600 line-clamp-2">
                {flow.description}
              </p>
            )}
          </div>
          {isSelected && (
            <div className="flex-shrink-0 ml-2">
              <Badge variant="default" className="bg-primary text-primary-foreground">
                <Check className="w-3 h-3 mr-1" />
                Selected
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // List item renderer
  const renderListItem = (flow: FlowConfig, isSelected: boolean, onClick: () => void) => (
    <Button
      ref={(el) => {
        const index = flows.findIndex(f => f.id === flow.id);
        if (index >= 0) {
          itemRefs.current[index] = el;
        }
      }}
      variant={isSelected ? "default" : "outline"}
      className={cn(
        'w-full justify-start h-auto p-4 text-left',
        'hover:bg-primary/10 hover:text-primary',
        isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="flex items-center gap-3 w-full">
        {flow.icon && (
          <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
            {flow.icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium">{flow.name}</div>
          {flow.description && (
            <div className="text-sm opacity-80 truncate">
              {flow.description}
            </div>
          )}
        </div>
        {isSelected && (
          <Check className="w-4 h-4 flex-shrink-0" />
        )}
      </div>
    </Button>
  );

  // Determine which renderer to use
  const renderFlowItem = (flow: FlowConfig, index: number) => {
    const isSelected = selectedFlowId === flow.id;
    const isFocused = focusedIndex === index;
    
    const onClick = () => handleFlowSelect(flow);

    if (renderItem) {
      return (
        <div
          key={flow.id}
          ref={(el) => {
            itemRefs.current[index] = el as HTMLButtonElement;
          }}
          tabIndex={isFocused ? 0 : -1}
          className={cn(
            'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          onKeyDown={handleKeyDown}
        >
          {renderItem(flow, isSelected, onClick)}
        </div>
      );
    }

    if (variant === 'list') {
      return (
        <div key={flow.id}>
          {renderListItem(flow, isSelected, onClick)}
        </div>
      );
    }

    return (
      <div
        key={flow.id}
        ref={(el) => {
          itemRefs.current[index] = el as HTMLButtonElement;
        }}
        tabIndex={isFocused ? 0 : -1}
        className="focus:outline-none"
        onKeyDown={handleKeyDown}
      >
        {renderDefaultCard(flow, isSelected, onClick)}
      </div>
    );
  };

  // Grid layout classes
  const getGridClasses = () => {
    const baseClasses = 'grid gap-4';
    const responsiveClasses = {
      1: 'grid-cols-1',
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
      5: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
      6: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
    };
    
    const columns = Math.min(maxColumns, flows.length);
    return cn(baseClasses, responsiveClasses[columns as keyof typeof responsiveClasses] || responsiveClasses[3]);
  };

  return (
    <div className={cn('w-full', className)}>
      {/* Header */}
      {(title || description) && (
        <div className="mb-6">
          {title && (
            <h2 className="text-2xl font-bold text-[#1B2E5A] mb-2">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-gray-600">
              {description}
            </p>
          )}
        </div>
      )}

      {/* Flow Selection Container */}
      <div
        ref={containerRef}
        className={cn(
          'focus:outline-none',
          variant === 'grid' ? getGridClasses() : 'space-y-2'
        )}
        role="radiogroup"
        aria-label={title || 'Select a flow'}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {flows.map((flow, index) => renderFlowItem(flow, index))}
      </div>

      {/* Empty State */}
      {flows.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-2">No flows available</div>
          <p className="text-sm text-gray-400">
            Please check back later or contact support if you believe this is an error.
          </p>
        </div>
      )}
    </div>
  );
};

export default FlowSelector;
