FROM node:16 AS stage-one

# Install DEB dependencies and others.
RUN set -x \
	&& apt-get update \
	&& apt-get install -y net-tools build-essential python3 python3-pip valgrind

WORKDIR /

COPY package.json .
RUN npm install
COPY . .

# ENV NODE_ENV=production

RUN npm run build

CMD ["npm", "run", "start:prod"]