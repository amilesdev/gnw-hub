'use client';

import { Search, X } from './Icons';
import { cn } from '@/lib/utils';

/** Search field (CMP-8): leading search icon, clear X once there's text. */
export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search
        width={18}
        height={18}
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
      />
      <input
        type="search"
        className="field pl-[42px] pr-11 [&::-webkit-search-cancel-button]:hidden"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="search"
        aria-label={placeholder.replace(/…$/, '')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-ink-faint"
          aria-label="Clear search"
        >
          <X width={18} height={18} />
        </button>
      )}
    </div>
  );
}
