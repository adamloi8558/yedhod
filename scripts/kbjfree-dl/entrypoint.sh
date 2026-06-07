#!/usr/bin/env bash
# Bring up Cloudflare WARP in SOCKS5 proxy mode, then start the worker
# inside Xvfb. WARP gives us a Cloudflare-egress IP which is implicitly
# trusted by Cloudflare's own interstitial and skips the JS challenge.

set -e

mkdir -p /var/lib/cloudflare-warp

echo "[entrypoint] starting warp-svc…"
warp-svc &
WARP_SVC_PID=$!

# wait until the daemon socket is ready
for i in $(seq 1 30); do
    if warp-cli --accept-tos status >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

if ! warp-cli --accept-tos status >/dev/null 2>&1; then
    echo "[entrypoint] warp-svc never became ready"
    exit 1
fi

# Register exactly once. Subsequent boots reuse /var/lib/cloudflare-warp.
if ! warp-cli --accept-tos registration show >/dev/null 2>&1; then
    echo "[entrypoint] registering with WARP…"
    warp-cli --accept-tos registration new
fi

# Switch into proxy mode and connect; warp-cli prints to stderr a lot
warp-cli --accept-tos mode proxy >/dev/null 2>&1 || true
warp-cli --accept-tos proxy port 40000 >/dev/null 2>&1 || true
warp-cli --accept-tos connect >/dev/null 2>&1 || true

# wait for "Status update: Connected"
for i in $(seq 1 30); do
    if warp-cli --accept-tos status 2>/dev/null | grep -q "Connected"; then
        echo "[entrypoint] WARP connected"
        break
    fi
    sleep 1
done

if ! warp-cli --accept-tos status 2>/dev/null | grep -q "Connected"; then
    echo "[entrypoint] WARP failed to connect — continuing without proxy"
    unset PROXY
fi

# Verify proxy by probing https://1.1.1.1/cdn-cgi/trace through it
if [ -n "$PROXY" ]; then
    if curl --silent --max-time 10 --socks5-hostname 127.0.0.1:40000 https://1.1.1.1/cdn-cgi/trace | grep -q "warp=on"; then
        echo "[entrypoint] verified: traffic routes via WARP"
    else
        echo "[entrypoint] WARP probe failed; will retry inside worker"
    fi
fi

echo "[entrypoint] starting Xvfb on :99"
Xvfb :99 -screen 0 1280x800x24 -nolisten tcp &
XVFB_PID=$!
sleep 2
export DISPLAY=:99

# Final verification: confirm the SOCKS5 proxy is actually serving
# before we hand off to the worker.
for i in $(seq 1 30); do
    if curl --silent --max-time 4 --socks5-hostname 127.0.0.1:40000 https://1.1.1.1/cdn-cgi/trace | grep -q "warp=on"; then
        echo "[entrypoint] SOCKS5 proxy ready (warp=on)"
        break
    fi
    sleep 2
done

echo "[entrypoint] Xvfb pid=$XVFB_PID DISPLAY=$DISPLAY"
echo "[entrypoint] launching worker (pnpm start)"
exec pnpm start
