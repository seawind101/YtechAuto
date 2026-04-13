const express = require('express');
const router = express.Router();

router.get('/customer', (req, res) => {
    const userCookie = req.cookies.user;
    if (userCookie) {
        res.render('customer');} 
    else {
        res.redirect('/login');
        }
});

router.post('/customer', (req, res) => {
});

module.exports = router;
