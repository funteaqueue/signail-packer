# Convenience wrappers around Docker Compose for dev and production.
#
# All Node/npm/CRA work happens inside Docker per the repo guidelines — never
# run a host-native Node against this project.

DEV_COMPOSE  := docker-compose.yml
PROD_COMPOSE := docker-compose.prod.yml

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# ---- Development ----------------------------------------------------------

.PHONY: dev
dev: ## Start the dev stack with hot reload (foreground)
	docker compose -f $(DEV_COMPOSE) up --build

.PHONY: dev-down
dev-down: ## Stop the dev stack
	docker compose -f $(DEV_COMPOSE) down

# ---- Production -----------------------------------------------------------

.PHONY: prod-build
prod-build: ## Build the production images
	docker compose -f $(PROD_COMPOSE) build

.PHONY: prod-rebuild
prod-rebuild: ## Rebuild production images from scratch (no cache)
	docker compose -f $(PROD_COMPOSE) build --no-cache

.PHONY: prod-up
prod-up: ## Build (if needed) and start the production stack in the background
	docker compose -f $(PROD_COMPOSE) up --build -d

.PHONY: prod-restart
prod-restart: ## Rebuild from scratch and restart the production stack
	docker compose -f $(PROD_COMPOSE) up --build --force-recreate -d

.PHONY: prod-down
prod-down: ## Stop the production stack
	docker compose -f $(PROD_COMPOSE) down

.PHONY: prod-logs
prod-logs: ## Tail logs from the production stack
	docker compose -f $(PROD_COMPOSE) logs -f

.PHONY: prod-ps
prod-ps: ## Show production container status
	docker compose -f $(PROD_COMPOSE) ps
