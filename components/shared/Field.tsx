import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="label">{children}</span>;
}

type WrapProps = { label?: string; error?: string | null; children: React.ReactNode };
export function FieldWrap({ label, error, children }: WrapProps) {
  return (
    <label className="block space-y-1.5">
      {label && <FieldLabel>{label}</FieldLabel>}
      {children}
      {error && <span role="alert" className="block text-xs font-semibold text-bad">{error}</span>}
    </label>
  );
}

export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string | null }>(
  function TextField({ label, error, className, ...props }, ref) {
    return (
      <FieldWrap label={label} error={error}>
        <input ref={ref} className={cn('field', className)} {...props} />
      </FieldWrap>
    );
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string | null }>(
  function TextArea({ label, error, className, ...props }, ref) {
    return (
      <FieldWrap label={label} error={error}>
        <textarea ref={ref} className={cn('field min-h-[6rem] resize-y', className)} {...props} />
      </FieldWrap>
    );
  },
);

export const SelectField = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string | null }>(
  function SelectField({ label, error, className, children, ...props }, ref) {
    return (
      <FieldWrap label={label} error={error}>
        <select ref={ref} className={cn('field appearance-none pr-10', className)} {...props}>
          {children}
        </select>
      </FieldWrap>
    );
  },
);
