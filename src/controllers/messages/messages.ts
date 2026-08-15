import { Request, Response } from 'express';
import {
  conversation,
  conversations,
  markRead,
  MAX_MESSAGE_LENGTH,
  send,
  unreadCount,
} from '../../models/messages/messages';

/**
 * @swagger
 * /messages:
 *   get:
 *     tags: [Messages]
 *     summary: Every conversation, newest first
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: One entry per counterpart, with its unread count }
 */
export async function listConversations(req: Request, res: Response) {
  try {
    res.json({ conversations: await conversations(req.user!.id) });
  } catch (error) {
    console.error('Error listing conversations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * @swagger
 * /messages/unread-count:
 *   get:
 *     tags: [Messages]
 *     summary: How many messages are unread
 *     description: Polled by the badge in the header, so it stays cheap.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ count }" }
 */
export async function getUnreadCount(req: Request, res: Response) {
  try {
    res.json({ count: await unreadCount(req.user!.id) });
  } catch (error) {
    console.error('Error counting unread messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * @swagger
 * /messages/{handle}:
 *   get:
 *     tags: [Messages]
 *     summary: One thread, oldest first
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Messages with pagination }
 */
export async function getConversation(req: Request, res: Response) {
  try {
    res.json(await conversation(req.user!.id, String(req.params.handle), req.query));
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * @swagger
 * /messages/{handle}:
 *   post:
 *     tags: [Messages]
 *     summary: Send a message
 *     description: >
 *       Both readers must have favourited each other. A message containing a
 *       banned term is refused before it is stored, so it is never delivered.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body: { type: string, maxLength: 2000 }
 *     responses:
 *       201: { description: Sent }
 *       400: { description: Empty or over-long }
 *       403: { description: Not a mutual favourite (code NOT_MUTUAL_FAVORITE) }
 *       422: { description: Refused by the content filter (code MESSAGE_REJECTED) }
 */
export async function postMessage(req: Request, res: Response) {
  try {
    const result = await send(req.user!.id, String(req.params.handle), req.body?.body);

    if (result.ok) {
      res.status(201).json({ message: result.message });
      return;
    }

    // Four different answers, because the reader can act on each differently:
    // shorten it, edit it, or favourite the person back.
    switch (result.reason) {
      case 'empty':
        res.status(400).json({ error: 'A message cannot be empty.' });
        return;
      case 'too-long':
        res.status(400).json({
          error: `A message can be at most ${MAX_MESSAGE_LENGTH} characters.`,
        });
        return;
      case 'rejected':
        res.status(422).json({
          error: 'This message was not sent. Please rephrase it without abusive language.',
          code: 'MESSAGE_REJECTED',
        });
        return;
      case 'not-mutual':
        res.status(403).json({
          error: 'You can only message readers who have favourited you back.',
          code: 'NOT_MUTUAL_FAVORITE',
        });
        return;
    }
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * @swagger
 * /messages/{handle}/read:
 *   post:
 *     tags: [Messages]
 *     summary: Mark everything they sent as read
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ marked }" }
 */
export async function markConversationRead(req: Request, res: Response) {
  try {
    res.json({ marked: await markRead(req.user!.id, String(req.params.handle)) });
  } catch (error) {
    console.error('Error marking conversation read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
