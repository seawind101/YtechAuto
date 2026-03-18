const express = require('express');
const router = express.Router();

router.get('/mechanic', (req, res) => {
    res.render('mechanic');
});

module.exports = router;
