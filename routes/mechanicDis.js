const express = require('express');
const router = express.Router();    

router.get('/mechanicDis', (req, res) => {
  const userCookie = req.cookies.user;
    if (userCookie) {
        res.render('mechanicDis');} 
    else {
        res.redirect('/login');
        }
});


router.post('/mechanicDis', (req, res) => {
});

module.exports = router;