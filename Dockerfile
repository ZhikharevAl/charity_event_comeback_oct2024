FROM node:21-alpine AS builder
WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:21-alpine
WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY --from=builder /app/build ./build


ENV PORT=4040
EXPOSE 4040

CMD ["npm", "start"]
