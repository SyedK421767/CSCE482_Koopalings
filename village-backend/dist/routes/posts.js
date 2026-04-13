"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
// GET all tags
router.get('/tags', async (req, res) => {
    try {
        const result = await db_1.default.query('SELECT tagid, name FROM tags ORDER BY name ASC');
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch tags' });
    }
});
// GET upcoming posts created by a specific user
router.get('/my-events', async (req, res) => {
    const { creatorid } = req.query;
    if (!creatorid) {
        return res.status(400).json({ error: 'creatorid is required' });
    }
    try {
        const result = await db_1.default.query(`SELECT postid, userid, title, displayname, location, start_time, description, image_url, latitude, longitude, price_min, price_max
       FROM posts
       WHERE userid = $1
         AND (start_time IS NULL OR start_time >= NOW())
       ORDER BY start_time ASC NULLS LAST, postid ASC`, [creatorid]);
        res.json(result.rows);
    }
    catch (err) {
        console.error('Error fetching my events:', err);
        res.status(500).json({ error: 'Failed to fetch events', details: err.message });
    }
});
// GET all posts (optionally filtered by user's interests)
router.get('/', async (req, res) => {
    const { userid } = req.query;
    try {
        let result;
        if (userid) {
            // Check if user has any tags
            const userTagsCheck = await db_1.default.query('SELECT COUNT(*) as count FROM user_tags WHERE userid = $1', [userid]);
            const hasUserTags = parseInt(userTagsCheck.rows[0].count) > 0;
            if (hasUserTags) {
                // User has tags: show posts that match ANY of their tags OR posts they created
                result = await db_1.default.query(`
          SELECT p.postid, p.userid, p.title, p.displayname, p.location, p.start_time, p.description, p.image_url, p.latitude, p.longitude, p.price_min, p.price_max
          FROM posts p
          WHERE (p.start_time IS NULL OR p.start_time >= NOW() - INTERVAL '24 hours')
            AND (
              p.userid = $1
              OR EXISTS (
                SELECT 1
                FROM post_tags pt
                INNER JOIN user_tags ut ON pt.tagid = ut.tagid
                WHERE pt.postid = p.postid AND ut.userid = $1
              )
            )
          GROUP BY p.postid, p.userid, p.title, p.displayname, p.location, p.start_time, p.description, p.image_url, p.latitude, p.longitude, p.price_min, p.price_max
          ORDER BY
            (p.start_time < NOW()) ASC,
            p.start_time ASC NULLS LAST,
            p.postid ASC
        `, [userid]);
            }
            else {
                // User has no tags: show all posts
                result = await db_1.default.query(`
          SELECT p.postid, p.userid, p.title, p.displayname, p.location, p.start_time, p.description, p.image_url, p.latitude, p.longitude, p.price_min, p.price_max
          FROM posts p
          WHERE (p.start_time IS NULL OR p.start_time >= NOW() - INTERVAL '24 hours')
          ORDER BY
            (p.start_time < NOW()) ASC,
            p.start_time ASC NULLS LAST,
            p.postid ASC
        `);
            }
        }
        else {
            // Return all posts if no userid provided
            result = await db_1.default.query(`
        SELECT p.postid, p.userid, p.title, p.displayname, p.location, p.start_time, p.description, p.image_url, p.latitude, p.longitude, p.price_min, p.price_max
        FROM posts p
        WHERE (p.start_time IS NULL OR p.start_time >= NOW() - INTERVAL '24 hours')
        ORDER BY
          (p.start_time < NOW()) ASC,
          p.start_time ASC NULLS LAST,
          p.postid ASC
      `);
        }
        res.json(result.rows);
    }
    catch (err) {
        console.error('Error fetching posts:', err);
        console.error('Error details:', err.message, err.stack);
        res.status(500).json({ error: 'Failed to fetch posts', details: err.message });
    }
});
// POST a new post
router.post('/', async (req, res) => {
    const { userID, displayname, title, description, location, address, start_time, dateandtime, image_url, latitude, longitude, tagIds, price_min, price_max } = req.body;
    try {
        const result = await db_1.default.query(`INSERT INTO Posts (UserID, DisplayName, Title, Description, Location, Address, Start_Time, DateAndTime, Image_URL, Latitude, Longitude, Price_Min, Price_Max)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`, [userID, displayname, title, description, location, address, start_time, dateandtime, image_url, latitude, longitude, price_min ?? 0, price_max ?? 0]);
        const postId = result.rows[0].postid;
        // Insert selected tags into post_tags junction table
        if (tagIds && tagIds.length > 0) {
            const tagValues = tagIds.map((tagId, i) => `($1, $${i + 2})`).join(', ');
            const tagParams = [postId, ...tagIds];
            await db_1.default.query(`INSERT INTO post_tags (postid, tagid) VALUES ${tagValues}`, tagParams);
        }
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create post' });
    }
});
// PUT /posts/:postid - update a post
router.put('/:postid', async (req, res) => {
    const postid = parseInt(String(req.params.postid ?? ''), 10);
    if (!Number.isInteger(postid) || postid <= 0) {
        return res.status(400).json({ error: 'Valid post ID is required' });
    }
    const { title, description, location, start_time, image_url, price_min, price_max } = req.body;
    try {
        const result = await db_1.default.query(`UPDATE posts
       SET title       = COALESCE($1, title),
           description = COALESCE($2, description),
           location    = COALESCE($3, location),
           address     = COALESCE($3, address),
           start_time  = COALESCE($4::timestamptz, start_time),
           dateandtime = COALESCE($4::timestamptz, dateandtime),
           image_url   = COALESCE($5, image_url),
           price_min   = COALESCE($7::numeric, price_min),
           price_max   = COALESCE($8::numeric, price_max)
       WHERE postid = $6
       RETURNING postid, userid, title, displayname, location, start_time, description, image_url, latitude, longitude, price_min, price_max`, [
            title != null ? String(title).trim() : null,
            description != null ? String(description).trim() : null,
            location != null ? String(location).trim() : null,
            start_time ?? null,
            image_url != null ? String(image_url) : null,
            postid,
            price_min != null ? Number(price_min) : null,
            price_max != null ? Number(price_max) : null,
        ]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error('Error updating post:', err);
        res.status(500).json({ error: 'Failed to update post', details: err.message });
    }
});
// DELETE /posts/:postid
router.delete('/:postid', async (req, res) => {
    const postid = parseInt(String(req.params.postid ?? ''), 10);
    if (!Number.isInteger(postid) || postid <= 0) {
        return res.status(400).json({ error: 'Valid post ID is required' });
    }
    try {
        const result = await db_1.default.query('DELETE FROM posts WHERE postid = $1 RETURNING postid', [postid]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        res.json({ deleted: postid });
    }
    catch (err) {
        console.error('Error deleting post:', err);
        res.status(500).json({ error: 'Failed to delete post', details: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=posts.js.map