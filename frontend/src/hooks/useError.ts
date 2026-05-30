import { useState, useCallback } from 'react';

export function useError() {
  const [error, setError] = useState<string | null>(null);

  const showError = useCallback((msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 3500);
  }, []);

  return { error, showError };
}
