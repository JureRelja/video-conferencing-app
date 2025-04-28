FROM ubuntu

# Install DEB dependencies and others.
RUN set -x \
  && apt-get update \
  && apt-get install -y \
		pip \
    net-tools \
    build-essential \
    python3 \
    iputils-ping \
    iproute2 \
    curl \
    python3-pip

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs

WORKDIR /

COPY package.json .
COPY . .

RUN rm -rf node_modules package-lock.json

RUN npm install

RUN npm run build

EXPOSE 3001
EXPOSE 2000-3000

CMD ["npm", "run", "start:prod"]
