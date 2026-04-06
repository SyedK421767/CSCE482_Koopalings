import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

async function fetchUserProfile(userId: number) {
  const [userResult, tagResult] = await Promise.all([
    pool.query(
      `
      SELECT userid, first_name, last_name, phone_number, email, type
      FROM users
      WHERE userid = $1
      `,
      [userId]
    ),
    pool.query(
      `
      SELECT t.tagid, t.name
      FROM tags t
      JOIN user_tags ut ON ut.tagid = t.tagid
      WHERE ut.userid = $1
      ORDER BY t.name ASC
      `,
      [userId]
    ),
  ]);

  if (userResult.rowCount === 0) {
    return null;
  }

  const user = userResult.rows[0];
  return {
    ...user,
    tags: tagResult.rows,
  };
}

function normalizePhoneNumber(value: string): string | null {
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
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT userid, first_name, last_name, phone_number, email, type
      FROM users
      ORDER BY userid DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST log in user
router.post('/login', async (req: Request, res: Response) => {
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
    console.log('Login attempt for email:', normalizedEmail);
    const result = await pool.query(
      `
      SELECT userid, password
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      console.log('No user found with email:', normalizedEmail);
      return res.status(401).json({ error: 'Incorrect credentials' });
    }

    const user = result.rows[0];
    console.log('User found, checking password...');

    if (user.password !== normalizedPassword) {
      console.log('Password mismatch');
      return res.status(401).json({ error: 'Incorrect credentials' });
    }

    console.log('Login successful for user:', user.userid);

    const profile = await fetchUserProfile(user.userid);
    if (!profile) {
      return res.status(500).json({ error: 'User profile missing' });
    }

    return res.json(profile);
  } catch (err) {
    console.error('Failed to log in:', err);
    return res.status(500).json({ error: 'Failed to log in' });
  }
});

// POST create a new user
router.post('/', async (req: Request, res: Response) => {
  const {
    first_name,
    last_name,
    phone_number,
    email,
    password
  } = req.body;

  const normalizedFirstName = String(first_name ?? '').trim();
  const normalizedLastName = String(last_name ?? '').trim();
  const rawPhoneNumber = String(phone_number ?? '').trim();
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  const normalizedPassword = String(password ?? '');
  const normalizedPhoneNumber = normalizePhoneNumber(rawPhoneNumber);

  if (
    !normalizedFirstName ||
    !normalizedLastName ||
    !rawPhoneNumber ||
    !normalizedEmail ||
    !normalizedPassword
  ) {
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
      error:
        'Password must be at least 12 characters and include one uppercase letter, one number, and one special character',
    });
  }

  const type = 'regular';

  try {
    const existingUser = await pool.query(
      `
      SELECT userid
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    const existingPhone = await pool.query(
      `
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
      `,
      [normalizedPhoneNumber]
    );

    if (existingPhone.rows.length > 0) {
      return res.status(409).json({ error: 'Phone number is already registered' });
    }

    const result = await pool.query(
      `
    INSERT INTO users (
      type,
      password,
      phone_number,
      email,
      first_name,
      last_name
    )
    VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING userid
      `,
      [
        type,
        normalizedPassword,
        normalizedPhoneNumber,
        normalizedEmail,
        normalizedFirstName,
        normalizedLastName,
      ]
    );

    const userId = result.rows[0].userid;
    const profile = await fetchUserProfile(userId);
    if (!profile) {
      throw new Error('Failed to build profile');
    }
    res.status(201).json(profile);
  } catch (err: any) {
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

router.get('/:userid/tags', async (req: Request, res: Response) => {
  const userId = parseInt(String(req.params.userid ?? ''), 10);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Valid user ID is required' });
  }

  try {
    const result = await pool.query(
      `
      SELECT t.tagid, t.name
      FROM tags t
      JOIN user_tags ut ON ut.tagid = t.tagid
      WHERE ut.userid = $1
      ORDER BY t.name ASC
      `,
      [userId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch user tags:', err);
    return res.status(500).json({ error: 'Failed to fetch user tags' });
  }
});

router.put('/:userid/tags', async (req: Request, res: Response) => {
  const userId = parseInt(String(req.params.userid ?? ''), 10);
  const tagIds = Array.isArray(req.body.tagIds)
    ? (req.body.tagIds as unknown[])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : [];

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Valid user ID is required' });
  }

  try {
    await pool.query('DELETE FROM user_tags WHERE userid = $1', [userId]);
    if (tagIds.length > 0) {
      const placeholders = tagIds
        .map((_, idx: number) => `($1, $${idx + 2})`)
        .join(', ');
      await pool.query(`INSERT INTO user_tags (userid, tagid) VALUES ${placeholders}`, [userId, ...tagIds]);
    }

    const profile = await fetchUserProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(profile);
  } catch (err) {
    console.error('Failed to update user tags:', err);
    return res.status(500).json({ error: 'Failed to update user tags' });
  }
});

export default router;
