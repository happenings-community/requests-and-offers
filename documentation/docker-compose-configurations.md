# Docker Compose Configurations for Holochain Bootstrap Server

This document provides different Docker Compose configurations for setting up a Holochain bootstrap server on your Digital Ocean droplet (1 vCPU, 512MB RAM, 10GB SSD).

## Table of Contents

1. [Quick Start Testing](#1-quick-start-testing)
2. [Production with SSL](#2-production-with-ssl)
3. [Domain-Based Setup](#3-domain-based-setup)
4. [Complete Development Stack](#4-complete-development-stack)
5. [Resource-Optimized](#5-resource-optimized)
6. [High Availability](#6-high-availability)
7. [Monitoring & Debugging](#7-monitoring--debugging)

---

## 1. Quick Start Testing

**Best for**: Initial testing, 10-20 users, minimal setup time

**Resources**: ~200MB RAM, ~50MB CPU

```yaml
# docker-compose.yml
version: '3.8'

services:
  bootstrap:
    image: ghcr.io/holochain/kitsune2_bootstrap_srv:v0.2.16
    command:
      - kitsune2-bootstrap-srv
      - --development
      - --listen
      - "[::]:8080"
    environment:
      - RUST_LOG=info
    ports:
      - "8080:8080"
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 128M
        reservations:
          memory: 64M
```

**Usage**:
```bash
# Start server
docker-compose up -d

# Test
curl -X GET http://142.93.41.235:8080/

# Kangaroo config:
bootstrapUrl: 'http://142.93.41.235:8080/'
```

**Pros**: ✅ Simple, ✅ Fast setup, ✅ Low resource usage
**Cons**: ❌ No SSL, ❌ HTTP only, ❌ Not production-ready

---

## 2. Production with SSL

**Best for**: Testing with HTTPS, SSL certificate validation

**Resources**: ~250MB RAM, ~75MB CPU

```yaml
# docker-compose.yml
version: '3.8'

services:
  bootstrap:
    image: ghcr.io/holochain/kitsune2_bootstrap_srv:v0.2.16
    command:
      - kitsune2-bootstrap-srv
      - --production
      - --listen
      - "[::]:443"
      - --tls-cert
      - /certs/server.crt
      - --tls-key
      - /certs/server.key
    environment:
      - RUST_LOG=info
    ports:
      - "443:443"
    volumes:
      - ./certs:/certs:ro
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 160M
        reservations:
          memory: 80M

  # Self-signed certificate generator (run once)
  cert-generator:
    image: alpine:latest
    command: |
      sh -c "
        apk add --no-cache openssl
        mkdir -p /certs
        openssl req -x509 -newkey rsa:2048 -keyout /certs/server.key -out /certs/server.crt -days 365 -nodes -subj '/CN=142.93.41.235'
        chown 65535:65535 /certs/*
        chmod 600 /certs/server.key
        chmod 644 /certs/server.crt
        echo 'Self-signed certificates generated for 142.93.41.235'
        echo 'Use: curl -k https://142.93.41.235:443/'
      "
    volumes:
      - ./certs:/certs
    profiles:
      - setup
```

**Usage**:
```bash
# Generate certificates (run once)
docker-compose --profile setup up cert-generator

# Start bootstrap server
docker-compose up -d bootstrap

# Test (accept self-signed cert)
curl -k -X GET https://142.93.41.235:443/

# Kangaroo config:
bootstrapUrl: 'https://142.93.41.235:443/'
```

**Pros**: ✅ HTTPS support, ✅ Still uses IP address
**Cons**: ❌ Self-signed cert (browser warnings), ❌ Extra setup step

---

## 3. Domain-Based Setup

**Best for**: Production deployment with proper SSL

**Resources**: ~300MB RAM, ~100MB CPU

```yaml
# docker-compose.yml
version: '3.8'

services:
  bootstrap:
    image: ghcr.io/holochain/kitsune2_bootstrap_srv:v0.2.16
    command:
      - kitsune2-bootstrap-srv
      - --production
      - --listen
      - "[::]:443"
      - --tls-cert
      - /etc/letsencrypt/live/bootstrap.yourdomain.com/fullchain.pem
      - --tls-key
      - /etc/letsencrypt/live/bootstrap.yourdomain.com/privkey.pem
    environment:
      - RUST_LOG=info
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - /var/www/html:/var/www/html:ro
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 200M
        reservations:
          memory: 100M

  # Certbot for SSL certificate management
  certbot:
    image: certbot/certbot:latest
    command: |
      sh -c "
        echo 'Setting up SSL certificates...'
        certbot certonly --webroot -w /var/www/html --email your-email@example.com --agree-tos --no-eff-email -d bootstrap.yourdomain.com --non-interactive
        echo 'Certificates obtained successfully'
        echo 'Setting up auto-renewal...'
        echo '0 12 * * * /usr/bin/certbot renew --quiet' | crontab -
      "
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt
      - /var/www/html:/var/www/html
    profiles:
      - ssl

  # Nginx reverse proxy (optional, for better performance)
  nginx:
    image: nginx:alpine
    command: |
      sh -c "
        cat > /etc/nginx/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}
http {
    server {
        listen 80;
        server_name bootstrap.yourdomain.com;
        location /.well-known/acme-challenge/ {
            root /var/www/html;
        }
        location / {
            return 301 https://$server_name$request_uri;
        }
    }
    server {
        listen 443 ssl http2;
        server_name bootstrap.yourdomain.com;
        ssl_certificate /etc/letsencrypt/live/bootstrap.yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/bootstrap.yourdomain.com/privkey.pem;
        location / {
            proxy_pass http://bootstrap:8443;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
EOF
        nginx -g 'daemon off;'
      "
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - bootstrap
    profiles:
      - nginx
```

**Prerequisites**:
1. Point DNS A record: `bootstrap.yourdomain.com → 142.93.41.235`
2. Open ports 80 and 443 in firewall

**Usage**:
```bash
# Initial SSL setup
docker-compose --profile ssl up certbot

# Start with Nginx (recommended)
docker-compose --profile nginx up -d

# Or start without Nginx
docker-compose up -d bootstrap

# Test
curl -X GET https://bootstrap.yourdomain.com/

# Kangaroo config:
bootstrapUrl: 'https://bootstrap.yourdomain.com/'
```

**Pros**: ✅ Production-ready, ✅ Proper SSL, ✅ Professional setup
**Cons**: ❌ Requires domain, ❌ More complex setup

---

## 4. Complete Development Stack

**Best for**: Full testing with signal server

**Resources**: ~350MB RAM, ~150MB CPU

```yaml
# docker-compose.yml
version: '3.8'

services:
  bootstrap:
    image: ghcr.io/holochain/kitsune2_bootstrap_srv:v0.2.16
    command:
      - kitsune2-bootstrap-srv
      - --development
      - --listen
      - "[::]:8443"
    environment:
      - RUST_LOG=debug
    ports:
      - "8443:8443"
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 128M
        reservations:
          memory: 64M

  # Simple WebSocket signal server
  signal-server:
    image: node:18-alpine
    working_dir: /app
    command: |
      sh -c "
        npm install -g ws
        cat > signal-server.js << 'EOF'
        const WebSocket = require('ws');
        const wss = new WebSocket.Server({
          port: 8080,
          perMessageDeflate: false  # Save CPU/memory
        });

        console.log('Signal server running on port 8080');
        console.log('Memory usage:', process.memoryUsage());

        let clientCount = 0;
        wss.on('connection', (ws) => {
          clientCount++;
          console.log(\`Client connected. Total: \${clientCount}\`);

          ws.on('message', (data) => {
            // Relay to all other clients
            wss.clients.forEach(client => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(data);
              }
            });
          });

          ws.on('close', () => {
            clientCount--;
            console.log(\`Client disconnected. Total: \${clientCount}\`);
          });

          ws.on('error', (error) => {
            console.error('WebSocket error:', error.message);
          });
        });

        // Monitor memory usage
        setInterval(() => {
          const mem = process.memoryUsage();
          if (mem.heapUsed > 50 * 1024 * 1024) { // 50MB warning
            console.warn('High memory usage:', mem);
          }
        }, 30000);
EOF
        node signal-server.js
      "
    ports:
      - "8080:8080"
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 64M
        reservations:
          memory: 32M

  # Monitoring panel
  monitoring:
    image: nginx:alpine
    command: |
      sh -c "
        cat > /usr/share/nginx/html/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head><title>Holochain Bootstrap Status</title></head>
<body>
<h1>Holochain Bootstrap Server Status</h1>
<h2>Services</h2>
<ul>
<li>Bootstrap Server: <a href='http://localhost:8443/'>http://localhost:8443/</a></li>
<li>Signal Server: ws://localhost:8080/</li>
</ul>
<h2>System Info</h2>
<pre id='stats'></pre>
<script>
setInterval(() => {
  fetch('/stats')
    .then(r => r.text())
    .then(data => document.getElementById('stats').textContent = data);
}, 5000);
</script>
</body>
</html>
EOF
        cat > /etc/nginx/nginx.conf << 'EOF'
events { worker_connections 64; }
http {
  server {
    listen 80;
    location / { root /usr/share/nginx/html; }
    location /stats {
      access_log off;
      return 200 'Uptime: $(cat /proc/uptime | cut -d' ' -f1)s\\nMemory: $(free -h | grep Mem | awk '{print $3}')\\nLoad: $(uptime | cut -d',' -f1 | cut -d':' -f5-)';
    }
  }
}
EOF
        nginx -g 'daemon off;'
      "
    ports:
      - "80:80"
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 32M
        reservations:
          memory: 16M
```

**Usage**:
```bash
# Start all services
docker-compose up -d

# Access monitoring panel
curl http://142.93.41.235/

# Test bootstrap
curl -X GET http://142.93.41.235:8443/

# Test signal server
websocat ws://142.93.41.235:8080/

# Kangaroo config:
bootstrapUrl: 'http://142.93.41.235:8443/'
signalUrl: 'ws://142.93.41.235:8080/'
```

**Pros**: ✅ Complete setup, ✅ Monitoring, ✅ Both services
**Cons**: ❌ Higher resource usage, ❌ More complex

---

## 5. Resource-Optimized

**Best for**: Maximum efficiency on limited droplet

**Resources**: ~180MB RAM, ~50MB CPU

```yaml
# docker-compose.yml
version: '3.8'

services:
  bootstrap:
    image: ghcr.io/holochain/kitsune2_bootstrap_srv:v0.2.16
    command:
      - kitsune2-bootstrap-srv
      - --development
      - --listen
      - "[::]:8080"
    environment:
      - RUST_LOG=warn  # Minimal logging
    ports:
      - "8080:8080"
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 96M
          cpus: '0.5'
        reservations:
          memory: 48M
    ulimits:
      nofile:
        soft: 1024
        hard: 2048
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

**Additional Optimizations**:
```bash
# Add to /etc/sysctl.conf for system optimization
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
echo 'fs.file-max=65536' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Create log rotation for Docker logs
sudo mkdir -p /etc/docker/logrotate.d
cat | sudo tee /etc/docker/logrotate.d/docker-containers << 'EOF'
/var/lib/docker/containers/*/*.log {
    daily
    rotate 3
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
EOF
```

**Usage**:
```bash
# Start optimized server
docker-compose up -d

# Monitor resource usage
docker stats --no-stream bootstrap

# Test
curl -X GET http://142.93.41.235:8080/
```

**Pros**: ✅ Minimal resource usage, ✅ Optimized for 512MB droplet
**Cons**: ❌ Minimal logging, ❌ Less monitoring data

---

## 6. High Availability

**Best for**: Production redundancy (requires 2+ droplets)

**Resources**: ~300MB RAM per instance

```yaml
# docker-compose.yml
version: '3.8'

services:
  bootstrap-primary:
    image: ghcr.io/holochain/kitsune2_bootstrap_srv:v0.2.16
    command:
      - kitsune2-bootstrap-srv
      - --production
      - --listen
      - "[::]:8443"
      - --tls-cert
      - /certs/server.crt
      - --tls-key
      - /certs/server.key
    environment:
      - RUST_LOG=info
    ports:
      - "8443:8443"
    volumes:
      - ./certs:/certs:ro
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 128M
        reservations:
          memory: 64M

  # Nginx load balancer
  nginx:
    image: nginx:alpine
    command: |
      sh -c "
        cat > /etc/nginx/nginx.conf << 'EOF'
events {
    worker_connections 512;
}
http {
    upstream bootstrap_backend {
        server 142.93.41.235:8443 max_fails=3 fail_timeout=30s;
        # Add secondary servers here
        # server SECONDARY_IP:8443 max_fails=3 fail_timeout=30s;
    }
    server {
        listen 443 ssl http2;
        ssl_certificate /certs/server.crt;
        ssl_certificate_key /certs/server.key;
        location / {
            proxy_pass http://bootstrap_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_connect_timeout 5s;
            proxy_send_timeout 10s;
            proxy_read_timeout 10s;
        }
    }
}
EOF
        nginx -g 'daemon off;'
      "
    ports:
      - "443:443"
    volumes:
      - ./certs:/certs:ro
    depends_on:
      - bootstrap-primary
    restart: unless-stopped
```

**Usage**:
```bash
# Deploy on primary server
docker-compose up -d

# Deploy same config on secondary server with different IP
# Update nginx config to include secondary servers
```

**Pros**: ✅ High availability, ✅ Load balancing
**Cons**: ❌ Requires multiple droplets, ❌ Complex setup

---

## 7. Monitoring & Debugging

**Best for**: Development and troubleshooting

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  bootstrap:
    image: ghcr.io/holochain/kitsune2_bootstrap_srv:v0.2.16
    command:
      - kitsune2-bootstrap-srv
      - --development
      - --listen
      - "[::]:8080"
    environment:
      - RUST_LOG=debug
    ports:
      - "8080:8080"
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 128M
        reservations:
          memory: 64M

  # System monitoring
  node-exporter:
    image: prom/node-exporter:latest
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    ports:
      - "9100:9100"
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 32M

  # Log aggregation
  fluentd:
    image: fluent/fluent-bit:latest
    command: |
      sh -c "
        cat > /fluent-bit/etc/fluent-bit.conf << 'EOF'
        [SERVICE]
            Flush         1
            Log_Level     info
            Daemon        off
            Parsers_File  parsers.conf
            HTTP_Server   On
            HTTP_Listen   0.0.0.0
            HTTP_Port     2020

        [INPUT]
            Name              tail
            Path              /var/log/containers/*.log
            Parser            docker
            Tag               docker.*
            Refresh_Interval  5
            Mem_Buf_Limit     50MB
            Skip_Long_Lines   On

        [OUTPUT]
            Name  stdout
            Match *

        [OUTPUT]
            Name  file
            Match *
            Path  /var/log/fluent-bit
            File  processed.log
EOF
        cat > /fluent-bit/etc/parsers.conf << 'EOF'
        [PARSER]
            Name        docker
            Format      json
            Time_Key    time
            Time_Format %Y-%m-%dT%H:%M:%S.%L
            Time_Keep   On
EOF
        /fluent-bit/bin/fluent-bit --config=/fluent-bit/etc/fluent-bit.conf
      "
    volumes:
      - /var/log:/var/log:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    ports:
      - "2020:2020"
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 64M

  # Grafana dashboard
  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    ports:
      - "3000:3000"
    volumes:
      - grafana-storage:/var/lib/grafana
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 128M

volumes:
  grafana-storage:
```

**Usage**:
```bash
# Start with monitoring
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Access Grafana
# URL: http://142.93.41.235:3000
# Username: admin
# Password: admin

# View metrics
curl http://142.93.41.235:9100/metrics

# View logs
curl http://142.93.41.235:2020/api/v1/metrics
```

**Pros**: ✅ Comprehensive monitoring, ✅ Log aggregation, ✅ Metrics dashboard
**Cons**: ❌ High resource usage, ❌ Complex setup

---

## Selection Guide

| Configuration | Use Case | RAM Usage | Complexity | SSL Support | Monitoring |
|---------------|----------|-----------|------------|-------------|------------|
| Quick Start | Initial testing | ~200MB | ⭐ Simple | ❌ No | ❌ No |
| Production SSL | HTTPS testing | ~250MB | ⭐⭐ Medium | ✅ Self-signed | ❌ No |
| Domain-Based | Production | ~300MB | ⭐⭐⭐ Complex | ✅ Let's Encrypt | ❌ No |
| Complete Stack | Full development | ~350MB | ⭐⭐⭐ Complex | ❌ No | ✅ Basic |
| Resource-Optimized | Limited droplet | ~180MB | ⭐⭐ Medium | ❌ No | ❌ No |
| High Availability | Production redundancy | ~300MB×N | ⭐⭐⭐⭐ Very Complex | ✅ Yes | ❌ No |
| Monitoring | Development/Debug | ~400MB | ⭐⭐⭐ Complex | ❌ No | ✅ Full |

## Recommendations

1. **Start with "Quick Start Testing"** for initial validation
2. **Move to "Resource-Optimized"** for longer testing periods
3. **Use "Domain-Based Setup"** for production deployment
4. **Add "Monitoring & Debugging"** when troubleshooting issues
5. **Consider "High Availability"** only for critical production needs

## Usage Commands

```bash
# Start any configuration
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f bootstrap

# Stop services
docker-compose down

# Remove all data
docker-compose down -v

# Monitor resources
docker stats --no-stream

# Clean up unused resources
docker system prune -f
```

---

**Created for**: Digital Ocean Basic Droplet (1 vCPU, 512MB RAM, 10GB SSD)
**Expected Capacity**: 10-20 concurrent users for testing configurations
**Production Capacity**: 50-100 concurrent users with domain-based setup
