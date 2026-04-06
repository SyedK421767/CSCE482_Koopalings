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

// GET all posts (optionally filtered by user's interests)
router.get('/', async (req: Request, res: Response) => {
  const { userid } = req.query;

  try {
    let result;

    if (userid) {
      // Check if user has any tags
      const userTagsCheck = await pool.query(
        'SELECT COUNT(*) as count FROM user_tags WHERE userid = $1',
        [userid]
      );
      const hasUserTags = parseInt(userTagsCheck.rows[0].count) > 0;

      if (hasUserTags) {
        // User has tags: show posts that match ANY of their tags OR posts they created
        result = await pool.query(`
          SELECT p.postid, p.userid, p.title, p.displayname, p.location, p.start_time, p.description, p.image_url, p.latitude, p.longitude
          FROM posts p
          WHERE p.userid = $1
             OR EXISTS (
               SELECT 1
               FROM post_tags pt
               INNER JOIN user_tags ut ON pt.tagid = ut.tagid
               WHERE pt.postid = p.postid AND ut.userid = $1
             )
          GROUP BY p.postid, p.userid, p.title, p.displayname, p.location, p.start_time, p.description, p.image_url, p.latitude, p.longitude
          ORDER BY
            (p.start_time < NOW()) ASC,
            p.start_time ASC NULLS LAST,
            p.postid ASC
        `, [userid]);
      } else {
        // User has no tags: show all posts
        result = await pool.query(`
          SELECT p.postid, p.userid, p.title, p.displayname, p.location, p.start_time, p.description, p.image_url, p.latitude, p.longitude
          FROM posts p
          ORDER BY
            (p.start_time < NOW()) ASC,
            p.start_time ASC NULLS LAST,
            p.postid ASC
        `);
      }
    } else {
      // Return all posts if no userid provided
      result = await pool.query(`
        SELECT p.postid, p.userid, p.title, p.displayname, p.location, p.start_time, p.description, p.image_url, p.latitude, p.longitude
        FROM posts p
        ORDER BY
          (p.start_time < NOW()) ASC,
          p.start_time ASC NULLS LAST,
          p.postid ASC
      `);
    }

    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching posts:', err);
    console.error('Error details:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to fetch posts', details: err.message });
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