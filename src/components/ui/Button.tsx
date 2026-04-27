'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-scope-accent/50 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-scope-accent hover:bg-scope-accentHover text-white shadow-lg shadow-scope-accent/20 hover:shadow-scope-accent/30',
    secondary: 'bg-scope-card hover:bg-scope-cardHover text-white border border-scope-border hover:border-scope-borderLight',
    ghost: 'text-scope-textSecondary hover:text-white hover:bg-scope-cardHover',
    danger: 'bg-red-600/90 hover:bg-red-500 text-white shadow-sm',
    outline: 'border border-scope-border text-scope-textSecondary hover:text-white hover:border-scope-borderLight hover:bg-scope-cardHover',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  };

  // Default spinner inherits `border-scope-accent`, which is invisible
  // against a `bg-scope-accent` primary button — makes the loading state
  // look like the label is off-center (the text shifts right to make
  // room for the invisible spinner). Override per variant so the spinner
  // is always visible on its background.
  const spinnerClass =
    variant === 'primary' || variant === 'danger'
      ? 'border-white/90'
      : 'border-scope-accent';

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Spinner size="sm" className={spinnerClass} />
      ) : (
        icon && <span className="flex-shrink-0">{icon}</span>
      )}
      {children}
      {iconRight && <span className="flex-shrink-0">{iconRight}</span>}
    </button>
  );
}
