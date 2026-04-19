/**
 * PM2 ecosystem config for Terra Invest.
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 restart terrainvest --update-env
 *
 * Notes:
 * - We invoke the Next binary directly instead of going through `npm start`.
 *   `npm start` spawns an extra Node process whose only job is to exec
 *   `next start`, which adds ~200–400ms to every restart and leaves a stray
 *   PID around that can confuse PM2 on signal forwarding.
 * - `instances: 1` (fork mode) is intentional. Some features rely on
 *   in-memory state held by a single Node process (the price-override
 *   simulation timers, the override→real cache, the trades aggregation
 *   cache). Cluster mode would create N independent copies of those.
 */
module.exports = {
  apps: [
    {
      name: "terrainvest",
      // Run the Next binary directly — no npm wrapper, no extra process.
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      // Give in-flight requests up to 5 s to finish before SIGKILL on a
      // restart, so a deploy doesn't drop a user's trade in the middle of
      // executing it.
      kill_timeout: 5000,
      // Wait briefly between automatic restarts on crash to avoid hammering
      // the process during a fatal startup error.
      restart_delay: 2000,
      env: {
        NODE_ENV: "production",
        // Larger V8 heap so a long-running app (price simulator, in-memory
        // caches, trade processor) doesn't trigger GC pressure under load.
        NODE_OPTIONS: "--max-old-space-size=512",
      },
    },
  ],
};
