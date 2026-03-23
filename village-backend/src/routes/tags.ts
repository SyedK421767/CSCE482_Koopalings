import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// GET all tags
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT TagID, Name
      FROM tags
      ORDER BY Name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// GET all post-tag associations
router.get('/post-tags', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT PostID, TagID
      FROM post_tags
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch post-tags' });
  }
});

export default router;