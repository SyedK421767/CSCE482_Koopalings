import { Router, Request, Response } from 'express';
import pool from '../db';
import { notifyUsers } from '../chat/wsHub';

const router = Router();

type ChatMessageRow = {
  messageid: number;
  conversationid: number;
  senderid: number;
  content: string;
  sent_at: string;
  read_at: string | null;
  first_name: string;
  last_name: string;
};

function parseId(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

router.get('/users', async (req: Request, res: Response) => {
  const excludeUserId = parseId(req.query.excludeUserId);

  try {
    const result = await pool.query(
      `
      SELECT userid, first_name, last_name, email
      FROM users
      WHERE ($1::int IS NULL OR userid <> $1)
      ORDER BY first_name, last_name
      `,
      [excludeUserId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch chat users:', err);
    res.status(500).json({ error: 'Failed to fetch chat users' });
  }
});

router.post('/conversations', async (req: Request, res: Response) => {
  const userId = parseId(req.body.userId);
  const otherUserId = parseId(req.body.otherUserId);

  if (!userId || !otherUserId || userId === otherUserId) {
    return res.status(400).json({ error: 'Valid user IDs are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `
      SELECT c.conversationid
      FROM conversations c
      JOIN conversation_participants cp1
        ON cp1.conversationid = c.conversationid AND cp1.userid = $1
      JOIN conversation_participants cp2
        ON cp2.conversationid = c.conversationid AND cp2.userid = $2
      LIMIT 1
      `,
      [userId, otherUserId]
    );

    let conversationId: number;

    if (existing.rows.length > 0) {
      conversationId = existing.rows[0].conversationid;
    } else {
      const created = await client.query(
        'INSERT INTO conversations DEFAULT VALUES RETURNING conversationid'
      );
      conversationId = created.rows[0].conversationid;

      await client.query(
        `
        INSERT INTO conversation_participants (conversationid, userid)
        VALUES ($1, $2), ($1, $3)
        `,
        [conversationId, userId, otherUserId]
      );

      notifyUsers([userId, otherUserId], {
        type: 'conversation_started',
        conversationId,
        userIds: [userId, otherUserId],
      });
    }

    await client.query('COMMIT');

    return res.status(201).json({ conversationId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to start conversation:', err);
    return res.status(500).json({ error: 'Failed to start conversation' });
  } finally {
    client.release();
  }
});

router.get('/conversations/user/:userId', async (req: Request, res: Response) => {
  const userId = parseId(req.params.userId);
  if (!userId) {
    return res.status(400).json({ error: 'Valid user ID is required' });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        c.conversationid,
        other.userid AS other_userid,
        other.first_name,
        other.last_name,
        other.email,
        m.messageid AS last_messageid,
        m.senderid AS last_senderid,
        m.content AS last_message,
        m.sent_at AS last_message_at,
        m.read_at AS last_message_read_at,
        COALESCE(unread.unread_count, 0) AS unread_count
      FROM conversations c
      JOIN conversation_participants selfp
        ON selfp.conversationid = c.conversationid
       AND selfp.userid = $1
      JOIN conversation_participants otherp
        ON otherp.conversationid = c.conversationid
       AND otherp.userid <> $1
      JOIN users other
        ON other.userid = otherp.userid
      LEFT JOIN LATERAL (
        SELECT messageid, senderid, content, sent_at, read_at
        FROM messages
        WHERE messages.conversationid = c.conversationid
        ORDER BY sent_at DESC
        LIMIT 1
      ) m ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS unread_count
        FROM messages um
        WHERE um.conversationid = c.conversationid
          AND um.senderid <> $1
          AND um.read_at IS NULL
      ) unread ON TRUE
      ORDER BY COALESCE(m.sent_at, c.created_at) DESC
      `,
      [userId]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch conversations:', err);
    return res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

router.get('/conversations/:conversationId/messages', async (req: Request, res: Response) => {
  const conversationId = parseId(req.params.conversationId);
  if (!conversationId) {
    return res.status(400).json({ error: 'Valid conversation ID is required' });
  }

  try {
    const result = await pool.query<ChatMessageRow>(
      `
      SELECT
        m.messageid,
        m.conversationid,
        m.senderid,
        m.content,
        m.sent_at,
        m.read_at,
        u.first_name,
        u.last_name
      FROM messages m
      JOIN users u ON u.userid = m.senderid
      WHERE m.conversationid = $1
      ORDER BY m.sent_at ASC
      `,
      [conversationId]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch messages:', err);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/messages', async (req: Request, res: Response) => {
  const conversationId = parseId(req.body.conversationId);
  const senderId = parseId(req.body.senderId);
  const content = String(req.body.content ?? '').trim();

  if (!conversationId || !senderId || !content) {
    return res.status(400).json({ error: 'conversationId, senderId, and content are required' });
  }

  try {
    const membership = await pool.query(
      `
      SELECT 1
      FROM conversation_participants
      WHERE conversationid = $1 AND userid = $2
      LIMIT 1
      `,
      [conversationId, senderId]
    );

    if (membership.rowCount === 0) {
      return res.status(403).json({ error: 'Sender is not in this conversation' });
    }

    const inserted = await pool.query<ChatMessageRow>(
      `
      INSERT INTO messages (conversationid, senderid, content)
      VALUES ($1, $2, $3)
      RETURNING messageid, conversationid, senderid, content, sent_at, read_at,
        (SELECT first_name FROM users WHERE userid = senderid) AS first_name,
        (SELECT last_name FROM users WHERE userid = senderid) AS last_name
      `,
      [conversationId, senderId, content]
    );

    const participants = await pool.query<{ userid: number }>(
      'SELECT userid FROM conversation_participants WHERE conversationid = $1',
      [conversationId]
    );

    const message = inserted.rows[0];

    notifyUsers(
      participants.rows.map((row) => row.userid),
      {
        type: 'new_message',
        conversationId,
        message,
      }
    );

    return res.status(201).json(message);
  } catch (err) {
    console.error('Failed to send message:', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

router.post('/conversations/:conversationId/read', async (req: Request, res: Response) => {
  const conversationId = parseId(req.params.conversationId);
  const userId = parseId(req.body.userId);

  if (!conversationId || !userId) {
    return res.status(400).json({ error: 'Valid conversation ID and user ID are required' });
  }

  try {
    const readAtResult = await pool.query<{ now: string }>('SELECT NOW() AS now');
    const readAt = readAtResult.rows[0]?.now ?? new Date().toISOString();

    await pool.query(
      `
      UPDATE messages
      SET read_at = $3
      WHERE conversationid = $1
        AND senderid <> $2
        AND read_at IS NULL
      `,
      [conversationId, userId, readAt]
    );

    const participants = await pool.query<{ userid: number }>(
      'SELECT userid FROM conversation_participants WHERE conversationid = $1',
      [conversationId]
    );

    notifyUsers(
      participants.rows.map((row) => row.userid),
      {
        type: 'conversation_read',
        conversationId,
        readerId: userId,
        readAt,
      }
    );

    return res.json({ success: true, readAt });
  } catch (err) {
    console.error('Failed to mark conversation as read:', err);
    return res.status(500).json({ error: 'Failed to mark conversation as read' });
  }
});

export default router;
