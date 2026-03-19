"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;
function normalizePhoneNumber(value) {
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
        return digitsOnly.slice(1);
    }
    if (digitsOnly.length === 10) {
        return digitsOnly;
    }
    return null;
}
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
    const normalizedEmail = String(email ?? '').trim();
    const normalizedPassword = String(password ?? '');
    if (!normalizedEmail && !normalizedPassword) {
        return res.status(400).json({ error: 'Please enter your email and password' });
    }
    if (!normalizedEmail) {
        return res.status(400).json({ error: 'Email is required' });
    }
    if (!normalizedPassword) {
        return res.status(400).json({ error: 'Password is required' });
    }
    if (!EMAIL_REGEX.test(normalizedEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    try {
        const result = await db_1.default.query(`
      SELECT userid, first_name, last_name, phone_number, email, type, password
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `, [normalizedEmail]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Incorrect credentials' });
        }
        const user = result.rows[0];
        if (user.password !== normalizedPassword) {
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
    const normalizedFirstName = String(first_name ?? '').trim();
    const normalizedLastName = String(last_name ?? '').trim();
    const rawPhoneNumber = String(phone_number ?? '').trim();
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const normalizedPassword = String(password ?? '');
    const normalizedPhoneNumber = normalizePhoneNumber(rawPhoneNumber);
    if (!normalizedFirstName ||
        !normalizedLastName ||
        !rawPhoneNumber ||
        !normalizedEmail ||
        !normalizedPassword) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    if (!normalizedPhoneNumber) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit phone number' });
    }
    if (!EMAIL_REGEX.test(normalizedEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    if (!PASSWORD_REGEX.test(normalizedPassword)) {
        return res.status(400).json({
            error: 'Password must be at least 12 characters and include one uppercase letter, one number, and one special character',
        });
    }
    const type = 'regular';
    try {
        const existingUser = await db_1.default.query(`
      SELECT userid
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `, [normalizedEmail]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'Email is already registered' });
        }
        const existingPhone = await db_1.default.query(`
      SELECT userid
      FROM users
      WHERE
        CASE
          WHEN LENGTH(REGEXP_REPLACE(phone_number, '\\D', '', 'g')) = 11
               AND REGEXP_REPLACE(phone_number, '\\D', '', 'g') LIKE '1%'
            THEN SUBSTRING(REGEXP_REPLACE(phone_number, '\\D', '', 'g') FROM 2)
          ELSE REGEXP_REPLACE(phone_number, '\\D', '', 'g')
        END = $1
      LIMIT 1
      `, [normalizedPhoneNumber]);
        if (existingPhone.rows.length > 0) {
            return res.status(409).json({ error: 'Phone number is already registered' });
        }
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
      `, [
            type,
            normalizedPassword,
            normalizedPhoneNumber,
            normalizedEmail,
            normalizedFirstName,
            normalizedLastName,
        ]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        if (err?.code === '23505') {
            if (String(err?.constraint ?? '').toLowerCase().includes('phone')) {
                return res.status(409).json({ error: 'Phone number is already registered' });
            }
            return res.status(409).json({ error: 'Email is already registered' });
        }
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map