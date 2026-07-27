// Конфиг для PM2 (альтернатива Docker для запуска на VPS напрямую).
// Использование: pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'saran-backend',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '300M',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
