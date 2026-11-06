# Deployment

Use Node 24 LTS with persistent disk and native FFmpeg/FFprobe. A web process and one separate worker share DATA_DIR. SQLite WAL supports this single-host arrangement; do not run independent replicas on separate disks. Docker Compose provides a persistent volume and localhost binding. Docker/CI execution was not verified on the build host.

Production commands:

```sh
npm ci
npm run build
npm start
# Separate process with the same env/data volume:
npm run worker
```

Next production startup reads `.env.local`; the worker explicitly loads it. Use a reverse proxy with TLS, preserve the original Host header, and keep the backing services private. Set a 68 MB request body limit in the proxy. API authentication is still required. Back up data and ENCRYPTION_KEY. The server-side SESSION_SECRET setting is an initialization guard; sessions themselves are cryptographically random server-side records, not signed JWTs.

An ephemeral Vercel Function filesystem cannot persist this studio. Migrate to Postgres/object storage and remotely hosted workers before using serverless deployment. This version does not provision cloud accounts, deployments, domains, or social applications.

On Windows, point FFMPEG_PATH/FFPROBE_PATH at binaries with drawtext/font support. On Linux, install `ffmpeg fonts-dejavu-core`. Missing encoder/font errors are surfaced in the job list. SQLite's built-in Node API may emit an experimental warning on some supported Node versions.
