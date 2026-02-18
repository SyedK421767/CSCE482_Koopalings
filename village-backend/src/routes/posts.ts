import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// GET all posts
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT p.PostID, p.Title, u.Username
      FROM Posts p
      JOIN Users u ON p.UserID = u.UserID
      ORDER BY p.DateAndTime DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// POST a new post
router.post('/', async (req: Request, res: Response) => {
  const { userID, title, description, location } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO Posts (UserID, Title, Description, Location, DateAndTime)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [userID, title, description, location]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

export default router;