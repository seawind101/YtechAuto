const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'upload/videos/') // Make sure this directory exists
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB limit
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed!'));
        }
    }
});

router.get('/mechanic', (req, res) => {
    const userCookie = req.cookies.user;
    if (userCookie) {
        res.render('mechanic');} 
    else {
        res.redirect('/login');
        }
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
    let custName = req.body.custName;
    let custAdd = req.body.custAddress;
    let custPhone = req.body.custPhone;
    let custEmail = req.body.custEmail;
    let concern = req.body.concern;
    let diagnosis = req.body.diagnosis;
    let sDate = req.body.sDate;
    let signature = req.body.signature;

    const db = req.app.locals.db;
    if (!db) {
        console.error('Database not available on app.locals.db');
        return res.status(500).send('Database not available');
    }

    // parse repairs JSON if provided
    let repairs = [];
    try {
        if (req.body.repairs) repairs = JSON.parse(req.body.repairs);
    } catch (err) {
        console.warn('Invalid repairs JSON, ignoring', err);
        repairs = [];
    }

    // store recommendedRepairs as JSON summary in tickets.recommendedRepairs
    const recommendedRepairsText = JSON.stringify(repairs || []);

    const insertTicketSql = `INSERT INTO tickets (date, techName, timeIn, timeOut, totalTime, customerName, customerAddress, customerPhone, customerEmail, concern, diagnosis, recommendedRepairs, dateSigned) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const ticketParams = [roDate, technician, timeArrive, timeOut, totTime, custName, custAdd, custPhone, custEmail, concern, diagnosis, recommendedRepairsText, sDate];

    db.run(insertTicketSql, ticketParams, function(err) {
        if (err) {
            console.error('Failed to insert ticket:', err);
            return res.status(500).send('Failed to save ticket');
        }

        const ticketId = this.lastID;
        console.log('Inserted ticket id', ticketId);

        if (!repairs || repairs.length === 0) {
            return res.redirect('/mechanic');
        }

        // insert each recommended repair into recRepairs table
        const insertRecSql = `INSERT INTO recRepairs (ticketId, repairDescription, qty, partNumber, partPrice, partsTotal, laborHours, laborTotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const stmt = db.prepare(insertRecSql);
        repairs.forEach(r => {
            const desc = r.repairDescription || '';
            const qty = Number.isFinite(Number(r.qty)) ? parseInt(r.qty) : (r.qty ? parseInt(r.qty) : 0);
            const partNumber = r.partNumber || '';
            const partPrice = Number.isFinite(Number(r.partPrice)) ? parseFloat(r.partPrice) : (r.partPrice ? parseFloat(r.partPrice) : 0);
            const partsTotal = Number.isFinite(Number(r.partsTotal)) ? parseFloat(r.partsTotal) : (r.partsTotal ? parseFloat(r.partsTotal) : (qty * partPrice));
            const laborHours = Number.isFinite(Number(r.laborHours)) ? parseFloat(r.laborHours) : (r.laborHours ? parseFloat(r.laborHours) : 0);
            const laborTotal = Number.isFinite(Number(r.laborTotal)) ? parseFloat(r.laborTotal) : (r.laborTotal ? parseFloat(r.laborTotal) : (laborHours * 100));

            stmt.run([ticketId, desc, qty, partNumber, partPrice, partsTotal, laborHours, laborTotal], (err) => {
                if (err) console.error('Failed to insert recRepair row:', err);
            });
        });
        stmt.finalize((err) => {
            if (err) console.error('Failed finalizing recRepairs stmt:', err);
            return res.redirect('/mechanic');
        });
    });
});


router.post('/upload-video', upload.single('video'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        
        console.log('Video uploaded successfully:', req.file.filename);
        console.log('File size:', req.file.size, 'bytes');
        console.log('Original name:', req.file.originalname);
        
        res.json({ 
            success: true, 
            message: 'Video uploaded successfully',
            filename: req.file.filename,
            originalName: req.file.originalname
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, message: 'Upload failed' });
    }
});

module.exports = router;
