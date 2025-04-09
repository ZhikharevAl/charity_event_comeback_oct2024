FROM node:21-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:21-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY --from=builder /app/build ./build
COPY apispec2.yaml ./

ENV PORT=4040
EXPOSE 4040

CMD ["npm", "start"]
