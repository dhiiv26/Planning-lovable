import { useEffect, useState } from 'react';
import { APP_VERSION, VERSION_CHECK_URL } from '@/config/version';
import { addLog } from '@/lib/logger';

interface VersionInfo {
  needsUpdate: boolean;
  latestVersion: string;
  apkUrl: string;
}

// Compare des versions sémantiques simples "x.y.z"
const isNewer = (remote: string, local: string) => {
  const r = remote.split('.').map((n) => parseInt(n, 10) || 0);
  const l = local.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(r.length, l.length);
  for (let i = 0; i < len; i++) {
    const a = r[i] || 0;
    const b = l[i] || 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
};

export const useVersionCheck = () => {
  const [info, setInfo] = useState<VersionInfo>({
    needsUpdate: false,
    latestVersion: APP_VERSION,
    apkUrl: '',
  });

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${VERSION_CHECK_URL}?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const latestVersion: string = data.version || data.latest || '';
        const apkUrl: string = data.url || data.apk || data.apkUrl || '';
        if (latestVersion && isNewer(latestVersion, APP_VERSION)) {
          setInfo({ needsUpdate: true, latestVersion, apkUrl });
          addLog('info', `Mise à jour disponible : ${APP_VERSION} → ${latestVersion}`);
        }
      } catch (e: any) {
        // Silencieux : pas de blocage si le serveur de version est inaccessible
        addLog('warn', `Vérification de version échouée : ${e?.message || e}`);
      }
    };
    check();
  }, []);

  return info;
};
