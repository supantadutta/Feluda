/**
 * Voice mode (Layer I) — speech-to-text in, text-to-speech out, using the
 * browser Web Speech API. Degrades gracefully: when the API is unavailable
 * (e.g. in tests or unsupported browsers) `supported` is false and the controls
 * hide themselves. No backend, no audio leaves the device.
 */
import { useCallback, useRef, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
type SpeechRecognitionLike = any;

function getRecognition(): SpeechRecognitionLike | undefined {
  const w = window as any;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : undefined;
}

export function useVoice() {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | undefined>(undefined);

  const sttSupported = typeof window !== 'undefined' && Boolean((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition);
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const speak = useCallback(
    (text: string) => {
      if (!ttsSupported) return;
      const u = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    },
    [ttsSupported],
  );

  const listen = useCallback(
    (onResult: (text: string) => void) => {
      if (!sttSupported) return;
      const rec = getRecognition();
      if (!rec) return;
      recognitionRef.current = rec;
      rec.lang = 'en-US';
      rec.interimResults = false;
      rec.onresult = (e: any) => onResult(e.results[0][0].transcript);
      rec.onend = () => setListening(false);
      setListening(true);
      rec.start();
    },
    [sttSupported],
  );

  return { speak, listen, listening, sttSupported, ttsSupported };
}
