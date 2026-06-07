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
# before we wrap it.
for i in $(seq 1 30); do
    if curl --silent --max-time 4 --socks5-hostname 127.0.0.1:40000 https://1.1.1.1/cdn-cgi/trace | grep -q "warp=on"; then
        echo "[entrypoint] SOCKS5 proxy ready (warp=on)"
        break
    fi
    sleep 2
done

# Camoufox-js's launcher feeds Playwright proxy.server = URL.origin,
# and URL.origin is "null" for socks5:// URLs — Firefox then can't
# resolve the proxy and throws NS_ERROR_UNKNOWN_PROXY_HOST. Workaround:
# expose an HTTP-proxy frontend on 127.0.0.1:41000 that forwards to the
# WARP SOCKS5 backend. gost makes this a one-liner.
echo "[entrypoint] starting gost http→socks5 bridge on 127.0.0.1:41000"
gost -L "http://127.0.0.1:41000" -F "socks5://127.0.0.1:40000" &
GOST_PID=$!
sleep 2

for i in $(seq 1 10); do
    if curl --silent --max-time 4 -x http://127.0.0.1:41000 https://1.1.1.1/cdn-cgi/trace | grep -q "warp=on"; then
        echo "[entrypoint] HTTP proxy ready (warp=on via gost pid=$GOST_PID)"
        break
    fi
    sleep 2
done

# Override the PROXY env so Camoufox sees the http://... URL.
export PROXY="http://127.0.0.1:41000"
echo "[entrypoint] Xvfb pid=$XVFB_PID DISPLAY=$DISPLAY PROXY=$PROXY"
echo "[entrypoint] launching worker (pnpm start)"
exec pnpm start
