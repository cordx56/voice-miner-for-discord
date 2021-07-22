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
    const command = ffmpeg()
      .input(fileName)
      .inputFormat("s16le")
      .outputOptions(["-map_channel", "0.0.0", newFileName])
      .save(newFileName)
      .on("end", () => {
        resolve(newFileName);
      })
      .on("error", (err) => {
        reject(new Error(err));
      });
    console.log(command);
  });
};

export const recognize_from_file = async (fileName: string) => {
  const resultFileName = await ffmpegSync(fileName);
  const mono_data = fs.readFileSync(resultFileName);
  const audio = {
    content: mono_data.toString("base64"),
  };
  const request = {
    audio: audio,
    config: config,
  };
  const response = await client.recognize(request);
  fs.unlinkSync(resultFileName);
  return response;
};
