const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const uploadDir = path.join(__dirname, 'uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, unique + ext);
    }
});

const upload = multer({ storage });

app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { originalname, mimetype, size } = req.file;
    const relativePath = path.relative(uploadDir, req.file.path);

    const db = new sqlite3.Database('./database/database.sqlite', (err) => {
        if (err) {
            console.error('Could not connect to database', err);
            return res.status(500).json({ error: 'Database error' });
        }
    });

    db.run(`INSERT INTO pictures (ticketID, filePath, originalName, relativePath, mimeType, sizeBytes, uploadDate)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.body.ticketID, req.file.path, originalname, relativePath, mimetype, size, new Date().toISOString()],
        function (err) {
            if (err) {
                console.error('Could not insert file info into database', err);
                return res.status(500).json({ error: 'Database error' });
            }
            res.status(200).json({ message: 'File uploaded successfully', file: req.file });
        });
});   