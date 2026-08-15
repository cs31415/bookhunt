import { pool } from '../lib/db';

/** No row when the pair is not mutual, or the handle is unknown or your own. */
export async function sendMessage(senderId: number, handle: string, body: string) {
  const { rows } = await pool.query('SELECT * FROM fn_send_message($1, $2, $3)', [
    senderId,
    handle,
    body,
  ]);
  return rows.length > 0 ? rows[0] : null;
}

export async function getConversations(userId: number) {
  const { rows } = await pool.query('SELECT * FROM fn_get_conversations($1)', [userId]);
  return rows;
}

export async function getConversation(
  userId: number,
  handle: string,
  limit: number,
  offset: number,
) {
  const { rows } = await pool.query('SELECT * FROM fn_get_conversation($1, $2, $3, $4)', [
    userId,
    handle,
    limit,
    offset,
  ]);
  return rows;
}

export async function markConversationRead(userId: number, handle: string): Promise<number> {
  const { rows } = await pool.query('SELECT fn_mark_conversation_read($1, $2) AS marked', [
    userId,
    handle,
  ]);
  return Number(rows[0].marked);
}

export async function unreadMessageCount(userId: number): Promise<number> {
  const { rows } = await pool.query('SELECT fn_unread_message_count($1) AS count', [userId]);
  return Number(rows[0].count);
}
