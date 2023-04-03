const videoElement = document.getElementById('camera-preview');
const startUploadButton = document.getElementById('start-upload');

let videoEncoder;
let frameNumber = 0;
let isUploading = false;

async function startCamera() {
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

async function startEncoding() {
  if (!videoEncoder) {
    console.error('Video encoder not initialized');
    return;
  }

  while (true) {
    const videoFrame = await createVideoFrame(videoElement);
    videoEncoder.encode(videoFrame);
    videoFrame.close();
  }
}

async function createVideoFrame(videoElement) {
  const bitmap = await createImageBitmap(videoElement);
  const frame = new VideoFrame(bitmap, { timestamp: performance.now() });
  return frame;
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

startUploadButton.addEventListener('click', () => {
  isUploading = !isUploading;
  startUploadButton.textContent = isUploading ? 'Stop Upload' : 'Start Upload';
});

startCamera();
