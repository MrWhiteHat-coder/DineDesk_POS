import React from 'react';
import { cn } from '../../lib/utils';

export default function PageHeader({
  eyebrow = 'DineDesk',
  title,
  subtitle,
  actions,
  icon: Icon,
  className,
}) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] uppercase tracking-[0.18em] text-navy/70 font-semibold mb-1">
            {eyebrow}
          </p>
        )}
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="w-9 h-9 rounded-xl bg-navy/8 text-navy flex items-center justify-center flex-shrink-0">
              <Icon className="w-[18px] h-[18px]" />
            </span>
          )}
          <h1 className="font-display text-[22px] sm:text-[26px] font-semibold text-ink tracking-tight">
            {title}
          </h1>
        </div>
        {subtitle && <p className="text-sm text-ink/50 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
