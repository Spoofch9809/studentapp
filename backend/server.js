const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const {
  DB_HOST = 'db',
  DB_PORT = 5432,
  DB_USER = 'appuser',
  DB_PASSWORD = 'secretpw',
  DB_NAME = 'golfdb',
  PORT = 3000
} = process.env;

const pool = new Pool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  max: 20,
  idleTimeoutMillis: 30000
});

// Utility function to generate IDs
function generateId(prefix) {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

// Health endpoint
app.get('/api/health', async (req, res) => {
  try {
    const r = await pool.query('SELECT 1 as ok');
    res.json({ status: 'ok', db: r.rows[0].ok === 1, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Health error:', err);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// ===== GOLF COURSES ENDPOINTS =====

// Get all courses with enhanced data
app.get('/api/courses', async (req, res) => {
  const { search, difficulty, min_price, max_price, sort = 'course_name' } = req.query;
  
  try {
    let query = `
      SELECT gc.*, 
             COALESCE(avg_rating.avg_rating, 0) as avg_rating,
             COALESCE(review_count.count, 0) as review_count
      FROM golf_courses gc
      LEFT JOIN (
        SELECT course_id, ROUND(AVG(rating::numeric), 1) as avg_rating 
        FROM course_reviews 
        GROUP BY course_id
      ) avg_rating ON gc.course_id = avg_rating.course_id
      LEFT JOIN (
        SELECT course_id, COUNT(*) as count 
        FROM course_reviews 
        GROUP BY course_id
      ) review_count ON gc.course_id = review_count.course_id
    `;
    
    let conditions = [];
    let params = [];

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
      params.push(parseFloat(min_price));
    }

    if (max_price) {
      conditions.push(`gc.green_fee <= $${params.length + 1}`);
      params.push(parseFloat(max_price));
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

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

// Get specific course with reviews
app.get('/api/courses/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get course details
    const courseQuery = `
      SELECT gc.*, 
             COALESCE(ROUND(AVG(cr.rating::numeric), 1), 0) as avg_rating,
             COUNT(cr.review_id) as review_count
      FROM golf_courses gc
      LEFT JOIN course_reviews cr ON gc.course_id = cr.course_id
      WHERE gc.course_id = $1
      GROUP BY gc.course_id
    `;
    
    const { rows: courseRows } = await pool.query(courseQuery, [id]);
    if (courseRows.length === 0) {
      return res.status(404).json({ error: 'Golf course not found' });
    }

    // Get recent reviews
    const reviewsQuery = `
      SELECT cr.*, m.first_name, m.last_name, m.membership_type
      FROM course_reviews cr
      JOIN members m ON cr.member_id = m.member_id
      WHERE cr.course_id = $1
      ORDER BY cr.review_date DESC
      LIMIT 5
    `;
    
    const { rows: reviewRows } = await pool.query(reviewsQuery, [id]);

    // Get available tee times for today and tomorrow
    const teeTimesQuery = `
      SELECT tt.time_slot, tt.max_players, tt.is_premium,
             CASE WHEN b.booking_id IS NOT NULL THEN 'Booked' ELSE 'Available' END as status
      FROM tee_times tt
      LEFT JOIN bookings b ON tt.course_id = b.course_id 
        AND tt.time_slot = b.tee_time 
        AND b.booking_date IN (CURRENT_DATE, CURRENT_DATE + 1)
        AND b.status IN ('Confirmed', 'Pending')
      WHERE tt.course_id = $1
      ORDER BY tt.time_slot
    `;
    
    const { rows: teeTimeRows } = await pool.query(teeTimesQuery, [id]);

    res.json({
      course: courseRows[0],
      recent_reviews: reviewRows,
      tee_times: teeTimeRows
    });
  } catch (err) {
    console.error('Course detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== MEMBERS ENDPOINTS =====

// Get all members
app.get('/api/members', async (req, res) => {
  try {
    const query = `
      SELECT m.*, gc.course_name as favorite_course_name
      FROM members m
      LEFT JOIN golf_courses gc ON m.favorite_course = gc.course_id
      ORDER BY m.first_name, m.last_name
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Members query error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new member
app.post('/api/members', async (req, res) => {
  const { first_name, last_name, email, phone, handicap, membership_type } = req.body;
  
  if (!first_name || !last_name || !email) {
    return res.status(400).json({ error: 'First name, last name, and email are required' });
  }

  try {
    const member_id = generateId('M');
    const query = `
      INSERT INTO members (member_id, first_name, last_name, email, phone, handicap, membership_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [
      member_id, first_name, last_name, email, phone || null, 
      handicap || 0.0, membership_type || 'Regular'
    ]);
    
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') { // Unique constraint violation
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Create member error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== BOOKINGS ENDPOINTS =====

// Get all bookings
app.get('/api/bookings', async (req, res) => {
  const { member_id, course_id, status, date } = req.query;
  
  try {
    let query = `
      SELECT b.*, 
             m.first_name, m.last_name, m.email,
             gc.course_name, gc.location
      FROM bookings b
      JOIN members m ON b.member_id = m.member_id
      JOIN golf_courses gc ON b.course_id = gc.course_id
    `;
    
    let conditions = [];
    let params = [];

    if (member_id) {
      conditions.push(`b.member_id = $${params.length + 1}`);
      params.push(member_id);
    }
    
    if (course_id) {
      conditions.push(`b.course_id = $${params.length + 1}`);
      params.push(course_id);
    }
    
    if (status) {
      conditions.push(`b.status = $${params.length + 1}`);
      params.push(status);
    }
    
    if (date) {
      conditions.push(`b.booking_date = $${params.length + 1}`);
      params.push(date);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY b.booking_date DESC, b.tee_time DESC';
    
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Bookings query error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new booking
app.post('/api/bookings', async (req, res) => {
  const { member_id, course_id, booking_date, tee_time, players_count, special_requests } = req.body;
  
  if (!member_id || !course_id || !booking_date || !tee_time) {
    return res.status(400).json({ error: 'Member ID, Course ID, date, and tee time are required' });
  }

  try {
    // Check if time slot is available
    const availabilityQuery = `
      SELECT 1 FROM bookings 
      WHERE course_id = $1 AND booking_date = $2 AND tee_time = $3 
      AND status IN ('Confirmed', 'Pending')
    `;
    const { rows: conflicts } = await pool.query(availabilityQuery, [course_id, booking_date, tee_time]);
    
    if (conflicts.length > 0) {
      return res.status(400).json({ error: 'Time slot is already booked' });
    }

    // Get course green fee
    const courseQuery = 'SELECT green_fee FROM golf_courses WHERE course_id = $1';
    const { rows: courseRows } = await pool.query(courseQuery, [course_id]);
    
    if (courseRows.length === 0) {
      return res.status(400).json({ error: 'Course not found' });
    }

    const booking_id = generateId('B');
    const total_amount = courseRows[0].green_fee * (players_count || 1);
    
    const insertQuery = `
      INSERT INTO bookings (booking_id, member_id, course_id, booking_date, tee_time, players_count, total_amount, special_requests)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const { rows } = await pool.query(insertQuery, [
      booking_id, member_id, course_id, booking_date, tee_time, 
      players_count || 1, total_amount, special_requests || null
    ]);
    
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update booking status
app.patch('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!['Pending', 'Confirmed', 'Completed', 'Cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const query = 'UPDATE bookings SET status = $1 WHERE booking_id = $2 RETURNING *';
    const { rows } = await pool.query(query, [status, id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('Update booking error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== REVIEWS ENDPOINTS =====

// Add course review
app.post('/api/reviews', async (req, res) => {
  const { course_id, member_id, rating, comment } = req.body;
  
  if (!course_id || !member_id || !rating) {
    return res.status(400).json({ error: 'Course ID, Member ID, and rating are required' });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  try {
    const query = `
      INSERT INTO course_reviews (course_id, member_id, rating, comment)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (course_id, member_id) 
      DO UPDATE SET rating = $3, comment = $4, review_date = CURRENT_DATE
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [course_id, member_id, rating, comment || null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create review error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== ANALYTICS ENDPOINTS =====

// Dashboard statistics
app.get('/api/analytics/dashboard', async (req, res) => {
  try {
    const stats = await Promise.all([
      // Total courses
      pool.query('SELECT COUNT(*) as total_courses FROM golf_courses'),
      // Total members
      pool.query('SELECT COUNT(*) as total_members FROM members'),
      // Total bookings today
      pool.query('SELECT COUNT(*) as today_bookings FROM bookings WHERE booking_date = CURRENT_DATE'),
      // Revenue this month
      pool.query(`
        SELECT COALESCE(SUM(total_amount), 0) as monthly_revenue 
        FROM bookings 
        WHERE DATE_TRUNC('month', booking_date) = DATE_TRUNC('month', CURRENT_DATE)
        AND status IN ('Confirmed', 'Completed')
      `),
      // Popular courses
      pool.query(`
        SELECT gc.course_name, COUNT(b.booking_id) as booking_count
        FROM golf_courses gc
        LEFT JOIN bookings b ON gc.course_id = b.course_id
        WHERE b.booking_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY gc.course_id, gc.course_name
        ORDER BY booking_count DESC
        LIMIT 3
      `)
    ]);

    res.json({
      total_courses: parseInt(stats[0].rows[0].total_courses),
      total_members: parseInt(stats[1].rows[0].total_members),
      today_bookings: parseInt(stats[2].rows[0].today_bookings),
      monthly_revenue: parseFloat(stats[3].rows[0].monthly_revenue),
      popular_courses: stats[4].rows
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🏌️ Advanced Golf Course API listening on port ${PORT}`);
  console.log(`📊 API Endpoints available:`);
  console.log(`   GET  /api/health`);
  console.log(`   GET  /api/courses`);
  console.log(`   GET  /api/courses/:id`);
  console.log(`   GET  /api/members`);
  console.log(`   POST /api/members`);
  console.log(`   GET  /api/bookings`);
  console.log(`   POST /api/bookings`);
  console.log(`   PATCH /api/bookings/:id`);
  console.log(`   POST /api/reviews`);
  console.log(`   GET  /api/analytics/dashboard`);
});