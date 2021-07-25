import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import S3 from "aws-sdk/clients/s3";

const s3Client = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_DEFAULT_REGION,
});

const ffmpegSync = (fileName: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const newFileName = fileName + ".mp3";
    ffmpeg()
      .input(fileName)
      .inputFormat("s32le")
      .toFormat("mp3")
      .save(newFileName)
      .on("end", () => {
        resolve(newFileName);
      })
      .on("error", (err) => {
        reject(new Error(err));
      });
  });
};

export const uploadFileToS3 = async (fileName: string, key: string) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME || "",
    Key: key,
    Body: fs.createReadStream(fileName),
  };
  return await s3Client.upload(params).promise();
};

export const convertAndUpload = async (fileName: string, guildID: string) => {
  const newFileName = await ffmpegSync(fileName);
  const key = "discord/" + guildID + "/" + newFileName
  await uploadFileToS3(newFileName, key);
  fs.unlinkSync(newFileName);
  return key;
};
