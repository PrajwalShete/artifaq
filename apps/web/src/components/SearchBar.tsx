import { type ChangeEvent, forwardRef, type KeyboardEvent } from 'react';

interface Props {
  value: string;
  onChange(v: string): void;
  placeholder?: string;
}

export const SearchBar = forwardRef<HTMLInputElement, Props>(function SearchBar(
  { value, onChange, placeholder = 'filter files' },
  ref,
) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value);
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onChange('');
      e.currentTarget.blur();
    }
  };
  return (
    <div className="search-bar">
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <title>Search</title>
        <circle cx="7" cy="7" r="5" />
        <path d="M10.5 10.5l3 3" strokeLinecap="round" />
      </svg>
      <input
        ref={ref}
        type="text"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        value={value}
        onChange={handle}
        onKeyDown={onKey}
        placeholder={placeholder}
        aria-label="Filter files"
      />
      <span className="kbd-hint">/</span>
    </div>
  );
});
