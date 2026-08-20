#!/usr/bin/env bash
# Generate the CA + server certificate for the MQTT broker.
#
#   ./gen-certs.sh api.fptest.com
#
# Produces docker/mosquitto/certs/{ca.crt,ca.key,server.crt,server.key}.
# ca.crt is the file every Raspberry Pi needs; ca.key never leaves this machine.
set -euo pipefail

HOST="${1:-api.fptest.com}"
DAYS_CA=3650
DAYS_SRV=825          # browsers/openssl reject longer leaf certs
DIR="$(cd "$(dirname "$0")" && pwd)/certs"

mkdir -p "$DIR"
cd "$DIR"

if [ -f ca.crt ]; then
  echo "ca.crt already exists in $DIR — refusing to overwrite."
  echo "Delete it first if you really mean to re-issue the whole fleet's trust root."
  exit 1
fi

echo "==> CA"
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days "$DAYS_CA" -out ca.crt \
  -subj "/C=SE/O=FP Analyzer/CN=FP Analyzer MQTT CA"

echo "==> server key + CSR for $HOST"
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr -subj "/C=SE/O=FP Analyzer/CN=$HOST"

cat > server.ext <<EXT
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = DNS:$HOST
EXT

echo "==> signing"
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days "$DAYS_SRV" -sha256 -extfile server.ext

rm -f server.csr server.ext ca.srl
chmod 600 ca.key server.key
chmod 644 ca.crt server.crt

echo
echo "Done. Files in $DIR:"
ls -l ca.crt server.crt server.key
echo
echo "Next:"
echo "  1. Copy ca.crt to every Raspberry Pi as /etc/fpanalyzer/ca.crt"
echo "  2. Keep ca.key offline — it is the trust root for the whole fleet"
echo "  3. Server cert expires in $DAYS_SRV days ($(date -v +${DAYS_SRV}d '+%Y-%m-%d' 2>/dev/null || date -d "+${DAYS_SRV} days" '+%Y-%m-%d')) — set a reminder"
