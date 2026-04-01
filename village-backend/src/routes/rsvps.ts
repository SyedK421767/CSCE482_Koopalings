import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// Helper function to get RSVP count category
function getRsvpCategory(count: number): string {
  if (count === 0) return 'none';
  if (count <= 5) return 'few';
  if (count <= 15) return 'some';
  if (count <= 30) return 'many';
  return 'lots';
}

// POST - Toggle RSVP for a user on a post
router.post('/', async (req: Request, res: Response) => {
  const { postid, userid } = req.body;

  if (!postid || !userid) {
    return res.status(400).json({ error: 'postid and userid are required' });
  }

  try {
    // Check if RSVP already exists
    const existingRsvp = await pool.query(
      'SELECT rsvpid FROM rsvps WHERE postid = $1 AND userid = $2',
      [postid, userid]
    );

    if (existingRsvp.rows.length > 0) {
      // RSVP exists, remove it
      await pool.query(
        'DELETE FROM rsvps WHERE postid = $1 AND userid = $2',
        [postid, userid]
      );
      return res.json({ rsvped: false, message: 'RSVP removed' });
    } else {
      // RSVP doesn't exist, create it
      await pool.query(
        'INSERT INTO rsvps (postid, userid) VALUES ($1, $2)',
        [postid, userid]
      );
      return res.json({ rsvped: true, message: 'RSVP added' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to toggle RSVP' });
  }
});

// GET - Get RSVP information for a post
// If requesterid matches post owner, return full guest list
// Otherwise, return category only
router.get('/post/:postid', async (req: Request, res: Response) => {
  const { postid } = req.params;
  const { requesterid } = req.query;

  if (!requesterid) {
    return res.status(400).json({ error: 'requesterid is required' });
  }

  try {
    // Get post owner
    const postResult = await pool.query(
      'SELECT userid FROM posts WHERE postid = $1',
      [postid]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const postOwnerId = postResult.rows[0].userid;
    const isOwner = parseInt(requesterid as string) === postOwnerId;

    // Get RSVP count
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM rsvps WHERE postid = $1',
      [postid]
    );
    const count = parseInt(countResult.rows[0].count);

    if (isOwner) {
      // Return full guest list for owner
      const guestListResult = await pool.query(
        `SELECT r.rsvpid, r.userid, r.created_at, u.first_name, u.last_name, u.email
         FROM rsvps r
         JOIN users u ON r.userid = u.userid
         WHERE r.postid = $1
         ORDER BY r.created_at ASC`,
        [postid]
      );

      return res.json({
        isOwner: true,
        count,
        guests: guestListResult.rows
      });
    } else {
      // Return category only for non-owners
      return res.json({
        isOwner: false,
        category: getRsvpCategory(count)
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch RSVP information' });
  }
});

// GET - Get all events a user has RSVP'd to
router.get('/user/:userid', async (req: Request, res: Response) => {
  const { userid } = req.params;

  try {
    const result = await pool.query(
      `SELECT p.postid, p.title, p.displayname, p.location, p.start_time, p.description, p.image_url, p.latitude, p.longitude, r.created_at as rsvp_date
       FROM rsvps r
       JOIN posts p ON r.postid = p.postid
       WHERE r.userid = $1
       ORDER BY p.start_time ASC NULLS LAST`,
      [userid]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user RSVPs' });
  }
});

// GET - Check if user has RSVP'd to a specific post
router.get('/check', async (req: Request, res: Response) => {
  const { postid, userid } = req.query;

  if (!postid || !userid) {
    return res.status(400).json({ error: 'postid and userid are required' });
  }

  try {
    const result = await pool.query(
      'SELECT rsvpid FROM rsvps WHERE postid = $1 AND userid = $2',
      [postid, userid]
    );

    res.json({ rsvped: result.rows.length > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check RSVP status' });
  }
});

export default router;
