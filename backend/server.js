require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();          // create app first
app.use(cors({ origin: '*' })); // then attach CORS
app.use(express.json());



// ---------- DB POOL ----------
const {
  DB_HOST = 'localhost',
  DB_PORT = 5432,
<<<<<<< Updated upstream
  DB_USER = 'appuser',
  DB_PASSWORD = 'secretpw',
  DB_NAME = 'studentdb',
  PORT = 3000
=======
  DB_USER = 'postgres',
  DB_PASSWORD = 'Peam56201',
  DB_NAME = 'golfsystem',
  PORT = 3001,
  NODE_ENV = 'development'
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
// Health endpoint for quick checks
app.get('/api/health', async (req, res) => {
  try {
    const r = await pool.query('SELECT 1 as ok');
    res.json({ status: 'ok', db: r.rows[0].ok === 1 });
=======
// DB connection check endpoint
app.get('/api/dbcheck', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT current_database() AS database,
             current_user AS user,
             inet_server_addr() AS host,
             inet_server_port() AS port
    `);
    res.json({
      status: 'connected',
      ...r.rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('DB check failed:', err.message);
    res.status(500).json({
      status: 'error',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});


// ---------- UTIL ----------
function generateId(prefix) {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function isIsoDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s)); }
function isTime(s) { return /^\d{2}:\d{2}(:\d{2})?$/.test(String(s)); }

// ---------- HEALTH / DEBUG ----------
app.get('/api/health', async (_req, res) => {
  try {
    const r = await pool.query('SELECT 1 AS ok');
    res.json({ status: 'ok', db: r.rows[0].ok === 1, env: NODE_ENV, at: new Date().toISOString() });
>>>>>>> Stashed changes
  } catch (err) {
    console.error('Health error:', err);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

<<<<<<< Updated upstream
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
=======
app.get('/api/debug/dbinfo', async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT current_database() AS db, current_user AS "user",
             inet_server_addr() AS host, inet_server_port() AS port
    `);
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===================================================================
// =====================  COURSES (CRUD & LIST)  =====================
// ===================================================================

// List with filters/sort and computed ratings
app.get('/api/courses', async (req, res) => {
  const { search, difficulty, min_price, max_price, sort = 'course_name' } = req.query;

  try {
    let query = `
      SELECT gc.*,
             COALESCE(ar.avg_rating, 0) AS avg_rating,
             COALESCE(rc.review_count, 0) AS review_count
      FROM golf_courses gc
      LEFT JOIN (
        SELECT course_id, ROUND(AVG(rating::numeric), 1) AS avg_rating
        FROM course_reviews GROUP BY course_id
      ) ar ON gc.course_id = ar.course_id
      LEFT JOIN (
        SELECT course_id, COUNT(*) AS review_count
        FROM course_reviews GROUP BY course_id
      ) rc ON gc.course_id = rc.course_id
    `;

    const conditions = [];
    const params = [];

    if (search) {
      conditions.push(`(LOWER(gc.course_name) LIKE LOWER($${params.length + 1}) OR LOWER(gc.location) LIKE LOWER($${params.length + 1}))`);
      params.push(`%${search}%`);
    }
    if (difficulty && ['Beginner', 'Intermediate', 'Advanced', 'Professional'].includes(difficulty)) {
      conditions.push(`gc.difficulty_level = $${params.length + 1}`);
      params.push(difficulty);
    }
    if (min_price) {
      conditions.push(`gc.green_fee >= $${params.length + 1}`);
      params.push(Number(min_price));
    }
    if (max_price) {
      conditions.push(`gc.green_fee <= $${params.length + 1}`);
      params.push(Number(max_price));
    }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');

    const validSorts = ['course_name', 'green_fee', 'rating', 'difficulty_level'];
    const sortField = validSorts.includes(sort) ? sort : 'course_name';
    query += ` ORDER BY ${sortField === 'rating' ? 'avg_rating DESC' : `gc.${sortField}`}`;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Courses query error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get one (with recent reviews + today/tomorrow tee occupancy view)
app.get('/api/courses/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const courseQ = `
      SELECT gc.*,
             COALESCE(ROUND(AVG(cr.rating::numeric), 1), 0) AS avg_rating,
             COUNT(cr.review_id) AS review_count
      FROM golf_courses gc
      LEFT JOIN course_reviews cr ON gc.course_id = cr.course_id
      WHERE gc.course_id = $1
      GROUP BY gc.course_id
    `;
    const course = await pool.query(courseQ, [id]);
    if (course.rowCount === 0) return res.status(404).json({ error: 'Golf course not found' });

    const reviews = await pool.query(`
      SELECT cr.*, m.first_name, m.last_name, m.membership_type
      FROM course_reviews cr
      JOIN members m ON cr.member_id = m.member_id
      WHERE cr.course_id = $1
      ORDER BY cr.review_date DESC
      LIMIT 5
    `, [id]);

    const tee = await pool.query(`
      SELECT tt.time_slot, tt.max_players, tt.is_premium,
             CASE WHEN b.booking_id IS NOT NULL THEN 'Booked' ELSE 'Available' END AS status
      FROM tee_times tt
      LEFT JOIN bookings b
        ON tt.course_id = b.course_id
       AND tt.time_slot = b.tee_time
       AND b.booking_date IN (CURRENT_DATE, CURRENT_DATE + 1)
       AND b.status IN ('Confirmed', 'Pending')
      WHERE tt.course_id = $1
      ORDER BY tt.time_slot
    `, [id]);

    res.json({ course: course.rows[0], recent_reviews: reviews.rows, tee_times: tee.rows });
  } catch (err) {
    console.error('Course detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create course
app.post('/api/courses', async (req, res) => {
  const {
    course_id, course_name, location, par, holes = 18, green_fee,
    difficulty_level, description, facilities, phone, email, website,
    rating = 0.0, total_reviews = 0, instructor, instructor_experience,
    established, dress_code, operating_hours, special_features, max_capacity = 20
  } = req.body;

  if (!course_id || !course_name || !location || !par || !green_fee || !difficulty_level) {
    return res.status(400).json({ error: 'Missing required fields (course_id, course_name, location, par, green_fee, difficulty_level)' });
  }

  try {
    const q = `
      INSERT INTO golf_courses (
        course_id, course_name, location, par, holes, green_fee, difficulty_level,
        description, facilities, phone, email, website, rating, total_reviews,
        instructor, instructor_experience, established, dress_code, operating_hours,
        special_features, max_capacity
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
      )
      RETURNING *
    `;
    const { rows } = await pool.query(q, [
      course_id, course_name, location, par, holes, green_fee, difficulty_level,
      description || null, facilities || null, phone || null, email || null, website || null,
      rating, total_reviews, instructor || null, instructor_experience || null,
      established || null, dress_code || null, operating_hours || null, special_features || null,
      max_capacity
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create course error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update course (partial)
app.patch('/api/courses/:id', async (req, res) => {
  const { id } = req.params;
  // Build dynamic SET
  const fields = [
    'course_name','location','par','holes','green_fee','difficulty_level','description','facilities',
    'phone','email','website','rating','total_reviews','instructor','instructor_experience',
    'established','dress_code','operating_hours','special_features','max_capacity'
  ];
  const updates = [];
  const params = [];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) {
      params.push(req.body[f]);
      updates.push(`${f} = $${params.length}`);
    }
  });
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

  try {
    const q = `
      UPDATE golf_courses
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE course_id = $${params.length + 1}
      RETURNING *
    `;
    params.push(id);
    const { rows } = await pool.query(q, params);
    if (!rows.length) return res.status(404).json({ error: 'Golf course not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Update course error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete course
app.delete('/api/courses/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const d = await pool.query('DELETE FROM golf_courses WHERE course_id = $1 RETURNING course_id', [id]);
    if (!d.rowCount) return res.status(404).json({ error: 'Golf course not found' });
    res.json({ deleted: id });
  } catch (err) {
    console.error('Delete course error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===================================================================
// ============================ MEMBERS ==============================
// ===================================================================

app.get('/api/members', async (_req, res) => {
  try {
    const q = `
      SELECT m.*, gc.course_name AS favorite_course_name
      FROM members m
      LEFT JOIN golf_courses gc ON m.favorite_course = gc.course_id
      ORDER BY m.first_name, m.last_name
    `;
    const { rows } = await pool.query(q);
    res.json(rows);
  } catch (err) {
    console.error('Members query error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/members', async (req, res) => {
  const { first_name, last_name, email, phone, handicap = 0.0, membership_type = 'Regular', favorite_course } = req.body;
  if (!first_name || !last_name || !email) return res.status(400).json({ error: 'first_name, last_name, email are required' });

  try {
    const member_id = generateId('M');
    // optional FK check
    if (favorite_course) {
      const c = await pool.query('SELECT 1 FROM golf_courses WHERE course_id = $1', [favorite_course]);
      if (!c.rowCount) return res.status(400).json({ error: 'favorite_course not found' });
    }
    const q = `
      INSERT INTO members (member_id, first_name, last_name, email, phone, handicap, membership_type, favorite_course)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `;
    const { rows } = await pool.query(q, [member_id, first_name, last_name, email, phone || null, handicap, membership_type, favorite_course || null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already exists' });
    console.error('Create member error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/members/:id', async (req, res) => {
  const { id } = req.params;
  const fields = ['first_name','last_name','email','phone','handicap','membership_type','favorite_course'];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      if (f === 'favorite_course' && req.body[f]) {
        const exist = await pool.query('SELECT 1 FROM golf_courses WHERE course_id = $1', [req.body[f]]);
        if (!exist.rowCount) return res.status(400).json({ error: 'favorite_course not found' });
      }
      params.push(req.body[f]);
      updates.push(`${f} = $${params.length}`);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

  try {
    const q = `UPDATE members SET ${updates.join(', ')} WHERE member_id = $${params.length + 1} RETURNING *`;
    params.push(id);
    const { rows } = await pool.query(q, params);
    if (!rows.length) return res.status(404).json({ error: 'Member not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already exists' });
    console.error('Update member error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/members/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const d = await pool.query('DELETE FROM members WHERE member_id = $1 RETURNING member_id', [id]);
    if (!d.rowCount) return res.status(404).json({ error: 'Member not found' });
    res.json({ deleted: id });
  } catch (err) {
    console.error('Delete member error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===================================================================
// ============================ TEE TIMES ============================
// ===================================================================

app.get('/api/tee-times', async (req, res) => {
  const { course_id } = req.query;
  try {
    let q = 'SELECT * FROM tee_times';
    const params = [];
    if (course_id) { q += ' WHERE course_id = $1'; params.push(course_id); }
    q += ' ORDER BY course_id, time_slot';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) {
    console.error('Tee times error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/tee-times', async (req, res) => {
  const { course_id, time_slot, max_players = 4, is_premium = false } = req.body;
  if (!course_id || !time_slot || !isTime(time_slot)) return res.status(400).json({ error: 'course_id and valid time_slot (HH:MM[:SS]) required' });
  try {
    const c = await pool.query('SELECT 1 FROM golf_courses WHERE course_id = $1', [course_id]);
    if (!c.rowCount) return res.status(400).json({ error: 'course_id not found' });

    const ins = await pool.query(
      'INSERT INTO tee_times (course_id, time_slot, max_players, is_premium) VALUES ($1,$2,$3,$4) RETURNING *',
      [course_id, time_slot, max_players, is_premium]
    );
    res.status(201).json(ins.rows[0]);
  } catch (err) {
    console.error('Create tee time error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/tee-times/:slot_id', async (req, res) => {
  const { slot_id } = req.params;
  try {
    const del = await pool.query('DELETE FROM tee_times WHERE slot_id = $1 RETURNING slot_id', [slot_id]);
    if (!del.rowCount) return res.status(404).json({ error: 'Tee time not found' });
    res.json({ deleted: Number(slot_id) });
  } catch (err) {
    console.error('Delete tee time error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===================================================================
// ============================ BOOKINGS ============================
// ===================================================================

app.get('/api/bookings', async (req, res) => {
  const { member_id, course_id, status, date } = req.query;
  try {
    let q = `
      SELECT b.*, m.first_name, m.last_name, m.email, gc.course_name, gc.location
      FROM bookings b
      JOIN members m ON b.member_id = m.member_id
      JOIN golf_courses gc ON b.course_id = gc.course_id
    `;
    const cond = [];
    const params = [];
    if (member_id) { cond.push(`b.member_id = $${params.length + 1}`); params.push(member_id); }
    if (course_id) { cond.push(`b.course_id = $${params.length + 1}`); params.push(course_id); }
    if (status)    { cond.push(`b.status = $${params.length + 1}`); params.push(status); }
    if (date)      { cond.push(`b.booking_date = $${params.length + 1}`); params.push(date); }
    if (cond.length) q += ' WHERE ' + cond.join(' AND ');
    q += ' ORDER BY b.booking_date DESC, b.tee_time DESC';

    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) {
    console.error('Bookings query error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/bookings', async (req, res) => {
  const { member_id, course_id, booking_date, tee_time, players_count = 1, special_requests } = req.body;
  if (!member_id || !course_id || !booking_date || !tee_time) {
    return res.status(400).json({ error: 'member_id, course_id, booking_date, tee_time required' });
  }
  if (!isIsoDate(booking_date) || !isTime(tee_time)) {
    return res.status(400).json({ error: 'booking_date must be YYYY-MM-DD and tee_time HH:MM[:SS]' });
  }

  try {
    // FK checks
    const [m, c] = await Promise.all([
      pool.query('SELECT 1 FROM members WHERE member_id = $1', [member_id]),
      pool.query('SELECT green_fee FROM golf_courses WHERE course_id = $1', [course_id])
    ]);
    if (!m.rowCount) return res.status(400).json({ error: 'member_id not found' });
    if (!c.rowCount) return res.status(400).json({ error: 'course_id not found' });

    // prevent double booking (Confirmed/Pending)
    const conflict = await pool.query(`
      SELECT 1 FROM bookings
      WHERE course_id = $1 AND booking_date = $2 AND tee_time = $3
        AND status IN ('Confirmed', 'Pending')
    `, [course_id, booking_date, tee_time]);
    if (conflict.rowCount) return res.status(400).json({ error: 'Time slot is already booked' });

    const booking_id = generateId('B');
    const total_amount = Number(c.rows[0].green_fee) * Number(players_count || 1);

    const ins = await pool.query(`
      INSERT INTO bookings (booking_id, member_id, course_id, booking_date, tee_time, players_count, total_amount, status, special_requests)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'Confirmed',$8)
      RETURNING *
    `, [booking_id, member_id, course_id, booking_date, tee_time, players_count, total_amount, special_requests || null]);

    res.status(201).json(ins.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Duplicate booking' });
    console.error('Create booking error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const { status, special_requests } = req.body;
  const valid = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];
  if (status && !valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  try {
    const q = `
      UPDATE bookings
         SET status = COALESCE($1, status),
             special_requests = COALESCE($2, special_requests)
       WHERE booking_id = $3
       RETURNING *
    `;
    const { rows } = await pool.query(q, [status || null, special_requests || null, id]);
    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
>>>>>>> Stashed changes
    res.json(rows[0]);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

<<<<<<< Updated upstream
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
=======
app.delete('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const d = await pool.query('DELETE FROM bookings WHERE booking_id = $1 RETURNING booking_id', [id]);
    if (!d.rowCount) return res.status(404).json({ error: 'Booking not found' });
    res.json({ deleted: id });
  } catch (err) {
    console.error('Delete booking error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===================================================================
// ============================ REVIEWS ==============================
// ===================================================================

app.post('/api/reviews', async (req, res) => {
  const { course_id, member_id, rating, comment } = req.body;
  if (!course_id || !member_id || rating == null) return res.status(400).json({ error: 'course_id, member_id, rating required' });
  if (rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be 1..5' });

  try {
    // FK checks
    const [c, m] = await Promise.all([
      pool.query('SELECT 1 FROM golf_courses WHERE course_id = $1', [course_id]),
      pool.query('SELECT 1 FROM members WHERE member_id = $1', [member_id])
    ]);
    if (!c.rowCount) return res.status(400).json({ error: 'course_id not found' });
    if (!m.rowCount) return res.status(400).json({ error: 'member_id not found' });

    const q = `
      INSERT INTO course_reviews (course_id, member_id, rating, comment)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (course_id, member_id)
      DO UPDATE SET rating = $3, comment = $4, review_date = CURRENT_DATE
      RETURNING *
    `;
    const { rows } = await pool.query(q, [course_id, member_id, rating, comment || null]);
    res.status(201).json(rows[0]);
>>>>>>> Stashed changes
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

<<<<<<< Updated upstream
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Backend listening on port ${PORT}`);
=======
// ===================================================================
// =========================== ENROLLMENTS ===========================
// ===================================================================

// List
app.get('/api/enrollments', async (req, res) => {
  const { member_id, course_id, status, date } = req.query;
  try {
    let q = `
      SELECT ce.*, m.first_name, m.last_name, m.email, gc.course_name, gc.instructor
      FROM course_enrollments ce
      JOIN members m ON ce.member_id = m.member_id
      JOIN golf_courses gc ON ce.course_id = gc.course_id
    `;
    const cond = [];
    const params = [];
    if (member_id) { cond.push(`ce.member_id = $${params.length + 1}`); params.push(member_id); }
    if (course_id) { cond.push(`ce.course_id = $${params.length + 1}`); params.push(course_id); }
    if (status)    { cond.push(`ce.status = $${params.length + 1}`); params.push(status); }
    if (date)      { cond.push(`ce.course_date = $${params.length + 1}`); params.push(date); }
    if (cond.length) q += ' WHERE ' + cond.join(' AND ');
    q += ' ORDER BY ce.course_date DESC, ce.course_time DESC';

    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) {
    console.error('Enrollments query error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create
app.post('/api/enrollments', async (req, res) => {
  const { course_id, member_id, course_date, course_time, notes } = req.body;
  if (!course_id || !member_id || !course_date || !course_time) {
    return res.status(400).json({ error: 'course_id, member_id, course_date, course_time required' });
  }
  if (!isIsoDate(course_date) || !isTime(course_time)) {
    return res.status(400).json({ error: 'course_date must be YYYY-MM-DD and course_time HH:MM[:SS]' });
  }

  try {
    // FK checks
    const [c, m] = await Promise.all([
      pool.query('SELECT course_id, max_capacity FROM golf_courses WHERE course_id = $1', [course_id]),
      pool.query('SELECT 1 FROM members WHERE member_id = $1', [member_id])
    ]);
    if (!c.rowCount) return res.status(400).json({ error: 'course_id not found' });
    if (!m.rowCount) return res.status(400).json({ error: 'member_id not found' });

    // capacity check via your function
    const cap = await pool.query(
      'SELECT * FROM get_course_availability($1::text,$2::date,$3::time)',
      [course_id, course_date, course_time]
    );
    const { available_spots = 0 } = cap.rows[0] || {};
    if (available_spots <= 0) return res.status(400).json({ error: 'No available spots for the selected time' });

    const enrollment_id = generateId('E');
    const ins = await pool.query(`
      INSERT INTO course_enrollments (enrollment_id, course_id, member_id, course_date, course_time, status, notes)
      VALUES ($1,$2,$3,$4,$5,'Enrolled',$6)
      RETURNING *
    `, [enrollment_id, course_id, member_id, course_date, course_time, notes || null]);

    res.status(201).json(ins.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'This member is already enrolled for that course & time' });
    console.error('Create enrollment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update status/notes
app.patch('/api/enrollments/:id', async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  const valid = ['Enrolled','Completed','Cancelled','Pending'];
  if (status && !valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  try {
    const q = `
      UPDATE course_enrollments
         SET status = COALESCE($1, status),
             notes  = COALESCE($2, notes),
             completed_at = CASE WHEN $1 = 'Completed' THEN NOW() ELSE completed_at END
       WHERE enrollment_id = $3
       RETURNING *
    `;
    const { rows } = await pool.query(q, [status || null, notes || null, id]);
    if (!rows.length) return res.status(404).json({ error: 'Enrollment not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Update enrollment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/enrollments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const d = await pool.query('DELETE FROM course_enrollments WHERE enrollment_id = $1 RETURNING enrollment_id', [id]);
    if (!d.rowCount) return res.status(404).json({ error: 'Enrollment not found' });
    res.json({ deleted: id });
  } catch (err) {
    console.error('Delete enrollment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===================================================================
// ============================= ANALYTICS ===========================
// ===================================================================

app.get('/api/analytics/dashboard', async (_req, res) => {
  try {
    const stats = await Promise.all([
      pool.query('SELECT COUNT(*) AS total_courses FROM golf_courses'),
      pool.query('SELECT COUNT(*) AS total_members FROM members'),
      pool.query('SELECT COUNT(*) AS today_bookings FROM bookings WHERE booking_date = CURRENT_DATE'),
      pool.query(`
        SELECT COALESCE(SUM(total_amount),0) AS monthly_revenue
          FROM bookings
         WHERE DATE_TRUNC('month', booking_date) = DATE_TRUNC('month', CURRENT_DATE)
           AND status IN ('Confirmed','Completed')
      `),
      pool.query(`
        SELECT gc.course_name, COUNT(b.booking_id) AS booking_count
          FROM golf_courses gc
          LEFT JOIN bookings b ON gc.course_id = b.course_id
         WHERE b.booking_date >= CURRENT_DATE - INTERVAL '30 days'
         GROUP BY gc.course_id, gc.course_name
         ORDER BY booking_count DESC
         LIMIT 3
      `)
    ]);

    res.json({
      total_courses: Number(stats[0].rows[0].total_courses),
      total_members: Number(stats[1].rows[0].total_members),
      today_bookings: Number(stats[2].rows[0].today_bookings),
      monthly_revenue: Number(stats[3].rows[0].monthly_revenue),
      popular_courses: stats[4].rows
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===================================================================
// ============================== START ==============================
// ===================================================================

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🏌️ Golf Course API listening on :${PORT}`);
>>>>>>> Stashed changes
});
