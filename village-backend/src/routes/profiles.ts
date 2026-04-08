import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// GET all profiles
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT profileid, userid, profile_picture
      FROM profiles
      ORDER BY profileid ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch profiles:', err);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

// GET profile for a specific user
router.get('/:userid', async (req: Request, res: Response) => {
  const userid = parseInt(String(req.params.userid ?? ''), 10);
  if (!Number.isInteger(userid) || userid <= 0) {
    return res.status(400).json({ error: 'Valid user ID is required' });
  }
  try {
    const result = await pool.query(
      'SELECT profileid, userid, profile_picture FROM profiles WHERE userid = $1 LIMIT 1',
      [userid]
    );
    if (result.rowCount === 0) {
      return res.json({ userid, profile_picture: null });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to fetch profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT update (or create) profile picture for a user
router.put('/:userid/picture', async (req: Request, res: Response) => {
  const userid = parseInt(String(req.params.userid ?? ''), 10);
  if (!Number.isInteger(userid) || userid <= 0) {
    return res.status(400).json({ error: 'Valid user ID is required' });
  }
  const { profile_picture } = req.body;
  if (!profile_picture || typeof profile_picture !== 'string') {
    return res.status(400).json({ error: 'profile_picture URL is required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO profiles (userid, profile_picture)
       VALUES ($1, $2)
       ON CONFLICT (userid)
       DO UPDATE SET profile_picture = EXCLUDED.profile_picture
       RETURNING profileid, userid, profile_picture`,
      [userid, profile_picture]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update profile picture:', err);
    res.status(500).json({ error: 'Failed to update profile picture' });
  }
});

export default router;