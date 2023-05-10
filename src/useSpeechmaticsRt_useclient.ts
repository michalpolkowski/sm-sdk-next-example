"use client";
import { Speechmatics } from "@speechmatics/js-sdk/browser";
import { useEffect, useState } from "react";

export type UseSpeechmaticsRtParams = {
  setIsConnected?: (val: boolean) => void;
  setTranscript?: (val: string | ((val: string) => string)) => void;
  setPartialTranscript?: (val: string | ((val: string) => string)) => void;
  apiKey?: string;
  jwt?: string;
};

export default function useSpeechmaticsRt({
  apiKey,
  jwt,
}: UseSpeechmaticsRtParams) {
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [partialTranscript, setPartialTranscript] = useState("");

  const [sessionHandlers, setSessionHandlers] =
    useState<Awaited<ReturnType<typeof initialiseSM>>>();

  useEffect(() => {
    initialiseSM(
      setIsConnected,
      setTranscript,
      setPartialTranscript,
      apiKey,
      jwt
    ).then(setSessionHandlers);
  }, [apiKey, jwt]);

  return {
    ...sessionHandlers,
    isConnected,
    transcript,
    partialTranscript,
  };
}

async function initialiseSM(
  setIsConnected?: (val: boolean) => void,
  setTranscript?: (val: string | ((val: string) => string)) => void,
  setPartialTranscript?: (val: string | ((val: string) => string)) => void,
  apiKey?: string,
  smJwt?: string
) {
  const sm = new Speechmatics(apiKey);

  let session = sm.realtime.create(smJwt);

  let stream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;

  session.addListener("RecognitionStarted", () => {
    console.log("RecognitionStarted");
    setIsConnected?.(true);
  });

  session.addListener("EndOfTranscript", () => {
    setIsConnected?.(false);
  });

  session.addListener("AddTranscript", (result: any) => {
    console.log("AddTranscript", JSON.stringify(result, null, 2));
    setTranscript?.(
      (transcript) => transcript + " " + result.metadata.transcript
    );
  });

  session.addListener("AddPartialTranscript", (result: any) => {
    console.log("AddPartialTranscript", JSON.stringify(result, null, 2));
    setPartialTranscript?.(result.metadata.transcript + " ");
  });

  const sessionStart = async () => {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: "audio/webm;codecs=opus",
      audioBitsPerSecond: 16000,
    });

    session
      ?.start({ language: "en" }, { type: "file" })
      .then(() => {
        mediaRecorder.start(1000);

        mediaRecorder.ondataavailable = async (event) => {
          if (event.data.size > 0 && session?.isConnected()) {
            session?.sendAudio(Buffer.from(await event.data.arrayBuffer()));
          }
        };
      })
      .catch((err: any) => {
        console.error(err);
      });
  };

  const sessionEnd = () => {
    if (processor) {
      processor.onaudioprocess = null;
      processor.disconnect();
    }
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    source?.disconnect();
    source = null;
    audioContext?.close();
    audioContext = null;
    session?.stop();
  };

  return { sessionStart, sessionEnd };
}
