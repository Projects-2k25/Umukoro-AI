module.exports = {
  apps: [
    {
      name: 'talentlens-frontend',
      script: 'npm',
      args: 'run start -- -p 7001',
      instances: 1,
      exec_mode: 'fork',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: 7001,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 7001,
      },
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
