const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const {
  DB_HOST = 'db',
  DB_PORT = 5432,
  DB_USER = 'appuser',
  DB_PASSWORD = 'secretpw',
  DB_NAME = 'studentdb',
  PORT = 3000
} = process.env;

const pool = new Pool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  max: 10,
  idleTimeoutMillis: 30000
});

// Health endpoint for quick checks
app.get('/api/health', async (req, res) => {
  try {
    const r = await pool.query('SELECT 1 as ok');
    res.json({ status: 'ok', db: r.rows[0].ok === 1 });
  } catch (err) {
    console.error('Health error:', err);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// GET /api/student/:id -> student by id
app.get('/api/student/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ error: 'Missing student id' });

  try {
    const q = 'SELECT id, name, major, year FROM students WHERE id = $1';
    const { rows } = await pool.query(q, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// (Optional) simple search by name
app.get('/api/students', async (req, res) => {
  const name = (req.query.name || '').trim();
  try {
    let rows;
    if (name) {
      const q = 'SELECT id, name, major, year FROM students WHERE LOWER(name) LIKE LOWER($1) ORDER BY id';
      const { rows: r } = await pool.query(q, [ '%' + name + '%' ]);
      rows = r;
    } else {
      const { rows: r } = await pool.query('SELECT id, name, major, year FROM students ORDER BY id');
      rows = r;
    }
    res.json(rows);
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Backend listening on port ${PORT}`);
});
