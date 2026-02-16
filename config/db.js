const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");
const { SCHEMAS } = require("./schemas");

class DB {
  constructor(dbPath) {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("Database connection error:", err.message);
      } else {
        console.log("✅ Database successfully connected");
      }
    });

    this.init();
  }

  // Wrap db.run in a Promise
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this); // 'this' contains useful info like lastID, changes
      });
    });
  }

  // Wrap db.get in a Promise
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  // Wrap db.all in a Promise
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  // Initialize table
  async init() {
    try {
      for (const { name, sql } of SCHEMAS) {
        await this.run(sql);
        console.log(`📄 Table "${name}" created successfully`);
      }

      //Handle migration for existing data
      await this.migrateExistingData();

      console.log("✅ All tables initialized");
    } catch (err) {
      console.error("❌ Table creation error:", err.message);
    }
  }

  // Migration for existing data
  async migrateExistingData() {
    try {
      const tableInfo = await this.all("PRAGMA table_info(tasks)");

      const migrations = [
        {
          column: "email_account_id",
          sql: "ALTER TABLE tasks ADD COLUMN email_account_id INTEGER REFERENCES email_accounts(id)",
        },
        {
          column: "email_check_timeout",
          sql: "ALTER TABLE tasks ADD COLUMN email_check_timeout INTEGER DEFAULT 30",
        },
      ];

      for (const migration of migrations) {
        const columnExists = tableInfo.some(
          (col) => col.name === migration.column,
        );

        if (!columnExists) {
          console.log(`🔄 Adding ${migration.column} column to tasks table...`);
          await this.run(migration.sql);
          console.log(`✅ Added ${migration.column} column`);
        }
      }

      console.log("✅ Migration check complete");
    } catch (err) {
      console.error("❌ Migration error:", err.message);
    }
  }
}

// Ensure data directory exists
const dbPath = process.env.DB_PATH || path.resolve(__dirname, "../app.db");

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create empty DB file if not exists
if (!fs.existsSync(dbPath)) {
  fs.closeSync(fs.openSync(dbPath, "w"));
}

// Export a singleton instance
const database = new DB(dbPath);

module.exports = database;
