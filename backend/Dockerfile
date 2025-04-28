FROM ubuntu:20.04

# Install required dependencies
RUN set -x \
  && apt-get update \
  && apt-get install -y \
    net-tools \
    build-essential \
    python3 \
    iputils-ping \
    iproute2 \
    curl \
    python3-pip \
    valgrind \
    libstdc++6 \
    libgcc1 \
    libc6 \
    libmicrohttpd12 \
    libssl-dev \
    libcurl4-openssl-dev \
    libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
  && apt-get install -y nodejs

WORKDIR /

COPY package.json .
RUN npm install
COPY . .

RUN npm run build

CMD ["npm", "run", "start:prod"]