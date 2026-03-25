import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// GET all tags
router.get('/tags', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT tagid, name FROM tags ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// GET all posts
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT p.PostID, p.Title, p.DisplayName, p.Location, p.Start_Time, p.Description, p.Image_URL, p.Latitude, p.Longitude
      FROM Posts p
      ORDER BY
        (p.Start_Time < NOW()) ASC,
        p.Start_Time ASC NULLS LAST,
        p.PostID ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// POST a new post
router.post('/', async (req: Request, res: Response) => {
  const { userID, displayname, title, description, location, address, start_time, dateandtime, image_url, latitude, longitude, tagIds } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO Posts (UserID, DisplayName, Title, Description, Location, Address, Start_Time, DateAndTime, Image_URL, Latitude, Longitude)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [userID, displayname, title, description, location, address, start_time, dateandtime, image_url, latitude, longitude]
    );

    const postId = result.rows[0].postid;

    // Insert selected tags into post_tags junction table
    if (tagIds && tagIds.length > 0) {
      const tagValues = tagIds.map((tagId: number, i: number) => `($1, $${i + 2})`).join(', ');
      const tagParams = [postId, ...tagIds];
      await pool.query(
        `INSERT INTO post_tags (postid, tagid) VALUES ${tagValues}`,
        tagParams
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

export default router;