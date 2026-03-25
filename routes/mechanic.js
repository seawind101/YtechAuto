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
    let custName = req.body.custName;
    let custAdd = req.body.custAddress;
    let custPhone = req.body.custPhone;
    let custEmail = req.body.custEmail;
    let concern = req.body.concern;
    let diagnosis = req.body.diagnosis;
    let sDate = req.body.sDate;
    let signature = req.body.signature;
   
    console.log('RO Number:', roNum);
    console.log('Date:', roDate);
    console.log('Technician:', technician);
    console.log('Time In:', timeArrive);
    console.log('Time Out:', timeOut);
    console.log('Total Time:', totTime);
    console.log('Customer Name:', custName);
    console.log('Customer Address:', custAdd);
    console.log('Customer Phone:', custPhone);
    console.log('Customer Email:', custEmail);
    console.log('Concern:', concern);
    console.log('Diagnosis:', diagnosis);
    console.log('Signature Date:', sDate);
    res.redirect('/mechanic');
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
