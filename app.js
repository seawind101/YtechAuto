//importer
require('dotenv').config();
const express = require('express');
const app = express();  
const jwt = require('jsonwebtoken');
const session = require('express-session');
const multer = require('multer');
const PORT=process.env.PORT || 3000;
const http = require('http');
const server = require('http').createServer(app);

//middelware
app.set('view engine', 'ejs');

//imports


//index route
app.get('/', (req, res) => {
  res.render('index');
});

//customer route
app.get('/customer', (req, res) => {
  res.render('customer');
});
app.post('/customer', (req, res) => {
});
//mechanic route
app.get('/mechanic', (req, res) => {
  res.render('mechanic');
});
app.post('/mechanic', (req, res) => {
});
//customer display
app.get('/customerDis', (req, res) => {
  res.render('customerDis');
});
app.post('/customerDis', (req, res) => {
});
//mechanic display
app.get('/mechanicDis', (req, res) => {
  res.render('mechanicDis');
});
app.post('/mechanicDis', (req, res) => {
});
//start server
server.listen(PORT, () => {
    console.log(`Example app listening on port http://localhost:${PORT}`);
});