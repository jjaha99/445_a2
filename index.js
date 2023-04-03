const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const mysql = require('mysql');
const path = require('path');

const app = express();
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

const port = 3000;

app.use(express.static('public'));
app.use(express.static('public', { extensions: ['html', 'css', 'js'] }));

// MySQL connection
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'my_user', // Replace with your MySQL username
  password: 'my_password', // Replace with your MySQL password
  database: 'my_video_streaming', // Replace with your MySQL database name
});

connection.connect();

// Helper function to segment video
function segmentVideo(inputFile, outputPrefix, duration, callback) {
    console.log(`Segmenting video: ${inputFile}`);
    ffmpeg(inputFile)
      .outputOptions([
        '-c copy', // Copies the input codec to the output
        '-map 0', // Maps all input streams to the output
        '-f segment', // Sets the output format to 'segment'
        `-segment_time ${duration}`, // Sets the segment duration
        '-reset_timestamps 1', // Resets timestamps for each segment
      ])
      .output(`${outputPrefix}%03d.mp4`)
      .on('end', () => {
        console.log('Finished segmenting video');
        callback();
      })
      .on('error', (err) => {
        console.error(err);
        callback(err);
      })
      .run();
  }
  

// Route for handling video uploads
app.post('/upload', upload.single('video_chunk'), (req, res) => {
  const inputFile = req.file.path;
  const outputPrefix = 'public/uploads/segment_';
  const duration = 10; // Segment duration in seconds

  segmentVideo(inputFile, outputPrefix, duration, (err) => {
    if (err) {
      console.error('Error segmenting video:', err);
      res.status(500).send('Error segmenting video');
    } else {
      res.status(200).send('Video uploaded and segmented');
    }
  });
});

// Route for getting video list
app.get('/videos', (req, res) => {
  const sql = 'SELECT * FROM videos';
  connection.query(sql, (error, results) => {
    if (error) {
      res.status(500).send('Error retrieving video list');
    } else {
      res.json(results);
    }
  });
});

// Route for serving video segments
app.get('/uploads/:filename', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/uploads', req.params.filename));
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
