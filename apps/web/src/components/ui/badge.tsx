import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        muted: 'border-border/70 bg-muted/70 text-muted-foreground',
        tierAuto:
          'border-amber-600/25 bg-amber-500/12 text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-50',
        tierSpot:
          'border-sky-600/25 bg-sky-500/12 text-sky-950 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-50',
        tierVerified:
          'border-emerald-600/25 bg-emerald-500/12 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-50',
        tierExecuted:
          'border-primary/35 bg-primary/12 text-primary',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps): React.JSX.Element {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
