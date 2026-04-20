"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const wsHub_1 = require("../chat/wsHub");
const router = (0, express_1.Router)();
function parseId(value) {
    const num = Number(value);
    if (!Number.isInteger(num) || num <= 0)
        return null;
    return num;
}
async function getConversationParticipantIds(conversationId) {
    const participants = await db_1.default.query('SELECT userid FROM conversation_participants WHERE conversationid = $1', [conversationId]);
    return participants.rows.map((row) => row.userid);
}
async function getConversationParticipants(conversationId) {
    const result = await db_1.default.query(`
    SELECT u.userid, u.first_name, u.last_name, u.email
    FROM conversation_participants cp
    JOIN users u ON u.userid = cp.userid
    WHERE cp.conversationid = $1
    ORDER BY cp.joined_at ASC NULLS LAST, u.first_name
    `, [conversationId]);
    return result.rows;
}
router.get('/users', async (req, res) => {
    const excludeUserId = parseId(req.query.excludeUserId);
    try {
        const result = await db_1.default.query(`
      SELECT userid, first_name, last_name, email
      FROM users
      WHERE ($1::int IS NULL OR userid <> $1)
      ORDER BY first_name, last_name
      `, [excludeUserId]);
        res.json(result.rows);
    }
    catch (err) {
        console.error('Failed to fetch chat users:', err);
        res.status(500).json({ error: 'Failed to fetch chat users' });
    }
});
router.post('/conversations', async (req, res) => {
    const userId = parseId(req.body.userId);
    const requestedParticipants = Array.isArray(req.body.participantIds)
        ? req.body.participantIds.map((id) => parseId(id)).filter(Boolean)
        : [];
    const name = String(req.body.name ?? '').trim();
    console.log('chat create payload', {
        rawBody: req.body,
        userIdCandidate: req.body.userId,
        participantIdsCandidate: req.body.participantIds,
    });
    if (!userId || requestedParticipants.length === 0) {
        return res.status(400).json({ error: 'At least one valid participant ID is required' });
    }
    const participantIds = Array.from(new Set([...requestedParticipants, userId]));
    if (participantIds.length < 2) {
        return res.status(400).json({ error: 'A conversation requires at least two participants' });
    }
    const isGroup = participantIds.length > 2 || Boolean(name);
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        let conversationId = null;
        if (!isGroup) {
            const otherUserId = participantIds.find((id) => id !== userId);
            const existing = await client.query(`
        SELECT c.conversationid
        FROM conversations c
        JOIN conversation_participants cp1
          ON cp1.conversationid = c.conversationid AND cp1.userid = $1
        JOIN conversation_participants cp2
          ON cp2.conversationid = c.conversationid AND cp2.userid = $2
        WHERE c.is_group = FALSE
          AND (
            SELECT COUNT(*)
            FROM conversation_participants cp
            WHERE cp.conversationid = c.conversationid
          ) = 2
        LIMIT 1
        `, [userId, otherUserId]);
            if (existing.rows.length > 0) {
                conversationId = existing.rows[0].conversationid;
            }
        }
        if (!conversationId) {
            const fields = ['name', 'is_group', 'owner_userid'];
            const values = [name || null, isGroup, userId];
            const created = await client.query(`INSERT INTO conversations (${fields.join(', ')})
         VALUES ($1, $2, $3)
         RETURNING conversationid`, values);
            conversationId = created.rows[0].conversationid;
            const participantPlaceholders = participantIds
                .map((_, idx) => `($1, $${idx + 2})`)
                .join(', ');
            await client.query(`
        INSERT INTO conversation_participants (conversationid, userid)
        VALUES ${participantPlaceholders}
        `, [conversationId, ...participantIds]);
            (0, wsHub_1.notifyUsers)(participantIds, {
                type: 'conversation_started',
                conversationId,
                userIds: participantIds,
            });
        }
        await client.query('COMMIT');
        return res.status(201).json({ conversationId });
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.error('Failed to start conversation:', err);
        return res.status(500).json({ error: 'Failed to start conversation' });
    }
    finally {
        client.release();
    }
});
router.get('/conversations/user/:userId', async (req, res) => {
    const userId = parseId(req.params.userId);
    if (!userId) {
        return res.status(400).json({ error: 'Valid user ID is required' });
    }
    try {
        const result = await db_1.default.query(`
      SELECT
        c.conversationid,
        c.name AS conversation_name,
        c.is_group,
        c.owner_userid,
        other.userid AS other_userid,
        other.first_name,
        other.last_name,
        other.email,
        m.messageid AS last_messageid,
        m.senderid AS last_senderid,
        m.content AS last_message,
        m.sent_at AS last_message_at,
        m.read_at AS last_message_read_at,
        COALESCE(unread.unread_count, 0) AS unread_count,
        COALESCE(participants.participants, '[]') AS participants
      FROM conversations c
      JOIN conversation_participants selfp
        ON selfp.conversationid = c.conversationid
       AND selfp.userid = $1
      LEFT JOIN LATERAL (
        SELECT u.userid, u.first_name, u.last_name, u.email
        FROM conversation_participants cp2
        JOIN users u ON u.userid = cp2.userid
        WHERE cp2.conversationid = c.conversationid AND cp2.userid <> $1
        ORDER BY cp2.joined_at ASC NULLS LAST
        LIMIT 1
      ) other ON TRUE
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
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'userid', u.userid,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'email', u.email
        )) AS participants
        FROM conversation_participants cp3
        JOIN users u ON u.userid = cp3.userid
        WHERE cp3.conversationid = c.conversationid
      ) participants ON TRUE
      WHERE m.messageid IS NOT NULL
      ORDER BY COALESCE(m.sent_at, c.created_at) DESC
      `, [userId]);
        return res.json(result.rows);
    }
    catch (err) {
        console.error('Failed to fetch conversations:', err);
        return res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});
// ── NEW: Rename a group conversation ─────────────────────────────────────────
router.patch('/conversations/:conversationId', async (req, res) => {
    const conversationId = parseId(req.params.conversationId);
    const userId = parseId(req.body.userId);
    const name = String(req.body.name ?? '').trim();
    if (!conversationId || !userId) {
        return res.status(400).json({ error: 'Valid conversation ID and user ID are required' });
    }
    if (!name) {
        return res.status(400).json({ error: 'A non-empty name is required' });
    }
    try {
        // Only participants can rename
        const membership = await db_1.default.query(`SELECT 1 FROM conversation_participants WHERE conversationid = $1 AND userid = $2 LIMIT 1`, [conversationId, userId]);
        if (membership.rowCount === 0) {
            return res.status(403).json({ error: 'Only participants can rename this conversation' });
        }
        await db_1.default.query(`UPDATE conversations SET name = $1 WHERE conversationid = $2`, [name, conversationId]);
        const participantIds = await getConversationParticipantIds(conversationId);
        // Re-use conversation_started to trigger a conversations refresh on all clients
        (0, wsHub_1.notifyUsers)(participantIds, {
            type: 'conversation_started',
            conversationId,
            userIds: participantIds,
        });
        return res.json({ success: true });
    }
    catch (err) {
        console.error('Failed to rename conversation:', err);
        return res.status(500).json({ error: 'Failed to rename conversation' });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
router.get('/conversations/:conversationId/participants', async (req, res) => {
    const conversationId = parseId(req.params.conversationId);
    if (!conversationId) {
        return res.status(400).json({ error: 'Valid conversation ID is required' });
    }
    try {
        const participants = await getConversationParticipants(conversationId);
        return res.json(participants);
    }
    catch (err) {
        console.error('Failed to fetch participants:', err);
        return res.status(500).json({ error: 'Failed to fetch participants' });
    }
});
router.post('/conversations/:conversationId/participants', async (req, res) => {
    const conversationId = parseId(req.params.conversationId);
    const userId = parseId(req.body.userId);
    const requestedIds = Array.isArray(req.body.participantIds)
        ? req.body.participantIds.map((id) => parseId(id)).filter(Boolean)
        : [];
    if (!conversationId || !userId || requestedIds.length === 0) {
        return res.status(400).json({ error: 'Valid conversation ID, user ID, and participant IDs are required' });
    }
    const uniqueIds = Array.from(new Set(requestedIds));
    try {
        const membership = await db_1.default.query(`
      SELECT 1
      FROM conversation_participants
      WHERE conversationid = $1 AND userid = $2
      LIMIT 1
      `, [conversationId, userId]);
        if (membership.rowCount === 0) {
            return res.status(403).json({ error: 'Only participants can add members' });
        }
        const existingIdsResult = await db_1.default.query(`
      SELECT userid
      FROM conversation_participants
      WHERE conversationid = $1
      `, [conversationId]);
        const existingIds = new Set(existingIdsResult.rows.map((row) => row.userid));
        const newIds = uniqueIds.filter((id) => !existingIds.has(id));
        if (newIds.length > 0) {
            const participantPlaceholders = newIds
                .map((_, idx) => `($1, $${idx + 2})`)
                .join(', ');
            await db_1.default.query(`
        INSERT INTO conversation_participants (conversationid, userid)
        VALUES ${participantPlaceholders}
        `, [conversationId, ...newIds]);
            const participantIds = [...existingIds, ...newIds];
            (0, wsHub_1.notifyUsers)(participantIds, {
                type: 'conversation_started',
                conversationId,
                userIds: participantIds,
            });
        }
        const participants = await getConversationParticipants(conversationId);
        return res.json(participants);
    }
    catch (err) {
        console.error('Failed to add participants:', err);
        return res.status(500).json({ error: 'Failed to add participants' });
    }
});
router.get('/conversations/:conversationId/messages', async (req, res) => {
    const conversationId = parseId(req.params.conversationId);
    if (!conversationId) {
        return res.status(400).json({ error: 'Valid conversation ID is required' });
    }
    try {
        const result = await db_1.default.query(`
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
      `, [conversationId]);
        return res.json(result.rows);
    }
    catch (err) {
        console.error('Failed to fetch messages:', err);
        return res.status(500).json({ error: 'Failed to fetch messages' });
    }
});
router.post('/messages', async (req, res) => {
    const conversationId = parseId(req.body.conversationId);
    const senderId = parseId(req.body.senderId);
    const content = String(req.body.content ?? '').trim();
    if (!conversationId || !senderId || !content) {
        return res.status(400).json({ error: 'conversationId, senderId, and content are required' });
    }
    try {
        const membership = await db_1.default.query(`
      SELECT 1
      FROM conversation_participants
      WHERE conversationid = $1 AND userid = $2
      LIMIT 1
      `, [conversationId, senderId]);
        if (membership.rowCount === 0) {
            return res.status(403).json({ error: 'Sender is not in this conversation' });
        }
        const inserted = await db_1.default.query(`
      INSERT INTO messages (conversationid, senderid, content)
      VALUES ($1, $2, $3)
      RETURNING messageid, conversationid, senderid, content, sent_at, read_at,
        (SELECT first_name FROM users WHERE userid = senderid) AS first_name,
        (SELECT last_name FROM users WHERE userid = senderid) AS last_name
      `, [conversationId, senderId, content]);
        const message = inserted.rows[0];
        const participantIds = await getConversationParticipantIds(conversationId);
        (0, wsHub_1.notifyUsers)(participantIds, {
            type: 'new_message',
            conversationId,
            message,
        });
        return res.status(201).json(message);
    }
    catch (err) {
        console.error('Failed to send message:', err);
        return res.status(500).json({ error: 'Failed to send message' });
    }
});
router.post('/conversations/:conversationId/read', async (req, res) => {
    const conversationId = parseId(req.params.conversationId);
    const userId = parseId(req.body.userId);
    if (!conversationId || !userId) {
        return res.status(400).json({ error: 'Valid conversation ID and user ID are required' });
    }
    try {
        const readAtResult = await db_1.default.query('SELECT NOW() AS now');
        const readAt = readAtResult.rows[0]?.now ?? new Date().toISOString();
        await db_1.default.query(`
      UPDATE messages
      SET read_at = $3
      WHERE conversationid = $1
        AND senderid <> $2
        AND read_at IS NULL
      `, [conversationId, userId, readAt]);
        const participantIds = await getConversationParticipantIds(conversationId);
        (0, wsHub_1.notifyUsers)(participantIds, {
            type: 'conversation_read',
            conversationId,
            readerId: userId,
            readAt,
        });
        return res.json({ success: true, readAt });
    }
    catch (err) {
        console.error('Failed to mark conversation as read:', err);
        return res.status(500).json({ error: 'Failed to mark conversation as read' });
    }
});
router.patch('/messages/:messageId', async (req, res) => {
    const messageId = parseId(req.params.messageId);
    const userId = parseId(req.body.userId);
    const content = String(req.body.content ?? '').trim();
    if (!messageId || !userId || !content) {
        return res.status(400).json({ error: 'Valid message ID, user ID, and content are required' });
    }
    try {
        const existing = await db_1.default.query(`
      SELECT conversationid, senderid
      FROM messages
      WHERE messageid = $1
      LIMIT 1
      `, [messageId]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }
        const messageMeta = existing.rows[0];
        if (!messageMeta) {
            return res.status(404).json({ error: 'Message not found' });
        }
        if (messageMeta.senderid !== userId) {
            return res.status(403).json({ error: 'You can only edit your own messages' });
        }
        const updated = await db_1.default.query(`
      UPDATE messages
      SET content = $2
      WHERE messageid = $1
      RETURNING messageid, conversationid, senderid, content, sent_at, read_at,
        (SELECT first_name FROM users WHERE userid = senderid) AS first_name,
        (SELECT last_name FROM users WHERE userid = senderid) AS last_name
      `, [messageId, content]);
        const message = updated.rows[0];
        const participantIds = await getConversationParticipantIds(messageMeta.conversationid);
        (0, wsHub_1.notifyUsers)(participantIds, {
            type: 'message_updated',
            conversationId: messageMeta.conversationid,
            message,
        });
        return res.json(message);
    }
    catch (err) {
        console.error('Failed to edit message:', err);
        return res.status(500).json({ error: 'Failed to edit message' });
    }
});
router.delete('/messages/:messageId', async (req, res) => {
    const messageId = parseId(req.params.messageId);
    const userId = parseId(req.body.userId);
    if (!messageId || !userId) {
        return res.status(400).json({ error: 'Valid message ID and user ID are required' });
    }
    try {
        const existing = await db_1.default.query(`
      SELECT conversationid, senderid
      FROM messages
      WHERE messageid = $1
      LIMIT 1
      `, [messageId]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }
        const messageMeta = existing.rows[0];
        if (!messageMeta) {
            return res.status(404).json({ error: 'Message not found' });
        }
        if (messageMeta.senderid !== userId) {
            return res.status(403).json({ error: 'You can only delete your own messages' });
        }
        await db_1.default.query('DELETE FROM messages WHERE messageid = $1', [messageId]);
        const participantIds = await getConversationParticipantIds(messageMeta.conversationid);
        (0, wsHub_1.notifyUsers)(participantIds, {
            type: 'message_deleted',
            conversationId: messageMeta.conversationid,
            messageId,
        });
        return res.json({ success: true });
    }
    catch (err) {
        console.error('Failed to delete message:', err);
        return res.status(500).json({ error: 'Failed to delete message' });
    }
});
router.delete('/conversations/:conversationId', async (req, res) => {
    const conversationId = parseId(req.params.conversationId);
    const userId = parseId(req.body.userId);
    if (!conversationId || !userId) {
        return res.status(400).json({ error: 'Valid conversation ID and user ID are required' });
    }
    try {
        const membership = await db_1.default.query(`
      SELECT 1
      FROM conversation_participants
      WHERE conversationid = $1 AND userid = $2
      LIMIT 1
      `, [conversationId, userId]);
        if (membership.rowCount === 0) {
            return res.status(403).json({ error: 'User is not in this conversation' });
        }
        const participantIds = await getConversationParticipantIds(conversationId);
        await db_1.default.query('DELETE FROM conversations WHERE conversationid = $1', [conversationId]);
        (0, wsHub_1.notifyUsers)(participantIds, {
            type: 'conversation_deleted',
            conversationId,
            deletedBy: userId,
        });
        return res.json({ success: true });
    }
    catch (err) {
        console.error('Failed to delete conversation:', err);
        return res.status(500).json({ error: 'Failed to delete conversation' });
    }
});
exports.default = router;
//# sourceMappingURL=chat.js.map