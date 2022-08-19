CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY, 
  first_name TEXT, 
  last_name TEXT, 
  username TEXT, 
  password TEXT, 
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lists (
  list_id SERIAL PRIMARY KEY, 
  list_name TEXT, 
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS list_users (
  id SERIAL PRIMARY KEY, 
  list_id INT, 
  user_id INT
);

CREATE TABLE IF NOT EXISTS categories (
  category_id SERIAL PRIMARY KEY, 
  category_name TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  task_id SERIAL PRIMARY KEY, 
  user_id INT, 
  list_id INT, 
  category_id INT, 
  task TEXT, 
  task_date TEXT, 
  task_state BOOLEAN, 
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO categories (category_name) VALUES ('white'), ('red'), ('orange'), ('yellow'), ('green'), ('blue');