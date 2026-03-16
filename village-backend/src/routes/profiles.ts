import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// GET all profiles (first row used when no login)
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT profileid, userid, displayname, profilepicture, bio
      FROM profiles
      ORDER BY profileid ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch profiles:', err);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

export default router;
