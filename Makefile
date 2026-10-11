.PHONY: all install build test start-server start-client clean docker-up docker-down

all: build test

install:
	cd server && npm install
	cd client && npm install

build:
	cd server && npm run build
	cd client && npm run build

test:
	cd server && npm test

start-server:
	cd server && npm start

start-client:
	cd client && npm run dev

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

clean:
	rm -rf server/dist server/node_modules client/dist client/node_modules
