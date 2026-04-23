#!/usr/bin/env bash
# Run the SHCP API locally with .env loaded.
# Usage: bash run.sh
set -a
source ../../.env
set +a
exec ./mvnw spring-boot:run
