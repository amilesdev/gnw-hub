'use client';

import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { FieldWrap } from './Field';
import { Eye, EyeOff } from './Icons';

/**
 * Password input with an inline show/hide toggle. Same look as TextField, with a
 * 44×44 eye button that doesn't overlap typed text (extra right padding).
 */
export const PasswordField = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label?: string; error?: string | null }
>(function PasswordField({ label, error, className, ...props }, ref) {
  const [show, setShow] = useState(false);
  return (
    <FieldWrap label={label} error={error}>
      <div className="relative">
        <input
          ref={ref}
          type={show ? 'text' : 'password'}
          className={cn('field pr-12', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="row-press absolute right-1.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-xl text-ink-faint"
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          tabIndex={-1}
        >
          {show ? <EyeOff width={19} height={19} /> : <Eye width={19} height={19} />}
        </button>
      </div>
    </FieldWrap>
  );
});
