const express = require('express');
const router = express.Router();

router.get('/customer', (req, res) => {
    res.render('customer');
});

module.exports = router;
