import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from './Icons';

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="label">{children}</span>;
}

// Fields (CMP-8): label 6px above, helper or error 6px below. An error turns
// the border `bad` and the message is announced (role="alert").
type WrapProps = { label?: string; error?: string | null; helper?: string; children: React.ReactNode };
export function FieldWrap({ label, error, helper, children }: WrapProps) {
  return (
    <label className="block space-y-1.5">
      {label && <FieldLabel>{label}</FieldLabel>}
      {children}
      {error ? (
        <span role="alert" className="block text-[13px] font-semibold leading-[18px] text-bad-ink">{error}</span>
      ) : (
        helper && <span className="block text-[13px] leading-[18px] text-ink-faint">{helper}</span>
      )}
    </label>
  );
}

type Extra = { label?: string; error?: string | null; helper?: string };

export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Extra>(
  function TextField({ label, error, helper, className, ...props }, ref) {
    return (
      <FieldWrap label={label} error={error} helper={helper}>
        <input ref={ref} aria-invalid={!!error || undefined} className={cn('field', error && 'animate-shake !border-bad', className)} {...props} />
      </FieldWrap>
    );
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & Extra>(
  function TextArea({ label, error, helper, className, ...props }, ref) {
    return (
      <FieldWrap label={label} error={error} helper={helper}>
        <textarea
          ref={ref}
          aria-invalid={!!error || undefined}
          className={cn('field min-h-24 resize-y py-3.5', error && '!border-bad', className)}
          {...props}
        />
      </FieldWrap>
    );
  },
);

/** Native `<select>` dressed as a field, with the chevron it used to be missing. */
export const SelectField = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & Extra>(
  function SelectField({ label, error, helper, className, children, ...props }, ref) {
    return (
      <FieldWrap label={label} error={error} helper={helper}>
        <span className="relative block">
          <select
            ref={ref}
            aria-invalid={!!error || undefined}
            className={cn('field appearance-none pr-11', error && '!border-bad', className)}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            width={18}
            height={18}
            aria-hidden
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-faint"
          />
        </span>
      </FieldWrap>
    );
  },
);
