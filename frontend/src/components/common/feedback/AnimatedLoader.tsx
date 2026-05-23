import React from 'react';
import { cn } from '@/lib/utils';
import { FULL_LOGO_URL } from '@/lib/config';

interface AnimatedLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = { sm: 80, md: 120, lg: 160 } as const;

const AnimatedLoader: React.FC<AnimatedLoaderProps> = ({
  size = 'md',
  className = ''
}) => {
  const px = sizeMap[size];

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <img
        src={FULL_LOGO_URL}
        alt="Zopkit"
        width={px}
        height={px / 3}
        className="animate-pulse select-none"
        style={{ objectFit: 'contain' }}
        draggable={false}
      />
    </div>
  );
};

export default AnimatedLoader;
