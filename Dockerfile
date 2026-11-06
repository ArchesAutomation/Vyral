FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app ./
RUN mkdir -p /app/data && chown -R node:node /app
USER node
ENV NODE_ENV=production DATA_DIR=/app/data
EXPOSE 3000
CMD ["npm","start"]
