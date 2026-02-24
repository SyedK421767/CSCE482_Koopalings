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
    const { first_name, last_name, phone_number, email, username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    const type = 'regular'; // <- hardcoded cleanly
    try {
        const result = await db_1.default.query(`
      INSERT INTO users (
        type,
        username,
        password,
        phone_number,
        email,
        first_name,
        last_name
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `, [type, username, password, phone_number, email, first_name, last_name]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map