//importer
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();
const path = require('path');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const multer = require('multer');
const PORT = process.env.PORT || 3000;
const http = require('http');
const server = require('http').createServer(app);
const sqlite3 = require('sqlite3').verbose();

const fs = require('fs');

const db = new sqlite3.Database('./database/database.sqlite', (err) => {
    if (err) {
        console.error('Could not connect to database', err);
    } else {
        console.log('Connected to database');
    }
});

// Make database available to other modules
app.locals.db = db;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//Middleware
app.use(cookieParser());
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SECRET || 'defaultsecretkey',
    resave: false,
    saveUninitialized: true
}));

//Routes
const indexRouter = require('./routes/index');
const mechanicRouter = require('./routes/mechanic');
const customerRouter = require('./routes/customer');
const customerDisRouter = require('./routes/customerDis');
const mechanicDisRouter = require('./routes/mechanicDis');
const mechanicEditRouter = require('./routes/mechanicEdit');
const ticketRoute = require('./routes/ticket');
const authRouter = require('./routes/auth');



app.use('/', indexRouter);
app.use('/', mechanicRouter);
app.use('/', customerRouter);
app.use('/', customerDisRouter);
app.use('/', authRouter);
app.use('/', mechanicDisRouter);
app.use('/', mechanicEditRouter);
app.use('/', ticketRoute);
                                    

server.listen(PORT, () => {
    console.log(`Example app listening on port http://localhost:${PORT}`);
});

module.exports = app;