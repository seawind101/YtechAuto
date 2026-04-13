const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
   const userCookie = req.cookies.user;
    if (userCookie) {
        res.render('index');} 
    else {
        res.redirect('/login');
        }
});

module.exports = router;
