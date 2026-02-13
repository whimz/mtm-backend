const SCHEMAS = [
  {
    name: "users",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    name: "projects",
    sql: `
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        user_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `,
  },
  {
    name: "email_accounts",
    sql: `
      CREATE TABLE IF NOT EXISTS email_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        email_address TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        access_token TEXT,
        is_active INTEGER DEFAULT 1,
        connected_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, email_address)
      );
    `,
  },
  {
    name: "tasks",
    sql: `
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        url TEXT NOT NULL,
        inputs TEXT,
        schedule_type TEXT,
        launch_time TEXT,
        cron_expression TEXT,
        project_id INTEGER NOT NULL,
        email_account_id INTEGER,
        email_check_timeout INTEGER DEFAULT 30,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'PENDING',
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (email_account_id) REFERENCES email_accounts(id) ON DELETE SET NULL
      );
    `,
  },
  {
    name: "email_check_results",
    sql: `
      CREATE TABLE IF NOT EXISTS email_check_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        email_account_id INTEGER NOT NULL,
        email_received INTEGER DEFAULT 0,
        gmail_message_id TEXT,
        checked_at TEXT DEFAULT CURRENT_TIMESTAMP,
        error_message TEXT,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (email_account_id) REFERENCES email_accounts(id) ON DELETE CASCADE
      );
    `,
  },
]

module.exports = { SCHEMAS }
