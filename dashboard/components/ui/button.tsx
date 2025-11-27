import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'ghost' | 'outline' | 'destructive' | 'link';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        className={cn(
          // Base styles
          'inline-flex items-center justify-center font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          'rounded-md',
          // Variants
          {
            // Default - primary button
            'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'default',
            // Secondary - subtle button
            'bg-secondary text-secondary-foreground hover:bg-secondary/80': variant === 'secondary',
            // Ghost - no background
            'hover:bg-muted hover:text-foreground': variant === 'ghost',
            // Outline - bordered
            'border border-border bg-transparent hover:bg-muted': variant === 'outline',
            // Destructive
            'bg-destructive text-destructive-foreground hover:bg-destructive/90': variant === 'destructive',
            // Link
            'text-primary underline-offset-4 hover:underline': variant === 'link',
          },
          // Sizes
          {
            'h-8 px-3 text-xs': size === 'sm',
            'h-9 px-4 text-sm': size === 'md',
            'h-10 px-6 text-sm': size === 'lg',
            'h-9 w-9 p-0': size === 'icon',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
