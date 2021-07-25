import fs from "fs";
import speech from "@google-cloud/speech";
import ffmpeg from "fluent-ffmpeg";

const client = new speech.SpeechClient();

const config = {
  encoding: "LINEAR16" as const,
  sampleRateHertz: 44100,
  languageCode: "ja-JP",
};

const ffmpegSync = (fileName: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const newFileName = fileName + ".mono.wav";
    ffmpeg()
      .input(fileName)
      .inputFormat("s32le")
      .outputOptions(["-map_channel", "0.0.0", newFileName])
      .save(newFileName)
      .on("end", () => {
        resolve(newFileName);
      })
      .on("error", (err) => {
        reject(new Error(err));
      });
  });
};

export const recognize_from_b64 = async (b64: string) => {
  const audio = {
    content: b64,
  };
  const request = {
    audio: audio,
    config: config,
  };
  const response = await client.recognize(request);
  return response;
};

export const recognize_from_file = async (fileName: string) => {
  const newFileName = await ffmpegSync(fileName);
  const response = await recognize_from_b64(fs.readFileSync(newFileName).toString("base64"));
  fs.unlinkSync(newFileName);
  return response;
};
