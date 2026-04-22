const express = require('express');
const router = express.Router();
router.get('/mechanicEdit', (req, res) => {
    const userCookie = req.cookies.user;
    if (userCookie) {
        res.render('mechanicEdit');} 
    else {
        res.redirect('/login');
        }
});

// return list of incomplete tickets as JSON
router.get('/mechanic/incomplete', (req, res) => {
    const db = req.app.locals.db;
    if (!db) return res.status(500).json({ error: 'Database not available' });
    const sql = `SELECT id, date, techName, customerName, stat FROM tickets WHERE stat IS NULL OR stat != 'complete' ORDER BY id DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Failed to fetch incomplete tickets', err);
            return res.status(500).json({ error: 'Failed to fetch tickets' });
        }
        res.json(rows || []);
    });
});

module.exports = router;