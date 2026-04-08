const express = require('express');
const router = express.Router();
router.get('/mechanicEdit', (req, res) => {
    res.render('mechanicEdit');
});
// GET /mechanic/edit/:id - Render edit form for a specific ticket
//router.get('/mechanic/edit/:id', (req, res) => {
   // const db = req.app.locals.db;
   // const ticketId = req.params.id;

    // Fetch ticket details from the database
   // db.get('SELECT * FROM tickets WHERE id = ?', [ticketId], (err, ticket) => {
    //    if (err) {
     //       console.error('Error fetching ticket:', err);
     //       return res.status(500).send('Internal Server Error');
     //   }
      //  if (!ticket) {
      //      return res.status(404).send('Ticket not found');
       // }
        // Render the edit form with the ticket details
        //res.render('mechanicEdit', { ticket });
    //});
//});

// POST /mechanic/edit/:id - Handle form submission
//router.post('/mechanic/edit/:id', (req, res) => {
    //const db = req.app.locals.db;
   // const ticketId = req.params.id;
   // const { status, description } = req.body;

    // Update the ticket in the database
   // db.run('UPDATE tickets SET status = ?, description = ? WHERE id = ?', [status, description, ticketId], (err) => {
      //  if (err) {
      //      console.error('Error updating ticket:', err);
      //      return res.status(500).send('Internal Server Error');
      //  }
       // res.redirect(`/mechanic/ticket/${ticketId}`);
    //});
//});

module.exports = router;