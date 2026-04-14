const express = require('express');
const router = express.Router();
   
router.get('/customerDis', (req, res) => {
   const userCookie = req.cookies.user;
    if (userCookie) {
        res.render('customerDis');} 
    else {
        res.redirect('/login');
        }
});


router.post('/customerDis', (req, res) => {
});

module.exports = router;