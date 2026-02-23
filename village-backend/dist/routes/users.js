"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
// GET all users
router.get('/', async (req, res) => {
    try {
        const result = await db_1.default.query(`
      SELECT userid, first_name, last_name, phone_number, email, username, type
      FROM users
      ORDER BY userid DESC
    `);
        res.json(result.rows);
    }
    catch (err) {
        console.error('Failed to fetch users:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
// POST create a new user
router.post('/', async (req, res) => {
    const { first_name, last_name, phone_number, email } = req.body;
    if (!first_name || !last_name || !phone_number || !email) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
        const result = await db_1.default.query(`
      INSERT INTO users (first_name, last_name, phone_number, email)
      VALUES ($1, $2, $3, $4)
      RETURNING userid, first_name, last_name, phone_number, email
      `, [first_name, last_name, phone_number, email]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error('Failed to create user:', err);
        res.status(500).json({ error: 'Failed to create user' });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map