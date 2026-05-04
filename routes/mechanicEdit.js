const express = require('express');
const router = express.Router();

function ensureAdmin(req, res, next) {
    const sess = req && req.session && req.session.user;
    if (sess && sess.stat && String(sess.stat).toLowerCase() === 'admin') return next();
    const userCookie = req.cookies && req.cookies.user;
    if (!userCookie) return res.redirect('/login');
    let parsed = null;
    try { parsed = JSON.parse(userCookie); } catch (e) { return res.redirect('/login'); }
    const db = req.app.locals.db;
    if (!db) return res.redirect('/');
    db.get('SELECT stat FROM users WHERE email = ? LIMIT 1', [parsed.email], (err, row) => {
        if (err) { console.error('DB error checking admin:', err); return res.redirect('/'); }
        const stat = row && row.stat ? String(row.stat).toLowerCase() : '';
        if (stat === 'admin') return next();
        return res.redirect('/');
    });
}

router.get('/mechanicEdit', ensureAdmin, (req, res) => {
    return res.render('mechanicEdit');
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

router.post('/mechanic/completeTicket', (req, res) => {
    const db = req.app.locals.db;
    if (!db) return res.status(500).json({ error: 'Database not available' });
    const { ticketId } = req.body;
    const sql = `UPDATE tickets SET stat = 'complete' WHERE id = ?`;
    db.run(sql, [ticketId], function(err) {
        if (err) {
            console.error('Failed to complete ticket', err);
            return res.status(500).json({ error: 'Failed to complete ticket' });
        }
        return res.sendStatus(204);
    });
});
module.exports = router;