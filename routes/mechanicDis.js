const express = require('express');
const router = express.Router();    

router.get('/mechanicDis', (req, res) => {
    res.render('mechanicDis');
});


router.post('/mechanicDis', (req, res) => {
});

module.exports = router;