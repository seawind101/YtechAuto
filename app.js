//importer
require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const multer = require('multer');
const PORT = process.env.PORT || 3000;
const http = require('http');
const server = require('http').createServer(app);
const sqlite3 = require('sqlite3');
const fs = require('fs');
//middelware
app.set('view engine', 'ejs');
app.use(express.static('public'))
app.set('views', path.join(__dirname, 'public', 'views'));


server.listen(PORT, () => {
    console.log(`Example app listening on port http://localhost:${PORT}`);
});
