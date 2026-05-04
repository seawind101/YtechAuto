const express = require('express');
const router = express.Router();    

// middleware to ensure admin access; if not admin redirect to home
function ensureAdmin(req, res, next) {
  const sess = req && req.session && req.session.user;
  if (sess && sess.stat && String(sess.stat).toLowerCase() === 'admin') return next();

  // fallback: try cookie->db lookup
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

router.get('/mechanicDis', ensureAdmin, (req, res) => {
  return res.render('mechanicDis');
});

router.post('/mechanicDis', ensureAdmin, (req, res) => {
  return res.sendStatus(204);
});

module.exports = router;