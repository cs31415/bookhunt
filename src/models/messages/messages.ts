import {
  getConversation,
  getConversations,
  markConversationRead,
  sendMessage,
  unreadMessageCount,
} from '../../data/messages-data';
import { containsAbusiveContent } from '../../lib/moderation/contains-abusive-content';
import { normalizeHandle } from '../../lib/validate/normalize-handle';

export const MAX_MESSAGE_LENGTH = 2000;

export type SendResult =
  | { ok: true; message: { id: number; body: string; createdAt: string; fromMe: true } }
  | { ok: false; reason: 'empty' | 'too-long' | 'rejected' | 'not-mutual' };

/**
 * Sends one message, if it is allowed.
 *
 * The moderation check runs before the insert, so a rejected message is never
 * stored and never delivered. The mutual-favourite rule is not checked here at
 * all: fn_send_message enforces it in SQL, which is what makes it impossible to
 * bypass from a route written later.
 */
export async function send(senderId: number, handle: string, body: unknown): Promise<SendResult> {
  if (typeof body !== 'string' || body.trim().length === 0) {
    return { ok: false, reason: 'empty' };
  }
  const trimmed = body.trim();
  if (trimmed.length > MAX_MESSAGE_LENGTH) return { ok: false, reason: 'too-long' };
  if (containsAbusiveContent(trimmed)) return { ok: false, reason: 'rejected' };

  const row = await sendMessage(senderId, normalizeHandle(handle), trimmed);
  if (!row) return { ok: false, reason: 'not-mutual' };

  return {
    ok: true,
    message: { id: row.id, body: row.body, createdAt: row.created_at, fromMe: true },
  };
}

export async function conversations(userId: number) {
  const rows = await getConversations(userId);
  return rows.map((row) => ({
    handle: row.handle,
    displayName: row.display_name,
    lastMessage: { body: row.last_body, at: row.last_at, fromMe: row.last_from_me },
    unreadCount: Number(row.unread_count),
  }));
}

export async function conversation(userId: number, handle: string, query: { page?: unknown }) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = 50;
  const rows = await getConversation(userId, normalizeHandle(handle), pageSize, (page - 1) * pageSize);

  return {
    messages: rows.map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      fromMe: row.from_me,
    })),
    total: rows.length > 0 ? Number(rows[0].total_count) : 0,
    page,
    pageSize,
  };
}

export function markRead(userId: number, handle: string) {
  return markConversationRead(userId, normalizeHandle(handle));
}

export function unreadCount(userId: number) {
  return unreadMessageCount(userId);
}
