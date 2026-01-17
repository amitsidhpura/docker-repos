# Socket.IO Cluster with Redis

A horizontally scalable Socket.IO server using Redis adapter, designed for Kubernetes deployment with NGINX Ingress.

## Architecture

```
                    ┌─────────────┐
                    │   NGINX     │
                    │   Ingress   │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Socket.IO  │   │  Socket.IO  │   │  Socket.IO  │
│    Pod 1    │   │    Pod 2    │   │    Pod N    │
└──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │
                  ┌──────▼──────┐
                  │    Redis    │
                  │  (Bitnami)  │
                  └─────────────┘
```

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster with NGINX Ingress Controller
- Redis cluster (e.g., Bitnami Redis) already deployed
- `kubectl` configured for your cluster
- Container registry access

### Build and Push Image

```bash
# Build the image
docker build -t your-registry/socketio-server:latest .

# Push to registry
docker push your-registry/socketio-server:latest
```

### Configure Redis Connection

Edit `k8s/socketio-deployment.yaml` and update the `REDIS_URL` to point to your Redis service:

```yaml
- name: REDIS_URL
  value: "redis://redis-master:6379"  # Update to your Redis service name
```

Common Bitnami Redis service names:
- `redis-master` - Standalone or master node
- `<release-name>-redis-master` - If installed with a release name
- `redis://:<password>@redis-master:6379` - With authentication

### Update Image Reference

Edit `k8s/socketio-deployment.yaml` and update the image:

```yaml
image: your-registry/socketio-server:latest
```

### Deploy

```bash
# Deploy all resources
kubectl apply -k k8s/

# Or apply individually
kubectl apply -f k8s/socketio-deployment.yaml
kubectl apply -f k8s/services.yaml
kubectl apply -f k8s/ingress.yaml
```

### Configure Ingress

Edit `k8s/ingress.yaml` and set your domain:

```yaml
spec:
  rules:
    - host: socketio.yourdomain.com  # Change this
```

For TLS, uncomment the tls section and create a secret:

```bash
kubectl create secret tls socketio-tls \
  --cert=path/to/cert.pem \
  --key=path/to/key.pem
```

### Scale

```bash
# Scale to 5 replicas
kubectl scale deployment socketio-server --replicas=5

# Check status
kubectl get pods -l app=socketio-server
```

### View Logs

```bash
# All pods
kubectl logs -l app=socketio-server -f

# Specific pod
kubectl logs socketio-server-xxxxx -f
```

## Local Development

For local development, use Docker Compose (includes a local Redis instance):

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

This starts a single Socket.IO instance with Redis on `localhost:3000`.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `CORS_ORIGIN` | `*` | Allowed CORS origins |
| `REDIS_URL` | `redis://redis:6379` | Redis connection URL |
| `NODE_ENV` | `production` | Node environment |

### Kubernetes Resources

Default resource limits in `k8s/socketio-deployment.yaml`:

| Resource | Request | Limit |
|----------|---------|-------|
| Memory | 128Mi | 256Mi |
| CPU | 100m | 500m |

## API Endpoints

- `GET /health` - Health check (returns instance info)
- `GET /cluster/info` - Cluster information

## Socket.IO Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `message` | `any` | Broadcast message to all clients |
| `join-room` | `string` | Join a room |
| `leave-room` | `string` | Leave a room |
| `room-message` | `{ room, message }` | Send message to room |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `instance-info` | `{ instanceId }` | Instance handling connection |
| `message` | `{ from, instance, data, timestamp }` | Broadcasted message |
| `user-joined` | `{ userId, room, instance }` | User joined room |
| `user-left` | `{ userId, room, instance }` | User left room |
| `room-message` | `{ from, room, message, instance, timestamp }` | Room message |

## Testing

### Test Client

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.socket.io/4.7.4/socket.io.min.js"></script>
</head>
<body>
  <h1>Socket.IO Cluster Test</h1>
  <div id="instance"></div>
  <div id="messages"></div>

  <script>
    const socket = io('https://socketio.yourdomain.com');

    socket.on('connect', () => {
      console.log('Connected:', socket.id);
    });

    socket.on('instance-info', (data) => {
      document.getElementById('instance').textContent =
        'Connected to: ' + data.instanceId;
    });

    socket.on('message', (data) => {
      const div = document.createElement('div');
      div.textContent = `[${data.instance}] ${data.from}: ${JSON.stringify(data.data)}`;
      document.getElementById('messages').appendChild(div);
    });

    // Send a test message every 5 seconds
    setInterval(() => {
      socket.emit('message', { test: 'Hello from client!' });
    }, 5000);
  </script>
</body>
</html>
```

### Verify Deployment

```bash
# Check pods are running
kubectl get pods -l app=socketio-server

# Test health endpoint
curl https://socketio.yourdomain.com/health

# Check cluster info
curl https://socketio.yourdomain.com/cluster/info
```

## Production Considerations

1. **Set specific CORS origins** - Replace `*` with your actual domains
2. **Redis authentication** - Use password-protected Redis connection
3. **Resource tuning** - Adjust requests/limits based on load testing
4. **Monitoring** - Add Prometheus annotations for metrics scraping

### Redis with Authentication

If your Bitnami Redis requires authentication, update the Socket.IO deployment:

```yaml
env:
  - name: REDIS_PASSWORD
    valueFrom:
      secretKeyRef:
        name: redis-secret  # Your existing Redis secret
        key: redis-password
  - name: REDIS_URL
    value: "redis://:$(REDIS_PASSWORD)@redis-master:6379"
```