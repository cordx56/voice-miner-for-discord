FROM node:16

WORKDIR /app

RUN apt update && \
    apt install -y ffmpeg

COPY package.json .
COPY yarn.lock .

RUN yarn install

COPY . .
RUN yarn tsc

CMD yarn start
