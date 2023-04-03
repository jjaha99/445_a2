const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const mysql = require('mysql');
const { promisify } = require('util');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'upload/' });

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
  ffmpeg(inputFile)
    .outputOptions([`-segment_time ${duration}`, `-f segment`, `-reset_timestamps 1`])
    .output(`${outputPrefix}%03d.mp4`)
    .on('end', () => {
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

  segmentVideo(inputFile, outputPrefix, 3, async (err) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error processing video');
    } else {
      // Save metadata to MySQL database and send a response
      const filename = req.file.originalname;
      const size = req.file.size;
      const duration = await getVideoDuration(`${outputPrefix}001.mp4`);
      const sql = 'INSERT INTO videos (filename, size, duration, upload_time) VALUES (?, ?, ?, NOW())';
      connection.query(sql, [filename, size, duration], (error) => {
        if (error) {
          console.error(error);
          res.status(500).send('Error saving metadata');
        } else {
          res.status(200).send('Video uploaded and segmented successfully');
        }
      });
    }
  });
});

// Route for getting video list
app.get('/videos', (req, res) => {
  const sql = 'SELECT * FROM videos ORDER BY upload_time DESC';
  connection.query(sql, (error, results) => {
    if (error) {
      console.error(error);
      res.status(500).send('Error retrieving video list');
    } else {
      const videos = results.map((row) => {
        return {
          id: row.id,
          filename: row.filename,
          size: row.size,
          duration: row.duration,
          uploadTime: row.upload_time,
        };
      });
      res.json(videos);
    }
  });
});

// Route for getting video segments
app.get('/segments/:id', async (req, res) => {
  const videoId = req.params.id;
  const sql = 'SELECT filename FROM videos WHERE id = ?';
  connection.query(sql, [videoId], async (error, results) => {
    if (error || results.length === 0) {
      console.error(error);
      res.status(404).send('Video not found');
      return;
    }
    const filename = results[0].filename;
    const segments = await getVideoSegments(`public/uploads
