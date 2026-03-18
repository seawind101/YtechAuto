const express = require('express');
const router = express.Router();
   
router.get('/customerDis', (req, res) => {
    res.render('customerDis');
});


router.post('/customerDis', (req, res) => {
});

module.exports = router;