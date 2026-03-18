"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
// GET all posts
router.get('/', async (req, res) => {
    try {
        const result = await db_1.default.query(`
      SELECT p.PostID, p.Title, p.DisplayName, p.Location, p.Start_Time, p.Description, p.Image_URL
      FROM Posts p
      ORDER BY p.DateAndTime DESC 
    `);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});
// POST a new post
router.post('/', async (req, res) => {
    const { userID, displayname, title, description, location, address, start_time, dateandtime, image_url } = req.body;
    try {
        const result = await db_1.default.query(`INSERT INTO Posts (UserID, DisplayName, Title, Description, Location, Address, Start_Time, DateAndTime, Image_URL)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`, [userID, displayname, title, description, location, address, start_time, dateandtime, image_url]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create post' });
    }
});
exports.default = router;
//# sourceMappingURL=posts.js.map