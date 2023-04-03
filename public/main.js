let videoEncoder;
let frameNumber = 0;
let isUploading = false;
const videoElement = document.getElementById('camera-preview');
const startUploadButton = document.getElementById('start-upload');
const videoListElement = document.getElementById('video-list');

async function startCamera() {
  console.log('Attempting to start the camera...');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
    videoElement.srcObject = stream;
    videoElement.onloadedmetadata = () => {
      initVideoEncoder();
    };
  } catch (error) {
    console.error('Error starting camera:', error);
  }
}

async function initVideoEncoder() {
  if (!('VideoEncoder' in window)) {
    alert('WebCodecs API not supported in your browser');
    return;
  }

  videoEncoder = new VideoEncoder({
    output: async (chunk, metadata) => {
      if (isUploading) {
        await uploadVideoChunk(chunk, frameNumber++);
      }
    },
    error: (error) => {
      console.error('VideoEncoder error:', error);
    },
  });

  videoEncoder.configure({
    codec: 'vp8',
    width: 1280,
    height: 720,
    bitrate: 5_000_000,
    framerate: 30,
  });

  startEncoding();
}

function startEncoding() {
  if (!videoEncoder) {
    console.error('Video encoder not initialized');
    return;
  }

  requestAnimationFrame(encodeFrame);
}

async function encodeFrame() {
  const videoFrame = await createVideoFrame(videoElement);
  videoEncoder.encode(videoFrame);
  videoFrame.close();

  if (isUploading) {
    requestAnimationFrame(encodeFrame);
  }
}

startUploadButton.addEventListener('click', async () => {
    if (!isUploading) {
      if (!videoElement.srcObject) {
        await startCamera();
      }
    
      await initVideoEncoder(); // Initialize the video encoder before starting the upload
      startEncoding();
    } else {
      videoEncoder.flush();
      getVideoListAndUpdate(); // Update the video list after stopping the upload
    }
    
    isUploading = !isUploading;
    startUploadButton.textContent = isUploading ? 'Stop Upload' : 'Start Upload';
  });
  

async function createVideoFrame(videoElement) {
    const track = videoElement.captureStream().getVideoTracks()[0];
    if (!track || !track.readyState === 'live') {
      console.error('Video track is not ready');
      return null;
    }
  
    const bitmap = await createImageBitmap(track);
    const frame = new VideoFrame(bitmap, { timestamp: performance.now() });
    return frame;
  }
  
  async function encodeFrame() {
    if (!videoElement.srcObject || !videoElement.srcObject.active) {
      console.warn('Video stream ended or not available');
      return;
    }
    
    try {
      const videoFrame = await createVideoFrame(videoElement);
      videoEncoder.encode(videoFrame);
      videoFrame.close();
    
      if (isUploading) {
        requestAnimationFrame(encodeFrame);
      }
    } catch (error) {
      console.error('Error encoding video frame:', error);
    }
  }
  
  

async function uploadVideoChunk(chunk, sequenceNumber) {
  const formData = new FormData();
  formData.append('video_chunk', new Blob([chunk]), `chunk_${sequenceNumber}.mp4`);

  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }
  } catch (error) {
    console.error('Error uploading video chunk:', error);
  }
}

async function loadVideoList() {
  try {
    const response = await fetch('/videos');
    const videoList = await response.json();
    displayVideoList(videoList);
  } catch (error) {
    console.error('Error loading video list:', error);
  }
}

async function getVideoListAndUpdate() {
  try {
    const response = await fetch('/videos');
    const videoList = await response.json();
    displayVideoList(videoList);
  } catch (error) {
    console.error('Error loading video list:', error);
  }
}

function displayVideoList(videoList) {
    videoListElement.innerHTML = '';
  
    for (const video of videoList) {
      const listItem = document.createElement('li');
      const videoLink = document.createElement('a');
      videoLink.href = `/uploads/${video.filename}`;
      videoLink.textContent = video.filename;
      videoLink.target = '_blank';
      listItem.appendChild(videoLink);
      videoListElement.appendChild(listItem);
    }
  }
  
  // Load the video list when the page is loaded
  loadVideoList();
  
