// Messagerie temporaire — stockage Firestore avec expiration automatique côté client
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { addLog } from '@/lib/logger';

export type MessageTarget = 'global' | 'user' | 'group';

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  targetType: MessageTarget;
  targetIds: string[]; // empty for global
  createdAt: Date;
  expiresAt: Date;
}

interface MessageDoc {
  senderId: string;
  senderName: string;
  content: string;
  targetType: MessageTarget;
  targetIds: string[];
  createdAt: Timestamp | null;
  expiresAt: Timestamp;
}

function docToMessage(id: string, d: MessageDoc): Message {
  return {
    id,
    senderId: d.senderId,
    senderName: d.senderName,
    content: d.content,
    targetType: d.targetType,
    targetIds: d.targetIds || [],
    createdAt: d.createdAt?.toDate?.() || new Date(),
    expiresAt: d.expiresAt.toDate(),
  };
}

export async function sendMessage(params: {
  senderId: string;
  senderName: string;
  content: string;
  targetType: MessageTarget;
  targetIds: string[];
  durationHours: 24 | 48 | 72;
}): Promise<boolean> {
  try {
    const expiresAt = new Date(Date.now() + params.durationHours * 60 * 60 * 1000);
    await addDoc(collection(db, 'messages'), {
      senderId: params.senderId,
      senderName: params.senderName,
      content: params.content.trim(),
      targetType: params.targetType,
      targetIds: params.targetIds,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
    });
    addLog('info', `Message envoyé (${params.targetType}, ${params.durationHours}h)`);
    return true;
  } catch (e: any) {
    addLog('error', `Envoi message échoué: ${e?.message}`);
    return false;
  }
}

export async function deleteMessage(id: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'messages', id));
    return true;
  } catch (e: any) {
    addLog('error', `Suppression message échouée: ${e?.message}`);
    return false;
  }
}

/**
 * Subscribe to messages — filters out expired ones client-side and silently
 * deletes them on the fly to keep Firestore tidy without Cloud Functions.
 */
export function subscribeMessages(
  currentUserId: string,
  onChange: (msgs: Message[]) => void
): () => void {
  const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    snap => {
      const now = Date.now();
      const visible: Message[] = [];
      snap.docs.forEach(d => {
        const data = d.data() as MessageDoc;
        if (!data.expiresAt) return;
        const m = docToMessage(d.id, data);
        if (m.expiresAt.getTime() <= now) {
          // Fire-and-forget cleanup of expired messages
          deleteDoc(d.ref).catch(() => {});
          return;
        }
        // Visibility filter
        if (m.targetType === 'global') {
          visible.push(m);
        } else if (m.targetIds.includes(currentUserId) || m.senderId === currentUserId) {
          visible.push(m);
        }
      });
      onChange(visible);
    },
    err => addLog('error', `Lecture messages: ${err.message}`)
  );
}
