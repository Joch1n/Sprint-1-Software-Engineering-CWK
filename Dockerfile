# Use a stable Node version
FROM node:18

WORKDIR /usr/src/app

# Copy dependency files first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of the app
COPY . .

# Expose port 3001
EXPOSE 3001

# Run the server
CMD ["node", "server.js"]
