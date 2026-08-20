#!/bin/sh
# Render mosquitto.conf from a template, substituting credentials from the
# environment, then hand off to mosquitto. Keeps the DB password out of git.
#
# MQTT_MODE=tls   (default) -> mosquitto.conf.template,     listener 8883, certs required
# MQTT_MODE=plain           -> mosquitto.conf.dev.template, listener 1883, no certs
set -e

: "${MQTT_PG_HOST:=postgres}"
: "${MQTT_PG_PORT:=5432}"
: "${MQTT_PG_DATABASE:=fp_analyzer}"
: "${MQTT_PG_SSLMODE:=disable}"
: "${MQTT_MODE:=tls}"

if [ -z "$MQTT_PG_USER" ] || [ -z "$MQTT_PG_PASSWORD" ]; then
  echo "FATAL: MQTT_PG_USER and MQTT_PG_PASSWORD must be set" >&2
  exit 1
fi

case "$MQTT_MODE" in
  tls)
    TEMPLATE=/mosquitto/config/mosquitto.conf.template
    for f in ca.crt server.crt server.key; do
      if [ ! -f "/mosquitto/certs/$f" ]; then
        echo "FATAL: missing /mosquitto/certs/$f — run docker/mosquitto/gen-certs.sh" >&2
        exit 1
      fi
    done
    PORT=8883
    ;;
  plain)
    TEMPLATE=/mosquitto/config/mosquitto.conf.dev.template
    PORT=1883
    echo "[entrypoint] WARNING: plain MQTT mode — no TLS. Development only." >&2
    ;;
  *)
    echo "FATAL: MQTT_MODE must be 'tls' or 'plain', got '$MQTT_MODE'" >&2
    exit 1
    ;;
esac

if [ ! -f "$TEMPLATE" ]; then
  echo "FATAL: template not found: $TEMPLATE" >&2
  exit 1
fi

# Substitute with sed, not envsubst — the broker image ships neither gettext nor
# envsubst, and a missing binary here fails the container into a restart loop.
# Values are escaped for sed's replacement side (\ & and the | delimiter).
esc() { printf '%s' "$1" | sed -e 's/[\\&|]/\\&/g'; }

sed \
  -e "s|[$]{MQTT_PG_HOST}|$(esc "$MQTT_PG_HOST")|g" \
  -e "s|[$]{MQTT_PG_PORT}|$(esc "$MQTT_PG_PORT")|g" \
  -e "s|[$]{MQTT_PG_DATABASE}|$(esc "$MQTT_PG_DATABASE")|g" \
  -e "s|[$]{MQTT_PG_USER}|$(esc "$MQTT_PG_USER")|g" \
  -e "s|[$]{MQTT_PG_PASSWORD}|$(esc "$MQTT_PG_PASSWORD")|g" \
  -e "s|[$]{MQTT_PG_SSLMODE}|$(esc "$MQTT_PG_SSLMODE")|g" \
  "$TEMPLATE" > /mosquitto/config/mosquitto.conf
chmod 600 /mosquitto/config/mosquitto.conf

if grep -q '[$]{MQTT_' /mosquitto/config/mosquitto.conf; then
  echo "FATAL: unsubstituted placeholders remain in mosquitto.conf:" >&2
  grep -n '[$]{MQTT_' /mosquitto/config/mosquitto.conf >&2
  exit 1
fi

echo "[entrypoint] rendered $TEMPLATE; starting mosquitto on $PORT (mode=$MQTT_MODE)"
exec /usr/sbin/mosquitto -c /mosquitto/config/mosquitto.conf
