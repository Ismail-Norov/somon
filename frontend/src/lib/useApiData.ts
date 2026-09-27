'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';

export function useApiData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!path) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api<T>(path);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}
