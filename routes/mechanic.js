const express = require('express');
const router = express.Router();

router.get('/mechanic', (req, res) => {
    res.render('mechanic');
});

router.post('/mechanic', (req, res) => {
    //console.log('=== DEBUGGING REQUEST BODY ===');
    //console.log('Full req.body:', req.body);
    //console.log('Type of req.body:', typeof req.body);
    //console.log('Keys in req.body:', Object.keys(req.body));
    //console.log('===============================');

    let roNum = req.body.roNum; 
    let roDate = req.body.roDate;
    let technician = req.body.technician;
    let timeArrive = req.body.timeIn;
    let timeOut = req.body.timeOut;
    let totTime = req.body.totTime;
    //add rest later
    console.log('RO Number:', roNum);
    console.log('Date:', roDate);
    console.log('Technician:', technician);
    console.log('Time In:', timeArrive);
    console.log('Time Out:', timeOut);
    console.log('Total Time:', totTime);

});

module.exports = router;
