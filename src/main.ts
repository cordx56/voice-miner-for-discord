import dotenv from "dotenv";
import fs from "fs";
import { Readable } from "stream";
import Discord from "discord.js";
import { recognize_from_file } from "./speech";

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

client.on("message", async (message) => {
  if (!message.guild) return;

  if (message.content === "議事録取って" || message.content === "!start") {
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
              const [response] = await recognize_from_file(fileName);
              console.log(response);
              if (response.results) {
                for (let result of response.results) {
                  if (result && result.alternatives && message.member && message.member.voice.channel) {
                    message.channel.send(
                      `${message.member.displayName}@${message.member.voice.channel.name}: ${result.alternatives[0].transcript}`,
                    );
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
  } else if (message.content === "議事録終了" || message.content === "!stop") {
    const connection = voiceConnections.get(message.guild.id);
    if (connection) {
      connection.disconnect();
    }
  }
});
