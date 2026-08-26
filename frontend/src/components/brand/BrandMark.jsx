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
        className="relative flex-shrink-0 rounded-xl flex items-center justify-center bg-[#E23744] shadow-sm"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <svg viewBox="0 0 40 40" className="w-[70%] h-[70%]" fill="none">
          <path
            d="M13 9.5h9.2c5.1 0 8.6 3.2 8.6 8.3v4.4c0 5.1-3.5 8.3-8.6 8.3H13V9.5zm5.1 4.3v12.4h4c2.6 0 3.7-1.6 3.7-4.1v-4.2c0-2.5-1.1-4.1-3.7-4.1h-4z"
            fill="#FFFFFF"
          />
        </svg>
      </div>
      {variant === 'full' && (
        <div className="min-w-0 leading-tight">
          <p className={cn(
            'font-display font-bold tracking-tight text-[17px]',
            isLight ? 'text-white' : 'text-[#1C1C1C]'
          )}>
            DineDesk
          </p>
          <p className={cn(
            'text-[10px] tracking-[0.12em] uppercase font-semibold',
            isLight ? 'text-white/70' : 'text-[#E23744]'
          )}>
            Restaurant POS
          </p>
        </div>
      )}
    </div>
  );
}
