const express = require('express');
const router = express.Router();

// middleware: only allow admins to access ticket routes
function ensureAdmin(req, res, next) {
    let role = '';
    if (req && req.session && req.session.user && req.session.user.stat) {
        role = String(req.session.user.stat).toLowerCase();
    } else if (req && req.cookies && req.cookies.user) {
        try {
            const c = JSON.parse(req.cookies.user);
            if (c && c.stat) role = String(c.stat).toLowerCase();
        } catch (e) { /* ignore */ }
    }
    if (role === 'admin') return next();
    return res.redirect('/');
}

router.get('/ticket', ensureAdmin, (req, res) => {
    const userCookie = req.cookies.user;
    if (!userCookie) return res.redirect('/login');

    const db = req.app.locals.db;
    if (!db) return res.status(500).send('Database not available');

    db.all("SELECT id, repairOrderNumber, date AS roDate, customerName, stat FROM tickets WHERE stat = ? ORDER BY date DESC", ['complete'], (err, rows) => {
        if (err) {
            console.error('Error fetching completed tickets:', err);
            return res.status(500).send('Internal Server Error');
        }
        return res.render('ticket', { tickets: rows });
    });
});

module.exports = router;
