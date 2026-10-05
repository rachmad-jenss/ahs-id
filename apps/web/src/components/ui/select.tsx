import * as React from 'react';
import { cn } from '@/lib/utils';

/** Shared class string for native `<select>` fields (matches `Input` focus and sizing). */
export const selectFieldClassName =
  'min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-base text-foreground shadow-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50';

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  ({ className, ...props }, ref) => (
    <select className={cn(selectFieldClassName, className)} ref={ref} {...props} />
  ),
);
NativeSelect.displayName = 'NativeSelect';
