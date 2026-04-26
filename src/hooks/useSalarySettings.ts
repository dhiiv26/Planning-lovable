import { useEffect, useState } from 'react';
import { subscribeSalarySettings, SalarySettings, DEFAULT_SALARY } from '@/lib/salaryStore';

export function useSalarySettings() {
  const [settings, setSettings] = useState<SalarySettings>(DEFAULT_SALARY);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = subscribeSalarySettings(s => {
      setSettings(s);
      setLoading(false);
    });
    return unsub;
  }, []);
  return { settings, loading };
}
