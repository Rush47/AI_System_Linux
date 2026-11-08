FROM node:22-alpine
WORKDIR /app
COPY *.mjs *.js index.html ./
USER node
EXPOSE 3081
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:3081/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server.mjs"]
