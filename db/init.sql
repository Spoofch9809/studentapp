-- Golf Course Management Database with Course Enrollment System
-- This replaces the original init.sql completely

-- Golf Courses Table
CREATE TABLE IF NOT EXISTS golf_courses (
    course_id TEXT PRIMARY KEY,
    course_name TEXT NOT NULL,
    location TEXT NOT NULL,
    par INT NOT NULL CHECK (par >= 60 AND par <= 80),
    holes INT NOT NULL DEFAULT 18,
    green_fee DECIMAL(8,2) NOT NULL,
    difficulty_level TEXT NOT NULL CHECK (difficulty_level IN ('Beginner', 'Intermediate', 'Advanced', 'Professional')),
    description TEXT,
    facilities TEXT[], 
    phone TEXT,
    email TEXT,
    website TEXT,
    rating DECIMAL(2,1) DEFAULT 0.0 CHECK (rating >= 0 AND rating <= 5),
    total_reviews INT DEFAULT 0,
    instructor TEXT,
    instructor_experience TEXT,
    established INT,
    dress_code TEXT,
    operating_hours TEXT,
    special_features TEXT[],
    max_capacity INT DEFAULT 20,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Members Table
CREATE TABLE IF NOT EXISTS members (
    member_id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    handicap DECIMAL(3,1) DEFAULT 0.0,
    membership_type TEXT DEFAULT 'Regular' CHECK (membership_type IN ('VIP', 'Premium', 'Regular')),
    join_date DATE DEFAULT CURRENT_DATE,
    total_rounds INT DEFAULT 0,
    favorite_course TEXT REFERENCES golf_courses(course_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Course Enrollments Table
CREATE TABLE IF NOT EXISTS course_enrollments (
    enrollment_id TEXT PRIMARY KEY,
    course_id TEXT REFERENCES golf_courses(course_id) ON DELETE CASCADE,
    member_id TEXT REFERENCES members(member_id) ON DELETE CASCADE,
    course_date DATE NOT NULL,
    course_time TIME NOT NULL,
    status TEXT DEFAULT 'Enrolled' CHECK (status IN ('Enrolled', 'Completed', 'Cancelled', 'Pending')),
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    notes TEXT,
    UNIQUE(course_id, member_id, course_date, course_time)
);

-- Golf Bookings Table (separate from course enrollments)
CREATE TABLE IF NOT EXISTS bookings (
    booking_id TEXT PRIMARY KEY,
    member_id TEXT REFERENCES members(member_id),
    course_id TEXT REFERENCES golf_courses(course_id),
    booking_date DATE NOT NULL,
    tee_time TIME NOT NULL,
    players_count INT DEFAULT 1 CHECK (players_count >= 1 AND players_count <= 4),
    total_amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'Confirmed' CHECK (status IN ('Pending', 'Confirmed', 'Completed', 'Cancelled')),
    special_requests TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_id, booking_date, tee_time)
);

-- Course Reviews Table
CREATE TABLE IF NOT EXISTS course_reviews (
    review_id SERIAL PRIMARY KEY,
    course_id TEXT REFERENCES golf_courses(course_id),
    member_id TEXT REFERENCES members(member_id),
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    review_date DATE DEFAULT CURRENT_DATE,
    UNIQUE(course_id, member_id)
);

-- Tee Times Table
CREATE TABLE IF NOT EXISTS tee_times (
    slot_id SERIAL PRIMARY KEY,
    course_id TEXT REFERENCES golf_courses(course_id),
    time_slot TIME NOT NULL,
    max_players INT DEFAULT 4,
    is_premium BOOLEAN DEFAULT FALSE
);

-- Insert Golf Courses Data
INSERT INTO golf_courses (
    course_id, course_name, location, par, holes, green_fee, difficulty_level, 
    description, facilities, phone, email, website, rating, total_reviews,
    instructor, instructor_experience, established, dress_code, operating_hours, 
    special_features, max_capacity
) VALUES
  ('C001', 'Royal Golf Club', 'Bangkok, Thailand', 72, 18, 2500.00, 'Intermediate', 
   'Championship course with stunning city views and world-class facilities',
   ARRAY['Driving Range', 'Pro Shop', 'Restaurant', 'Spa', 'Caddy Service'], 
   '+66-2-123-4567', 'info@royalgolf.com', 'www.royalgolfclub.com', 4.5, 127,
   'Master Pro Somsak Tangsiri', '15 years PGA certified', 2010, 'Strict golf attire required', '06:00 - 18:00',
   ARRAY['Night lighting on 9 holes', 'GPS-enabled golf carts', 'VIP lounge'], 20),
  
  ('C002', 'Alpine Golf Resort', 'Khao Yai, Thailand', 71, 18, 1800.00, 'Beginner', 
   'Mountain resort course perfect for beginners with breathtaking nature views',
   ARRAY['Driving Range', 'Pro Shop', 'Restaurant', 'Golf Cart Rental', 'Putting Green'], 
   '+66-44-567-8901', 'booking@alpinegolf.com', 'www.alpinegolfresort.com', 4.2, 89,
   'Pro Jennifer Wong', '8 years teaching experience', 2015, 'Smart casual golf wear', '07:00 - 17:00',
   ARRAY['Mountain views', 'Resort accommodation', 'Beginner-friendly layout'], 25),
  
  ('C003', 'Gassan Marina Golf Club', 'Chonburi, Thailand', 72, 18, 3200.00, 'Advanced', 
   'Championship-level course hosting international tournaments',
   ARRAY['Championship Driving Range', 'Pro Shop', 'Fine Dining', 'Locker Room', 'Practice Greens', 'Caddy Service', 'Clubhouse'], 
   '+66-38-234-5678', 'reservations@gassanmarina.com', 'www.gassanmarinagolf.com', 4.8, 203,
   'Master Pro Hiroshi Tanaka', '20+ years, former tour player', 2008, 'Formal golf attire mandatory', '05:30 - 18:30',
   ARRAY['Tournament-grade facilities', 'Marina views', 'Professional coaching academy'], 15),
  
  ('C004', 'Panya Indra Golf Club', 'Pathum Thani, Thailand', 72, 18, 1500.00, 'Beginner', 
   'Family-friendly course with wide fairways and affordable rates',
   ARRAY['Driving Range', 'Pro Shop', 'Cafe', 'Golf Lessons', 'Equipment Rental'], 
   '+66-2-987-6543', 'info@panyaindra.com', 'www.panyaindragolf.com', 4.0, 56,
   'Pro Sarah Johnson', '6 years specializing in beginners', 2018, 'Casual golf attire', '06:30 - 18:00',
   ARRAY['Family packages', 'Junior golf programs', 'Equipment rental available'], 30);

-- Insert Sample Members
INSERT INTO members (member_id, first_name, last_name, email, phone, handicap, membership_type, total_rounds, favorite_course) VALUES
  ('M001', 'Somchai', 'Boonmee', 'somchai@email.com', '+66-81-234-5678', 15.2, 'Premium', 45, 'C001'),
  ('M002', 'Jennifer', 'Wong', 'jen.wong@email.com', '+66-82-345-6789', 8.5, 'VIP', 127, 'C003'),
  ('M003', 'Hiroshi', 'Tanaka', 'hiroshi.t@email.com', '+66-83-456-7890', 22.1, 'Regular', 23, 'C002'),
  ('M004', 'Sarah', 'Johnson', 'sarah.j@email.com', '+66-84-567-8901', 12.7, 'Premium', 78, 'C004');

-- Insert Sample Course Enrollments
INSERT INTO course_enrollments (enrollment_id, course_id, member_id, course_date, course_time, status, notes) VALUES
  ('E001', 'C001', 'M001', CURRENT_DATE + INTERVAL '1 day', '08:00', 'Enrolled', 'First time student'),
  ('E002', 'C001', 'M002', CURRENT_DATE + INTERVAL '1 day', '08:00', 'Enrolled', 'VIP member priority'),
  ('E003', 'C001', 'M003', CURRENT_DATE + INTERVAL '1 day', '08:00', 'Enrolled', NULL),
  ('E004', 'C002', 'M003', CURRENT_DATE + INTERVAL '2 days', '09:00', 'Enrolled', 'Beginner level requested'),
  ('E005', 'C002', 'M004', CURRENT_DATE + INTERVAL '2 days', '09:00', 'Enrolled', 'Regular student'),
  ('E006', 'C003', 'M002', CURRENT_DATE + INTERVAL '3 days', '10:00', 'Enrolled', 'Advanced course'),
  ('E007', 'C004', 'M001', CURRENT_DATE + INTERVAL '1 day', '14:00', 'Enrolled', 'Family package'),
  ('E008', 'C004', 'M004', CURRENT_DATE + INTERVAL '1 day', '14:00', 'Enrolled', 'Equipment rental needed');

-- Insert Sample Golf Bookings (for actual golf playing)
INSERT INTO bookings (booking_id, member_id, course_id, booking_date, tee_time, players_count, total_amount, status, special_requests) VALUES
  ('B001', 'M001', 'C001', CURRENT_DATE, '08:30', 4, 10000.00, 'Confirmed', 'Golf cart requested'),
  ('B002', 'M002', 'C003', CURRENT_DATE, '14:00', 2, 6400.00, 'Confirmed', NULL),
  ('B003', 'M003', 'C002', CURRENT_DATE + INTERVAL '1 day', '09:00', 1, 1800.00, 'Pending', 'Caddy service needed'),
  ('B004', 'M004', 'C004', CURRENT_DATE + INTERVAL '2 days', '10:00', 1, 1500.00, 'Confirmed', 'Beginner lesson requested');

-- Insert Course Reviews
INSERT INTO course_reviews (course_id, member_id, rating, comment) VALUES
  ('C001', 'M001', 5, 'Absolutely stunning course! Perfect maintenance and challenging layout.'),
  ('C001', 'M003', 4, 'Great course but can be quite crowded on weekends.'),
  ('C002', 'M002', 5, 'Beautiful mountain views and excellent service.'),
  ('C003', 'M001', 5, 'Professional tournament quality. Worth every baht!'),
  ('C004', 'M004', 4, 'Perfect for beginners like me. Staff was very helpful.');

-- Insert Standard Tee Times
INSERT INTO tee_times (course_id, time_slot, max_players, is_premium) VALUES
  ('C001', '06:30', 4, TRUE), ('C001', '07:00', 4, TRUE), ('C001', '07:30', 4, FALSE),
  ('C001', '08:00', 4, FALSE), ('C001', '08:30', 4, FALSE), ('C001', '09:00', 4, FALSE),
  ('C001', '14:00', 4, FALSE), ('C001', '14:30', 4, FALSE), ('C001', '15:00', 4, TRUE),
  
  ('C002', '07:00', 4, FALSE), ('C002', '07:30', 4, FALSE), ('C002', '08:00', 4, FALSE),
  ('C002', '14:30', 4, FALSE), ('C002', '15:00', 4, FALSE), ('C002', '15:30', 4, FALSE),
  
  ('C003', '06:00', 4, TRUE), ('C003', '06:30', 4, TRUE), ('C003', '07:00', 4, FALSE),
  ('C003', '13:30', 4, FALSE), ('C003', '14:00', 4, FALSE), ('C003', '16:00', 4, TRUE),
  
  ('C004', '08:00', 4, FALSE), ('C004', '08:30', 4, FALSE), ('C004', '09:00', 4, FALSE),
  ('C004', '14:00', 4, FALSE), ('C004', '14:30', 4, FALSE), ('C004', '15:00', 4, FALSE);

-- Create Views for Easy Data Access
CREATE OR REPLACE VIEW course_enrollment_summary AS
SELECT 
    gc.course_id,
    gc.course_name,
    gc.instructor,
    gc.max_capacity,
    COUNT(ce.enrollment_id) as total_enrollments,
    gc.max_capacity - COUNT(ce.enrollment_id) as available_spots
FROM golf_courses gc
LEFT JOIN course_enrollments ce ON gc.course_id = ce.course_id AND ce.status = 'Enrolled'
GROUP BY gc.course_id, gc.course_name, gc.instructor, gc.max_capacity;

CREATE OR REPLACE VIEW daily_course_schedule AS
SELECT 
    ce.course_date,
    ce.course_time,
    gc.course_name,
    gc.instructor,
    COUNT(ce.enrollment_id) as enrolled_students,
    gc.max_capacity,
    STRING_AGG(m.first_name || ' ' || m.last_name, ', ') as student_names
FROM course_enrollments ce
JOIN golf_courses gc ON ce.course_id = gc.course_id
JOIN members m ON ce.member_id = m.member_id
WHERE ce.status = 'Enrolled'
GROUP BY ce.course_date, ce.course_time, gc.course_name, gc.instructor, gc.max_capacity
ORDER BY ce.course_date, ce.course_time;

-- Create Function for Checking Course Availability
CREATE OR REPLACE FUNCTION get_course_availability(p_course_id TEXT, p_course_date DATE, p_course_time TIME)
RETURNS TABLE(available_spots INT, enrolled_count INT, max_capacity INT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gc.max_capacity - COALESCE(enrolled.count, 0) as available_spots,
        COALESCE(enrolled.count, 0)::INT as enrolled_count,
        gc.max_capacity
    FROM golf_courses gc
    LEFT JOIN (
        SELECT course_id, COUNT(*)::INT as count
        FROM course_enrollments 
        WHERE course_id = p_course_id 
          AND course_date = p_course_date 
          AND course_time = p_course_time 
          AND status = 'Enrolled'
        GROUP BY course_id
    ) enrolled ON gc.course_id = enrolled.course_id
    WHERE gc.course_id = p_course_id;
END;
$$ LANGUAGE plpgsql;

-- Create Indexes for Better Performance
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course_date ON course_enrollments(course_id, course_date, course_time);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_member ON course_enrollments(member_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_status ON course_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_bookings_date_course ON bookings(booking_date, course_id);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_reviews_course ON course_reviews(course_id);
CREATE INDEX IF NOT EXISTS idx_tee_times_course ON tee_times(course_id);
CREATE INDEX IF NOT EXISTS idx_courses_difficulty ON golf_courses(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_members_type ON members(membership_type);