import { useEffect } from 'react';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router';

import usePagination from './use-pagination';

// Wrap the hook in a MemoryRouter since usePagination relies on
// react-router's useSearchParams.
const wrapper =
  (initialEntries = ['/']) =>
  ({ children }) => (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  );

describe('usePagination', () => {
  describe('initial page/pageSize types', () => {
    it('defaults page and pageSize to numbers when no search params are present', () => {
      const { result } = renderHook(() => usePagination({}), {
        wrapper: wrapper(['/']),
      });

      expect(result.current.page).toBe(1);
      expect(typeof result.current.page).toBe('number');
      expect(result.current.pageSize).toBe(20);
      expect(typeof result.current.pageSize).toBe('number');
    });

    it('parses numeric page/pageSize search params into numbers, not strings', () => {
      const { result } = renderHook(() => usePagination({}), {
        wrapper: wrapper(['/?page=3&pageSize=50']),
      });

      expect(result.current.page).toBe(3);
      expect(typeof result.current.page).toBe('number');
      expect(result.current.pageSize).toBe(50);
      expect(typeof result.current.pageSize).toBe('number');
    });

    it('falls back to the defaults when search params are not valid numbers', () => {
      const { result } = renderHook(() => usePagination({}), {
        wrapper: wrapper(['/?page=abc&pageSize=xyz']),
      });

      expect(result.current.page).toBe(1);
      expect(result.current.pageSize).toBe(20);
    });

    it('preserves an explicit 0 value instead of falling back to the default', () => {
      // Regression guard for using `Number(x) || fallback`, which would
      // incorrectly discard a legitimate falsy value like 0.
      const { result } = renderHook(() => usePagination({}), {
        wrapper: wrapper(['/?page=0&pageSize=0']),
      });

      expect(result.current.page).toBe(0);
      expect(result.current.pageSize).toBe(0);
    });
  });

  describe('URL search param sync', () => {
    it('writes page/pageSize back to the URL as strings', async () => {
      const { result } = renderHook(
        () => {
          const pagination = usePagination({});
          const [searchParams] = useSearchParams();
          return { pagination, searchParams };
        },
        { wrapper: wrapper(['/']) },
      );

      await waitFor(() => {
        expect(result.current.searchParams.get('page')).toBe('1');
        expect(result.current.searchParams.get('pageSize')).toBe('20');
      });

      act(() => {
        result.current.pagination.onSetPage(null, 3);
      });

      await waitFor(() => {
        expect(result.current.pagination.page).toBe(3);
        expect(result.current.searchParams.get('page')).toBe('3');
      });
    });

    it('does not sync to the URL when setParams is false', () => {
      const { result } = renderHook(
        () => {
          const pagination = usePagination({ setParams: false });
          const [searchParams] = useSearchParams();
          return { pagination, searchParams };
        },
        { wrapper: wrapper(['/']) },
      );

      expect(result.current.searchParams.get('page')).toBeNull();
      expect(result.current.searchParams.get('pageSize')).toBeNull();
    });
  });

  describe('regression: page/pageSize type mismatch causing duplicate fetches', () => {
    // Mirrors the real-world bug: pages like UserList/RunList call
    // setPage(data.pagination.page) / setPageSize(data.pagination.pageSize)
    // with the *numbers* the backend returns, inside a `useEffect` that
    // depends on [page, pageSize]. When page/pageSize started out as
    // strings (e.g. '1'), setting them to the equal-looking number (1)
    // was treated as a real change by React ('1' !== 1), so the effect
    // fired a second time, causing a duplicate fetch/render. With page and
    // pageSize consistently stored as numbers, this dependency effect
    // should only run once for the same logical page.
    const FetchingConsumer = ({ onFetch }) => {
      const { page, setPage, pageSize, setPageSize } = usePagination({});

      useEffect(() => {
        onFetch(page, pageSize);
        // Simulate an API response echoing back the current page/pageSize
        // as numbers, just like the real pagination endpoints do.
        setPage(1);
        setPageSize(20);
      }, [page, pageSize, onFetch, setPage, setPageSize]);

      return null;
    };

    it('only fetches once when the URL already has the default page/pageSize', async () => {
      const onFetch = vi.fn();

      render(
        <MemoryRouter initialEntries={['/?page=1&pageSize=20']}>
          <FetchingConsumer onFetch={onFetch} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(onFetch).toHaveBeenCalledWith(1, 20);
      });

      // Give any (unwanted) follow-up effect a chance to run before asserting.
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(onFetch).toHaveBeenCalledTimes(1);
    });

    it('only fetches once on mount with no search params present', async () => {
      const onFetch = vi.fn();

      render(
        <MemoryRouter initialEntries={['/']}>
          <FetchingConsumer onFetch={onFetch} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(onFetch).toHaveBeenCalledWith(1, 20);
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(onFetch).toHaveBeenCalledTimes(1);
    });
  });
});
