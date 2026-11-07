FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl xz-utils \
    && curl --fail --location --silent --show-error \
      https://nodejs.org/dist/v24.22.2/node-v24.22.2-linux-x64.tar.xz \
      --output /tmp/node.tar.xz \
    && echo "48cc0e21e048790e54c0cf5749c2725005313d652651c40b7a21feb9697aaf75  /tmp/node.tar.xz" \
      | sha256sum --check --status \
    && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \
    && rm /tmp/node.tar.xz \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force \
    && useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin mcp

COPY --chown=10001:10001 server.js ./

USER 10001:10001
EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
    CMD node -e "fetch('http://127.0.0.1:8000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
