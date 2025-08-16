# Build stage
FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
#ensure no frontend env files leak into the production build
RUN rm -f .env .env.* || true

# (optional) you can also force an empty var:
# ENV REACT_APP_API_URL=

RUN npm run build

# Guardrail: fail if any localhost-ish host sneaks into the bundle,
# but keep output short and readable.
# Remove sourcemaps so they can't trip the check
RUN find build -type f -name "*.map" -delete || true

# Fail if the bundle contains explicit network endpoints, but allow CRA's plain 'localhost'
RUN set -e; \
  if grep -RIlE '(https?://localhost(:[0-9]{2,5})?|localhost:[0-9]{2,5}|127\.0\.0\.1(:[0-9]{2,5})?|backend:5000)' build/ >/tmp/badfiles; then \
    echo "Found disallowed host patterns in bundle:"; \
    sed 's#^#  - #' /tmp/badfiles; echo ""; \
    echo "First 20 offending tokens (file:line:token):"; \
    grep -RInH -o -E '(https?://localhost(:[0-9]{2,5})?|localhost:[0-9]{2,5}|127\.0\.0\.1(:[0-9]{2,5})?|backend:5000)' build/ | head -n 20; \
    exit 1; \
  else \
    echo "bundle clean"; \
  fi


# Prod stage
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
