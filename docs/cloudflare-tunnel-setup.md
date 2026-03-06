# Cloudflare Tunnel Setup Guide

This guide walks you through setting up a Cloudflare Tunnel to securely expose your Contactless Order Service to the internet with automatic HTTPS.

## What is Cloudflare Tunnel?

Cloudflare Tunnel creates a secure, encrypted connection from your application to Cloudflare's edge network without exposing public ports or configuring firewalls. Benefits include:

- **Automatic HTTPS**: SSL/TLS certificates managed by Cloudflare
- **No port forwarding**: No need to open firewall ports
- **DDoS protection**: Traffic filtered through Cloudflare's network
- **Zero Trust security**: Optional access policies and authentication
- **Works anywhere**: WSL, local machine, VM, or cloud server

## Prerequisites

1. **Cloudflare account** - Sign up at [cloudflare.com](https://cloudflare.com)
2. **Domain name** - Must be using Cloudflare as your DNS provider
3. **Application deployed** - Your app should be running locally first
4. **Cloudflare Zero Trust** - Free plan available (up to 50 users)

## Step-by-Step Setup

### Step 1: Access Cloudflare Zero Trust Dashboard

1. Log in to your Cloudflare account at [dash.cloudflare.com](https://dash.cloudflare.com)
2. Navigate to **Zero Trust** in the left sidebar
   - If you haven't used Zero Trust before, you'll need to create a team name (e.g., "your-company")
3. Go to **Networks** → **Tunnels**

### Step 2: Create a New Tunnel

1. Click **Create a tunnel**
2. Choose **Cloudflared** as the connector type
3. Give your tunnel a name (e.g., `contacless-order-prod` or `restaurant-app`)
4. Click **Save tunnel**

### Step 3: Configure the Tunnel Connector

After creating the tunnel, you'll see installation instructions. We're using Docker, so:

1. Select the **Docker** tab in the connector installation section
2. You'll see a command like:
   ```bash
   docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token eyJhIjoiY...
   ```
3. **Copy the token** (the long string after `--token`)
4. **Save this token** - you'll need it for the next step

### Step 4: Add Tunnel Token to Your .env File

1. Open your `.env` file in the project root:
   ```bash
   cd /opt/contacless-order  # or your deployment directory
   nano .env
   ```

2. Find the `CLOUDFLARE_TUNNEL_TOKEN` line and paste your token:
   ```bash
   CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoiY2RhNzM5YjUtNzk1Yy00ZTJjLThkOTYtOGU1ZjU5YjY0ZGYxIiwidCI6ImI4ZGE...
   ```

3. Save and exit (Ctrl+X, Y, Enter in nano)

### Step 5: Configure Public Hostname

Back in the Cloudflare dashboard:

1. In the **Public Hostnames** tab, click **Add a public hostname**

2. Configure the hostname:
   - **Subdomain**: Choose a subdomain (e.g., `order`, `restaurant`, `menu`)
   - **Domain**: Select your domain from the dropdown
   - **Path**: Leave empty or set to `/` (for all traffic)

   **Example**: `order.yourdomain.com`

3. Configure the service:
   - **Type**: `HTTP` (not HTTPS - Nginx handles HTTP internally)
   - **URL**: `nginx:80` (this is the Docker internal hostname)

   > **Important**: Use `nginx:80`, NOT `localhost:80`. Docker services communicate via service names.

4. Click **Save hostname**

### Step 6: Enable the Tunnel Service

1. Edit `docker-compose.prod.yml`:
   ```bash
   nano docker-compose.prod.yml
   ```

2. Find the commented-out `tunnel` service (around line 79) and uncomment it:
   ```yaml
   # ============ CLOUDFLARE TUNNEL (OPTIONAL) ============
   tunnel:
     image: cloudflare/cloudflared:latest
     container_name: ${APP_NAME:-contacless}_tunnel
     command: tunnel run
     environment:
       - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
     depends_on:
       - nginx
     restart: unless-stopped
   ```

3. Save and exit

### Step 7: Start the Tunnel

1. Deploy the tunnel container:
   ```bash
   docker compose -f docker-compose.prod.yml up -d tunnel
   ```

2. Verify the tunnel is connected:
   ```bash
   docker compose -f docker-compose.prod.yml logs tunnel
   ```

   You should see:
   ```
   INF Connection <UUID> registered connIndex=0 ...
   INF Updated to new configuration ...
   ```

### Step 8: Test Your Public URL

1. Wait about 30 seconds for DNS propagation
2. Open your browser and navigate to your configured domain:
   ```
   https://order.yourdomain.com
   ```

3. You should see your application with:
   - ✅ Automatic HTTPS (valid SSL certificate)
   - ✅ Full application functionality
   - ✅ WebSocket support (for kitchen notifications)

## Verification Checklist

- [ ] Tunnel shows as "Healthy" in Cloudflare dashboard
- [ ] Public URL loads the frontend
- [ ] Can browse menu without login
- [ ] Guest login works with table selection
- [ ] API calls work (check browser DevTools Network tab)
- [ ] WebSocket connections establish (for kitchen view)
- [ ] HTTPS certificate is valid (green padlock in browser)

## Troubleshooting

### Tunnel Container Keeps Restarting

**Check logs:**
```bash
docker compose -f docker-compose.prod.yml logs tunnel --tail 50
```

**Common causes:**
- Invalid token → Verify `CLOUDFLARE_TUNNEL_TOKEN` in `.env`
- Token not in quotes → Should be: `CLOUDFLARE_TUNNEL_TOKEN=eyJh...` (no quotes)
- Missing `.env` file → Run `deploy-wsl-debian.sh` again

### 502 Bad Gateway Error

**Cause**: Cloudflare can't reach the nginx service

**Solutions:**
1. Verify nginx is running:
   ```bash
   docker compose -f docker-compose.prod.yml ps nginx
   ```

2. Check service name in Cloudflare config:
   - Should be `nginx:80` (NOT `localhost:80` or `http://nginx`)

3. Restart all services:
   ```bash
   docker compose -f docker-compose.prod.yml restart
   ```

### SSL/TLS Errors

**Cause**: Cloudflare SSL/TLS mode mismatch

**Solution:**
1. Go to Cloudflare dashboard → SSL/TLS
2. Set encryption mode to **Full** (not "Full (strict)")
3. Wait 5 minutes for changes to propagate

### DNS Not Resolving

**Cause**: DNS not updated or cached

**Solutions:**
- Clear browser cache
- Try incognito/private mode
- Flush DNS: `ipconfig /flushdns` (Windows) or `sudo systemd-resolve --flush-caches` (Linux)
- Check DNS: `nslookup order.yourdomain.com`

### WebSocket Connection Fails

**Cause**: WebSocket headers not properly forwarded

**Verify nginx config** has WebSocket support (should already be configured):
```nginx
location /ws/ {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

**Check Cloudflare settings:**
- WebSockets are automatically supported on all Cloudflare plans
- No additional configuration needed

## Advanced Configuration

### Multiple Environments (Dev/Staging/Prod)

Create separate tunnels for each environment:

1. Create tunnel: `contacless-order-dev`
   - Hostname: `dev-order.yourdomain.com`
   - Service: `nginx:80`

2. Create tunnel: `contacless-order-prod`
   - Hostname: `order.yourdomain.com`
   - Service: `nginx:80`

Use different tokens in each environment's `.env` file.

### Access Control with Zero Trust

Protect admin/kitchen routes with Cloudflare Access:

1. Go to **Zero Trust** → **Access** → **Applications**
2. Click **Add an application** → **Self-hosted**
3. Configure:
   - **Application name**: Kitchen Dashboard
   - **Subdomain**: `order.yourdomain.com`
   - **Path**: `/kitchen/*`
4. Set authentication method (email OTP, Google, etc.)
5. Define access policies (who can access)

### Custom Domain Root (Non-Subdomain)

To use `yourdomain.com` instead of `order.yourdomain.com`:

1. In Cloudflare tunnel public hostname config:
   - **Subdomain**: Leave empty
   - **Domain**: `yourdomain.com`
   - **Service**: `nginx:80`

2. Ensure your domain's DNS A/AAAA records are proxied (orange cloud)

## Monitoring & Maintenance

### Check Tunnel Health

**Via Dashboard:**
- Cloudflare → Zero Trust → Networks → Tunnels
- Look for green "Healthy" status

**Via CLI:**
```bash
docker compose -f docker-compose.prod.yml logs tunnel --tail 100
```

**Expected output:**
```
INF Connection registered
INF Metrics server started
```

### Restart Tunnel

```bash
docker compose -f docker-compose.prod.yml restart tunnel
```

### Update Tunnel Image

```bash
docker compose -f docker-compose.prod.yml pull tunnel
docker compose -f docker-compose.prod.yml up -d tunnel
```

## Security Best Practices

1. **Use Access Policies**: Protect `/admin/*` and `/kitchen/*` routes with Cloudflare Access
2. **Enable Rate Limiting**: Set up Cloudflare Rate Limiting rules for API endpoints
3. **Configure WAF**: Use Cloudflare WAF to block common attacks
4. **Monitor Logs**: Regularly check Cloudflare Analytics and Logs
5. **Rotate Tokens**: Periodically regenerate tunnel tokens and update `.env`
6. **Use Strong Secrets**: Ensure `SECRET_KEY` in `.env` is cryptographically random

## Cost Considerations

**Cloudflare Zero Trust Free Plan:**
- Up to 50 users
- Unlimited tunnels
- Unlimited bandwidth
- Basic DDoS protection

**Paid Plans** (if you need more):
- Zero Trust Standard: $7/user/month
- Advanced features: CASB, DLP, browser isolation

For most restaurant/small business use cases, **the free plan is sufficient**.

## Additional Resources

- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Zero Trust Dashboard](https://one.dash.cloudflare.com/)
- [Cloudflare Community](https://community.cloudflare.com/)
- [Support](https://support.cloudflare.com/)

## Getting Help

If you encounter issues:

1. Check tunnel logs: `docker compose -f docker-compose.prod.yml logs tunnel`
2. Run verification script: `bash scripts/verify-deployment.sh`
3. Review Cloudflare's [status page](https://www.cloudflarestatus.com/)
4. Search [Cloudflare Community forums](https://community.cloudflare.com/)

---

**Next Steps:**
- Configure VietQR payment credentials in `.env`
- Create admin user and seed data
- Set up backup and monitoring
- Configure domain DNS records
