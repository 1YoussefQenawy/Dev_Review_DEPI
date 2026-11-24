FROM node:22-slim

WORKDIR /app

# Install openssl for prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

COPY . .

EXPOSE 5000

# Run migrations then start
COPY start.sh ./
RUN chmod +x start.sh
CMD ["./start.sh"]
