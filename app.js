//importer
require('dotenv').config();
const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const session = require('express-session');
const multer = require('multer');
const PORT = process.env.PORT || 3000;
const http = require('http');
const server = require('http').createServer(app);
//middelware
app.set('view engine', 'ejs');

const db = new sqlite3.Database('database/database.sql', (err) => {
    if (err) return console.error('Error connecting to database:', err.message);
});

app.get('/', (req, res) => {
    res.render('index');
});
server.listen(PORT, () => {
    console.log(`Example app listening on port http://localhost:${PORT}`);
});
