# ---------- Build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Copy source and build
COPY . .
# Optional: allow overriding at build-time (defaults to relative /api)
ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
RUN npm run build

# Guardrail: ensure production bundle doesn't hardcode dev hosts.
# Exclude source maps and a few metadata files from the scan.
RUN set -e; \
  if grep -RIlE '(localhost|127\.0\.0\.1|backend:5000)(:[0-9]{2,5})?' \
        --exclude='*.map' \
        --exclude='asset-manifest.json' \
        --exclude-dir='.git' \
        build/ >/tmp/badfiles; then \
    echo "Found disallowed host patterns in bundle:"; \
    sed 's#^#  - #g' /tmp/badfiles; \
    echo ""; \
    echo "First 20 offending tokens (file:line:token):"; \
    grep -RInH -o -E '(localhost(:[0-9]{2,5})?|127\.0\.0\.1(:[0-9]{2,5})?|backend:5000)' \
         --exclude='*.map' build/ | head -n 20; \
    exit 1; \
  else \
    echo "bundle clean"; \
  fi

# ---------- Runtime stage ----------
FROM nginx:alpine
# Default nginx just serves static files; in prod your EC2 user-data mounts its own nginx config.
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
