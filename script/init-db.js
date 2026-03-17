const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const sql = fs.readFileSync('./db/init.sql', 'utf-8');
const initDatabase = new sqlite3.Database('./db/initDatabase.db');
initDatabase.exec(sql, (err) => {
  if (err) {
    console.error('Error initializing database:', err.message);
  } else {
    console.log('Database initialized successfully.');
  }
  db.close();
});