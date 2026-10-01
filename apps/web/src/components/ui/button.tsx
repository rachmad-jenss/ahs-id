import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.96]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover-fine-bg-primary-90',
        secondary: 'bg-secondary text-secondary-foreground hover-fine-bg-secondary-80',
        outline: 'border border-border bg-background text-foreground hover-fine-bg-muted',
        ghost: 'text-muted-foreground hover-fine-bg-muted hover-fine-text-foreground',
        link: 'h-auto min-h-0 rounded-none px-0 py-0 text-primary underline-offset-4 hover-fine-underline',
      },
      size: {
        default: 'min-h-11',
        sm: 'min-h-11 px-3 text-xs',
        lg: 'min-h-12 px-5 text-base',
        icon: 'h-11 w-11 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      type={type}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export { buttonVariants };
