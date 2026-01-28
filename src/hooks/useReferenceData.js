import { useState, useEffect, useMemo } from 'react';
import { referenceDataService } from '../services/referenceDataService';

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

export function useReferenceData(category, options = {}) {
  const { includeInactive = false } = options;
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const cacheKey = `${category}_${includeInactive}`;

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setData(cached.data);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const result = await referenceDataService.getByCategory(category, includeInactive);
        if (mounted) {
          setData(result);
          cache.set(cacheKey, { data: result, timestamp: Date.now() });
        }
      } catch (err) {
        if (mounted) {
          setError(err);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      mounted = false;
    };
  }, [category, includeInactive, cacheKey]);

  const refetch = async () => {
    cache.delete(cacheKey);
    setIsLoading(true);
    try {
      const result = await referenceDataService.getByCategory(category, includeInactive);
      setData(result);
      cache.set(cacheKey, { data: result, timestamp: Date.now() });
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  return { data, isLoading, error, refetch };
}

export function useReferenceDisplay(category, code) {
  const { data } = useReferenceData(category, { includeInactive: true });

  return useMemo(() => {
    if (!code) return '';
    const item = data.find(d => d.code === code);
    return item?.display_name || code;
  }, [data, code]);
}

export function useReferenceColor(category, code) {
  const { data } = useReferenceData(category, { includeInactive: true });

  return useMemo(() => {
    if (!code) return null;
    const item = data.find(d => d.code === code);
    return item?.color || null;
  }, [data, code]);
}

export function useReferenceItem(category, code) {
  const { data, isLoading } = useReferenceData(category, { includeInactive: true });

  return useMemo(() => {
    if (!code || isLoading) return { item: null, isLoading };
    const item = data.find(d => d.code === code);
    return { item, isLoading };
  }, [data, code, isLoading]);
}

export function invalidateReferenceCache(category = null) {
  if (category) {
    for (const key of cache.keys()) {
      if (key.startsWith(category)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}
