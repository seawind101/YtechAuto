const express = require('express');
const router = express.Router();

router.get('/mechanic', (req, res) => {
    res.render('mechanic');
});

router.post('/mechanic', (req, res) => {
});

module.exports = router;
