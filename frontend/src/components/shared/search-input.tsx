import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';


interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

/** Recherche avec debounce : évite une requête API par frappe. */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Rechercher...',
  debounceMs = 350,
  className,
}: SearchInputProps) {
  const [local, setLocal] = useState(value);

  useEffect(() => setLocal(value), [value]);

  useEffect(() => {
    if (local === value) return;
    const timer = setTimeout(() => onChange(local), debounceMs);
    return () => clearTimeout(timer);
  }, [local, value, onChange, debounceMs]);

  return (
    <div className={className}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={local}
          onChange={(event) => setLocal(event.target.value)}
          placeholder={placeholder}
          className="h-9 pl-8 pr-8"
          aria-label={placeholder}
        />
        {local && (
          <button
            type="button"
            onClick={() => {
              setLocal('');
              onChange('');
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Effacer la recherche"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
