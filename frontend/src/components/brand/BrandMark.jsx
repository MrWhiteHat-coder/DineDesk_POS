import React from 'react';
import { cn } from '../../lib/utils';

export default function BrandMark({
  variant = 'full',
  tone = 'dark',
  size = 36,
  className,
}) {
  const isLight = tone === 'light';
  return (
    <div className={cn('flex items-center gap-2.5 min-w-0', className)}>
      <div
        className={cn(
          'relative flex-shrink-0 rounded-[11px] flex items-center justify-center shadow-sm',
          isLight ? 'bg-white/12 ring-1 ring-white/15' : 'bg-ink'
        )}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <svg viewBox="0 0 40 40" className="w-[70%] h-[70%]" fill="none">
          <path
            d="M13 9.5h9.2c5.1 0 8.6 3.2 8.6 8.3v4.4c0 5.1-3.5 8.3-8.6 8.3H13V9.5zm5.1 4.3v12.4h4c2.6 0 3.7-1.6 3.7-4.1v-4.2c0-2.5-1.1-4.1-3.7-4.1h-4z"
            fill={isLight ? '#F7F1E6' : '#F7F1E6'}
          />
          <circle cx="30.5" cy="11" r="3.1" fill="#D4A017" />
        </svg>
      </div>
      {variant === 'full' && (
        <div className="min-w-0 leading-tight">
          <p className={cn(
            'font-display font-semibold tracking-tight text-[17px]',
            isLight ? 'text-white' : 'text-ink'
          )}>
            DineDesk
          </p>
          <p className={cn(
            'text-[10px] tracking-[0.14em] uppercase font-medium',
            isLight ? 'text-white/45' : 'text-ink/40'
          )}>
            Restaurant POS
          </p>
        </div>
      )}
    </div>
  );
}
