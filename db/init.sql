-- Create students table and seed a few rows
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    major TEXT NOT NULL,
    year INT NOT NULL CHECK (year >= 1 AND year <= 5)
);

INSERT INTO students (id, name, major, year) VALUES
  ('650001', 'Anong Srisuk', 'Computer Science', 2),
  ('650002', 'Meta Chat', 'Software Engineering', 3),
  ('650003', 'Somchai Boonmee', 'Information Systems', 1),
  ('66011098', 'Nuththapat Chaloemlarpsombut', 'Software Engineering', 3)
ON CONFLICT (id) DO NOTHING;
