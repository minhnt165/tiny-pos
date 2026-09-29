// pm2: npx pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'tiny-pos',
      script: 'server/dist/index.js',
      cwd: __dirname,
      env: { NODE_ENV: 'production', PORT: 3000 },
    },
  ],
};
