const express = require('express');
const router = express.Router();

router.get('/customer', (req, res) => {
    res.render('customer');
});

router.post('/customer', (req, res) => {
});

module.exports = router;
