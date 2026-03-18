const express = require('express');
const router = express.Router();    
router.get('/mechanicDis', (req, res) => {
    res.render('mechanicDis');
});

module.exports = router;