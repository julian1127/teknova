#!/bin/bash
cd "$(dirname "$0")"
exec python3 server.py > /tmp/teknova-server.log 2>&1
