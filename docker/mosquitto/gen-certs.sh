#!/usr/bin/env bash
# Generate (or re-issue) the MQTT broker's TLS material.
#
#   ./gen-certs.sh dev.fpanalyzer.se
#
# Produces docker/mosquitto/certs/{ca.crt,ca.key,server.crt,server.key}.
# ca.crt is the file every Raspberry Pi needs; ca.key never leaves this machine.
#
# The server certificate carries the public hostname AND the internal Docker
# service name, because two different clients verify it:
#   - devices connect to the public hostname from outside
#   - the backend connects to mqtts://mqtt:8883 inside the compose network
# Without the internal name the backend fails with "Hostname/IP does not match
# certificate's altnames" and MQTT ingestion silently stops.
#
# Re-running with an existing CA re-issues only the server certificate, so the
# fleet's trust root is preserved and devices keep working.
set -euo pipefail

HOST="${1:-dev.fpanalyzer.se}"
# Internal names the server cert must also cover. Override with EXTRA_SANS.
EXTRA_SANS="${EXTRA_SANS:-mqtt,localhost}"
DAYS_CA=3650
DAYS_SRV=825          # longer leaf certs are rejected by modern clients
DIR="$(cd "$(dirname "$0")" && pwd)/certs"

mkdir -p "$DIR"
cd "$DIR"

if [ -f ca.crt ] && [ -f ca.key ]; then
  echo "==> existing CA found — re-issuing the server certificate only"
  echo "    (the fleet's ca.crt is unchanged, so devices keep trusting it)"
else
  if [ -f ca.crt ] || [ -f ca.key ]; then
    echo "ERROR: found one of ca.crt/ca.key but not both. Refusing to continue." >&2
    exit 1
  fi
  echo "==> CA"
  openssl genrsa -out ca.key 4096
  openssl req -x509 -new -nodes -key ca.key -sha256 -days "$DAYS_CA" -out ca.crt \
    -subj "/C=SE/O=FP Analyzer/CN=FP Analyzer MQTT CA"
fi

# Build the SAN list: the public host plus every internal name.
SAN="DNS:$HOST"
IFS=',' read -ra extras <<< "$EXTRA_SANS"
for e in "${extras[@]}"; do
  e="$(echo "$e" | xargs)"                       # trim
  [ -z "$e" ] && continue
  [ "$e" = "$HOST" ] && continue                 # no duplicates
  if [[ "$e" =~ ^[0-9.]+$ ]]; then SAN="$SAN,IP:$e"; else SAN="$SAN,DNS:$e"; fi
done

echo "==> server key + CSR for $HOST"
echo "    SANs: $SAN"
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr -subj "/C=SE/O=FP Analyzer/CN=$HOST"

cat > server.ext <<EXT
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = $SAN
EXT

echo "==> signing"
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days "$DAYS_SRV" -sha256 -extfile server.ext

rm -f server.csr server.ext ca.srl
chmod 600 ca.key server.key
chmod 644 ca.crt server.crt

echo
openssl x509 -in server.crt -noout -subject -ext subjectAltName -enddate
echo
echo "Next:"
echo "  1. Copy ca.crt to every Raspberry Pi as /etc/fpanalyzer/ca.crt"
echo "  2. Keep ca.key offline — it is the trust root for the whole fleet"
echo "  3. Restart the broker and the backend so both pick up the new certificate"
