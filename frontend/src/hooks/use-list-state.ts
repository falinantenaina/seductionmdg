import { useCallback, useState } from 'react';

export interface ListState {
  search: string;
  page: number;
  pageSize: number;
}

export interface ListControls extends ListState {
  setSearch: (value: string) => void;
  setPage: (value: number) => void;
  setPageSize: (value: number) => void;
  reset: () => void;
}

export function useListState(defaults: Partial<ListState> = {}): ListControls {
  const [search, setSearchState] = useState(defaults.search ?? '');
  const [page, setPageState] = useState(defaults.page ?? 1);
  const [pageSize, setPageSizeState] = useState(defaults.pageSize ?? 20);

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setPageState(1);
  }, []);

  const setPage = useCallback((value: number) => setPageState(value), []);

  const setPageSize = useCallback((value: number) => {
    setPageSizeState(value);
    setPageState(1);
  }, []);

  const reset = useCallback(() => {
    setSearchState('');
    setPageState(1);
    setPageSizeState(defaults.pageSize ?? 20);
  }, [defaults.pageSize]);

  return { search, page, pageSize, setSearch, setPage, setPageSize, reset };
}
