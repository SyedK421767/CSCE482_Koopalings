import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// GET all posts
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT p.PostID, p.Title, p.DisplayName, p.Location, p.Start_Time, p.Description, p.Image_URL
      FROM Posts p
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
  const { userID, displayname, title, description, location, address, start_time, dateandtime, image_url } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO Posts (UserID, DisplayName, Title, Description, Location, Address, Start_Time, DateAndTime, Image_URL)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [userID, displayname, title, description, location, address, start_time, dateandtime, image_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});
export default router;