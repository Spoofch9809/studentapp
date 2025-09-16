# Backend (Node.js + Express)
FROM node:20-alpine
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* ./
# Use npm ci if lockfile exists, otherwise fallback to npm install
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Copy source
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
