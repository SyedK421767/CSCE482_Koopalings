"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
// GET all tags
router.get('/', async (req, res) => {
    try {
        const result = await db_1.default.query(`
      SELECT TagID, Name
      FROM tags
      ORDER BY Name ASC
    `);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch tags' });
    }
});
// GET all post-tag associations
router.get('/post-tags', async (req, res) => {
    try {
        const result = await db_1.default.query(`
      SELECT PostID, TagID
      FROM post_tags
    `);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch post-tags' });
    }
});
exports.default = router;
//# sourceMappingURL=tags.js.map