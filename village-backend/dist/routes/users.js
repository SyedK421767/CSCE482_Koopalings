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
      SELECT userid, first_name, last_name, phone_number, email, type
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
// POST log in user
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    try {
        const result = await db_1.default.query(`
      SELECT userid, first_name, last_name, phone_number, email, type, password
      FROM users
      WHERE email = $1
      LIMIT 1
      `, [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Incorrect credentials' });
        }
        const user = result.rows[0];
        if (user.password !== password) {
            return res.status(401).json({ error: 'Incorrect credentials' });
        }
        const { password: _password, ...safeUser } = user;
        return res.json(safeUser);
    }
    catch (err) {
        console.error('Failed to log in:', err);
        return res.status(500).json({ error: 'Failed to log in' });
    }
});
// POST create a new user
router.post('/', async (req, res) => {
    const { first_name, last_name, phone_number, email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    const type = 'regular';
    try {
        const result = await db_1.default.query(`
      INSERT INTO users (
        type,
        password,
        phone_number,
        email,
        first_name,
        last_name
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `, [type, password, phone_number, email, first_name, last_name]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map