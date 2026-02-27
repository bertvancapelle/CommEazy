// PM2 configuration for CommEazy Push Gateway
module.exports = {
  apps: [{
    name: 'commeazy-push-gateway',
    script: './server.js',
    cwd: '/opt/commeazy/push-gateway',

    // Environment from file
    env_file: '/etc/commeazy/push-gateway.env',

    // Process management
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',

    // Logging
    log_file: '/var/log/commeazy/push-gateway.log',
    error_file: '/var/log/commeazy/push-gateway-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,

    // Startup behavior
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 1000,
  }]
};
