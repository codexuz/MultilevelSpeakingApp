import { useState, useRef, useCallback } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);

  const startRecording = useCallback(async (questionId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analyser for visualizer
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      audioContextRef.current = audioContext;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordings((prev) => [
          ...prev,
          { questionId, blob, url, timestamp: Date.now() },
        ]);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setIsRecording(false);
  }, []);

  const getAnalyser = useCallback(() => analyserRef.current, []);

  const getRecordingForQuestion = useCallback(
    (questionId) => recordings.find((r) => r.questionId === questionId),
    [recordings]
  );

  const downloadRecording = useCallback(async (recording, filename) => {
    try {
      const defaultName = filename || `recording-${recording.questionId}.webm`;

      // Open native save dialog
      const filePath = await save({
        defaultPath: defaultName,
        filters: [
          { name: 'Audio Files', extensions: ['webm'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (!filePath) return; // User cancelled

      // Convert blob to Uint8Array and write via Tauri fs
      const arrayBuffer = await recording.blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      await writeFile(filePath, bytes);
    } catch (err) {
      console.error('Failed to save recording:', err);
    }
  }, []);

  const downloadAll = useCallback(async () => {
    for (const rec of recordings) {
      await downloadRecording(rec, `question-${rec.questionId}.webm`);
    }
  }, [recordings, downloadRecording]);

  return {
    isRecording,
    recordings,
    startRecording,
    stopRecording,
    getAnalyser,
    getRecordingForQuestion,
    downloadRecording,
    downloadAll,
  };
}

