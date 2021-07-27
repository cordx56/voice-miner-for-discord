import dotenv from "dotenv";
import fs from "fs";
import { Readable } from "stream";
import Discord from "discord.js";
import { recognize_from_file } from "./speech";
import { convertAndUpload } from "./s3";

dotenv.config();

const client = new Discord.Client();

client.login(process.env.DISCORD_BOT_TOKEN);

let voiceConnections = new Map<Discord.Snowflake, Discord.VoiceConnection>();

const SILENCE_FRAME = Buffer.from([0xf8, 0xff, 0xfe]);
class Silence extends Readable {
  _read() {
    this.push(SILENCE_FRAME);
    this.destroy();
  }
}

client.on("ready", () => {
  console.log("Ready...");
});

const start_command = ["議事録取って", "議事録開始", "!start"];
const stop_command = ["議事録とめて", "議事録終了", "!stop"];

client.on("message", async (message) => {
  if (!message.guild) return;

  if (start_command.includes(message.content)) {
    if (message.member && message.member.voice.channel) {
      const connection = await message.member.voice.channel.join();
      connection.play(new Silence(), { type: "opus" });
      voiceConnections.set(message.guild.id, connection);
      const receiver = connection.receiver;
      connection.on("speaking", (user, speaking) => {
        if (speaking) {
          const audioStream = receiver.createStream(user, { mode: "pcm" });
          const fileName = String(Date.now()) + ".wav";
          const audioFileStream = fs.createWriteStream(fileName);
          audioStream.pipe(audioFileStream);
          audioStream.on("end", async () => {
            try {
              if (message.guild) {
                const [response] = await recognize_from_file(fileName);
                if (response.results) {
                  if (0 < response.results.length) {
                    const s3Key = await convertAndUpload(fileName, message.guild.id);
                    const s3URL =
                      process.env.AWS_CLOUDFRONT_BASE_URL + "/" + s3Key;
                    for (let result of response.results) {
                      if (
                        result &&
                        result.alternatives &&
                        message.member &&
                        message.member.voice.channel
                      ) {
                        message.channel.send(
                          `${user.username}@${message.member.voice.channel.name}: \n> ${result.alternatives[0].transcript}\n${s3URL}`,
                        );
                      }
                    }
                  }
                }
              }
            } catch (err) {
              console.log(err);
            } finally {
              fs.unlinkSync(fileName);
            }
          });
        }
      });
    } else {
      message.reply("ボイスチャンネルに入ってから言ってくださる？");
    }
  } else if (stop_command.includes(message.content)) {
    const connection = voiceConnections.get(message.guild.id);
    if (connection) {
      connection.disconnect();
      voiceConnections.delete(message.guild.id);
    }
  }
});

setInterval(() => {
  voiceConnections.forEach((value, key) => {
    value.play(new Silence(), { type: "opus" });
  });
}, 10000);
