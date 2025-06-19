import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Pose, POSE_CONNECTIONS, Results } from '@mediapipe/pose';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

interface VideoUploaderProps {
  onAddPoint: (frame: number, x: number, y: number) => void;
  onClear: () => void;
}


const VideoUploader: React.FC<VideoUploaderProps> = ({ onAddPoint, onClear }: VideoUploaderProps) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [processing, setProcessing] = useState(false);
    const frameRef = useRef<number>(0);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setVideoFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/mp4': ['.mp4']
    },
    multiple: false
  });

  // Initialize MediaPipe Pose instance
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const pose = new Pose({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    pose.setOptions({
      modelComplexity: 0,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    pose.onResults((results: Results) => {
      const canvasCtx = canvasRef.current!.getContext('2d');
      if (!canvasCtx || !videoRef.current) return;

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);

      // Draw pose landmark connectors
      drawConnectors(canvasCtx, results.poseLandmarks ?? [], POSE_CONNECTIONS, {
        color: '#00FF00',
        lineWidth: 2
      });
      drawLandmarks(canvasCtx, results.poseLandmarks ?? [], {
        color: '#FF0000',
        lineWidth: 1,
        radius: 2
      });
            // Save nose landmark to court coordinate (0-94 ft, 0-50 ft)
      const nose = results.poseLandmarks ? results.poseLandmarks[0] : undefined;
      if (nose) {
        onAddPoint(frameRef.current, nose.x * 94, nose.y * 50);
      }
      frameRef.current++;
      canvasCtx.restore();
    });

    const onFrame = async () => {
      if (!videoRef.current) return;
      await pose.send({
        image: videoRef.current as HTMLVideoElement
      });
      if (!videoRef.current.paused && !videoRef.current.ended) {
        requestAnimationFrame(onFrame);
      }
    };

    videoRef.current.onplay = () => {
      // resize canvas to match video
      if (canvasRef.current && videoRef.current) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
      }
            onClear();
      frameRef.current = 0;
      setProcessing(true);
      onFrame();
    };

    videoRef.current.onpause = () => setProcessing(false);
    videoRef.current.onended = () => setProcessing(false);

    return () => {
      pose.close();
    };
  }, [videoFile]);

  const videoUrl = videoFile ? URL.createObjectURL(videoFile) : undefined;

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed p-6 rounded-lg text-center cursor-pointer bg-white ${isDragActive ? 'border-blue-500' : 'border-gray-300'}`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>ここに動画をドロップしてください</p>
        ) : (
          <p>ドラッグ＆ドロップでMP4ファイルをアップロード、またはクリックして選択</p>
        )}
      </div>

      {videoFile && (
        <div className="relative w-full max-w-3xl mx-auto">
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            className="w-full"
            onLoadedMetadata={() => {
              if (canvasRef.current && videoRef.current) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
              }
            }}
          />
          <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
        </div>
      )}

      {processing && <p className="text-sm text-gray-600">人物検出中...</p>}
      
    </div>
  );
};

export default VideoUploader;
