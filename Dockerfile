FROM node:21-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV PORT=4040

EXPOSE 4040

CMD ["npm", "start"]
