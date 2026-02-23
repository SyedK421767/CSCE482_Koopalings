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
      SELECT p.PostID, p.Title, u.Username
      FROM Posts p
      JOIN Users u ON p.UserID = u.UserID
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
    const { userID, title, description, location } = req.body;
    try {
        const result = await db_1.default.query(`INSERT INTO Posts (UserID, Title, Description, Location, DateAndTime)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`, [userID, title, description, location]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create post' });
    }
});
exports.default = router;
//# sourceMappingURL=posts.js.map