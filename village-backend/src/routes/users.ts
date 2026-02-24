import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// GET all users
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT userid, first_name, last_name, phone_number, email, username, type
      FROM users
      ORDER BY userid DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST create a new user
router.post('/', async (req: Request, res: Response) => {
  const {
    first_name,
    last_name,
    phone_number,
    email,
    username,
    password
  } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const type = 'regular'; // <- hardcoded cleanly

  try {
    const result = await pool.query(
      `
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
      `,
      [type, username, password, phone_number, email, first_name, last_name]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;