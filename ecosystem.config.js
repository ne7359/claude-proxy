module.exports = {
  apps: [
    {
      name: 'claude-raw-proxy',
      script: './src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
      // 日志配置
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // 重启配置
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
