import { useEffect, useState } from 'react';
import { subscribeDisplaySettings, DisplaySettings } from '@/lib/displayStore';

export function useDisplaySettings() {
  const [settings, setSettings] = useState<DisplaySettings>({ agentOrder: [] });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = subscribeDisplaySettings(s => {
      setSettings(s);
      setLoading(false);
    });
    return unsub;
  }, []);
  return { settings, loading };
}
