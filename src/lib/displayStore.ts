// Stocke les préférences d'affichage globales (ordre des agents, etc.)
// Document unique: display/settings => { agentOrder: string[] }
import { doc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { addLog } from './logger';

export interface DisplaySettings {
  agentOrder: string[]; // tableau ordonné d'IDs utilisateurs
}

const REF = () => doc(db, 'display', 'settings');

export function subscribeDisplaySettings(cb: (s: DisplaySettings) => void): Unsubscribe {
  return onSnapshot(
    REF(),
    snap => {
      const data = (snap.data() as DisplaySettings | undefined) || { agentOrder: [] };
      cb({ agentOrder: Array.isArray(data.agentOrder) ? data.agentOrder : [] });
    },
    err => addLog('error', `Erreur lecture display: ${err.message}`)
  );
}

export async function saveAgentOrder(agentOrder: string[]): Promise<boolean> {
  try {
    await setDoc(REF(), { agentOrder }, { merge: true });
    addLog('info', `Ordre des agents mis à jour (${agentOrder.length})`);
    return true;
  } catch (e: any) {
    addLog('error', `Erreur enregistrement ordre agents: ${e?.message}`);
    return false;
  }
}

/** Trie une liste d'utilisateurs selon l'ordre stocké, les inconnus à la fin (par nom). */
export function applyAgentOrder<T extends { id: string; name: string }>(users: T[], order: string[]): T[] {
  const indexOf = new Map(order.map((id, i) => [id, i]));
  return [...users].sort((a, b) => {
    const ia = indexOf.has(a.id) ? (indexOf.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
    const ib = indexOf.has(b.id) ? (indexOf.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
    if (ia !== ib) return ia - ib;
    return a.name.localeCompare(b.name);
  });
}
