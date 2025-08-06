# SquiggleConf 2025 Notes Makefile - FreeBSD

# Project Configuration
PROJECT_NAME := squiggleconf-2025
PROJECT_ROOT := $(shell pwd)

.PHONY: all validate-org lint-basic lint lint-shell lint-js lint-go lint-rust lint-python lint-json lint-fennel lint-janet lint-hy lint-racket lint-ocaml lint-zig lint-ruby lint-clojure tangle export-html export-pdf export-md export clean help tmux-emacs tmux-scheme

# Build target (not default)
all: validate-org tangle ## Run validation and tangle

# Default target
.DEFAULT_GOAL := help

# Validate org files
validate-org: ## Simple check that Org files can be loaded
	@echo "Validating Org files..."
	@emacs --batch --load tools/emacs/validate-org.el

# Basic lint without checking languages
lint-basic: ## Check Org files for issues (ignoring language warnings)
	@echo "Basic linting of Org files (ignoring language warnings)..."
	@emacs --batch --load tools/emacs/lint-org.el

# Comprehensive linting of all files and tangled code
lint: lint-basic ## Lint all Org files and tangled code
	@$(MAKE) -s lint-shell
	@$(MAKE) -s lint-js
	@$(MAKE) -s lint-go
	@$(MAKE) -s lint-rust
	@$(MAKE) -s lint-python
	@$(MAKE) -s lint-json
	@$(MAKE) -s lint-fennel
	@$(MAKE) -s lint-janet
	@$(MAKE) -s lint-hy
	@$(MAKE) -s lint-racket
	@$(MAKE) -s lint-ocaml
	@$(MAKE) -s lint-zig
	@$(MAKE) -s lint-ruby
	@$(MAKE) -s lint-clojure
	@echo "All linting completed"

# Shell script linting
lint-shell: ## Lint tangled shell scripts with shellcheck and shfmt
	@echo "Linting shell scripts..."
	@find . -path "./exports" -prune -o -name "*.sh" -print -o -name "*.bash" -print | xargs -I{} sh -c 'shellcheck -S warning {} 2>/dev/null || true'
	@find . -path "./exports" -prune -o -name "*.sh" -print -o -name "*.bash" -print | xargs -I{} sh -c 'shfmt -d -i 2 -ci {} 2>/dev/null || true'

# JavaScript/TypeScript linting
lint-js: ## Lint tangled JavaScript/TypeScript files with tsc
	@echo "Linting JavaScript/TypeScript files..."
	@find . -path "./exports" -prune -o -name "*.ts" -print | xargs -I{} sh -c 'tsc --noEmit --allowJs {} 2>/dev/null || true'
	@find . -path "./exports" -prune -o -name "*.js" -print -o -name "*.ts" -print | xargs -I{} sh -c 'eslint --no-eslintrc --no-ignore {} 2>/dev/null || true'

# Go linting
lint-go: ## Lint tangled Go files with gofmt
	@echo "Linting Go files..."
	@find . -path "./exports" -prune -o -name "*.go" -print | xargs -I{} sh -c 'gofmt -d {} 2>/dev/null || true'

# Rust linting
lint-rust: ## Lint tangled Rust files with rustfmt
	@echo "Linting Rust files..."
	@find . -path "./exports" -prune -o -name "*.rs" -print | xargs -I{} sh -c 'rustfmt --check {} 2>/dev/null || true'

# Python linting
lint-python: ## Lint tangled Python files
	@echo "Linting Python files..."
	@find . -path "./exports" -prune -o -name "*.py" -print | xargs -I{} sh -c 'pylint --disable=all --enable=unused-import,syntax-error,import-error {} 2>/dev/null || true'
	@find . -path "./exports" -prune -o -name "*.py" -print | xargs -I{} sh -c 'ruff check {} 2>/dev/null || true'

# JSON linting
lint-json: ## Lint JSON files
	@echo "Linting JSON files..."
	@find . -path "./exports" -prune -o -name "*.json" -print | xargs -I{} sh -c 'jsonlint -q {} 2>/dev/null || true'

# Fennel linting
lint-fennel: ## Lint Fennel files
	@echo "Linting Fennel files..."
	@find . -path "./exports" -prune -o -name "*.fnl" -print | xargs -I{} sh -c 'fennel --check {} 2>/dev/null || true'

# Janet linting
lint-janet: ## Lint Janet files
	@echo "Linting Janet files..."
	@find . -path "./exports" -prune -o -name "*.janet" -print | xargs -I{} sh -c 'janet -k {} 2>/dev/null || true'

# Hy linting
lint-hy: ## Lint Hy files
	@echo "Linting Hy files..."
	@find . -path "./exports" -prune -o -name "*.hy" -print | xargs -I{} sh -c 'hy -c {} 2>/dev/null || true'

# Racket linting
lint-racket: ## Lint Racket files
	@echo "Linting Racket files..."
	@find . -path "./exports" -prune -o -name "*.rkt" -print | xargs -I{} sh -c 'raco expand {} 2>/dev/null || true'

# OCaml linting
lint-ocaml: ## Lint OCaml files
	@echo "Linting OCaml files..."
	@find . -path "./exports" -prune -o -name "*.ml" -print | xargs -I{} sh -c 'ocamlc -c -w +A {} 2>/dev/null || true'

# Zig linting
lint-zig: ## Lint Zig files
	@echo "Linting Zig files..."
	@find . -path "./exports" -prune -o -name "*.zig" -print | xargs -I{} sh -c 'zig fmt --check {} 2>/dev/null || true'

# Ruby linting
lint-ruby: ## Lint Ruby files
	@echo "Linting Ruby files..."
	@find . -path "./exports" -prune -o -name "*.rb" -print | xargs -I{} sh -c 'ruby -c {} 2>/dev/null || true'

# Clojure linting
lint-clojure: ## Lint Clojure files
	@echo "Linting Clojure files..."
	@find . -path "./exports" -prune -o -name "*.clj" -print | xargs -I{} sh -c 'clojure -e "(load-file \"{}\")" 2>/dev/null || true'

# Tangle org files
tangle: ## Extract code blocks from Org files
	@echo "Tangling Org files..."
	@emacs --batch --load tools/emacs/tangle-org.el

# Export org files to HTML
export-html: ## Export Org files to HTML
	@echo "Exporting Org files to HTML..."
	@mkdir -p exports/html
	@emacs --batch \
		--eval "(require 'org)" \
		--eval "(dolist (file (directory-files-recursively \".\" \"\\.org$$\")) \
			(with-current-buffer (find-file file) \
				(message \"Exporting %s to HTML...\" file) \
				(org-html-export-to-html)))"
	@find . -name "*.html" -exec mv {} exports/html/ \;

# Export org files to PDF
export-pdf: ## Export Org files to PDF
	@echo "Exporting Org files to PDF..."
	@mkdir -p exports/pdf
	@emacs --batch \
		--eval "(require 'org)" \
		--eval "(dolist (file (directory-files-recursively \".\" \"\\.org$$\")) \
			(with-current-buffer (find-file file) \
				(message \"Exporting %s to PDF...\" file) \
				(org-latex-export-to-pdf)))"
	@find . -name "*.pdf" -exec mv {} exports/pdf/ \;

# Export org files to Markdown
export-md: ## Export Org files to Markdown
	@echo "Exporting Org files to Markdown..."
	@mkdir -p exports/markdown
	@emacs --batch \
		--eval "(require 'org)" \
		--eval "(dolist (file (directory-files-recursively \".\" \"\\.org$$\")) \
			(with-current-buffer (find-file file) \
				(message \"Exporting %s to Markdown...\" file) \
				(org-md-export-to-markdown)))"
	@find . -name "*.md" -exec mv {} exports/markdown/ \;

# Export all formats
export: export-html export-pdf export-md ## Export Org files to all formats

# Clean generated files
clean: ## Remove generated files
	@echo "Cleaning generated files..."
	@rm -rf exports
	@find . -name "*.html" -delete
	@find . -name "*.pdf" -delete
	@find . -name "*.tex" -delete

# Tmux + Emacs targets for Scheme development
tmux-emacs: ## Start Emacs with project config in tmux session
	@echo "Starting tmux session '$(PROJECT_NAME)' with project-specific Emacs..."
	@tmux has-session -t $(PROJECT_NAME) 2>/dev/null && tmux kill-session -t $(PROJECT_NAME) || true
	@tmux new-session -d -s $(PROJECT_NAME) "emacs -nw -Q -l $(PROJECT_ROOT)/$(PROJECT_NAME).el"
	@echo "Getting TTY of tmux pane..."
	@tmux list-panes -t $(PROJECT_NAME) -F "TTY: #{pane_tty}"
	@echo ""
	@echo "Tmux session '$(PROJECT_NAME)' started successfully."
	@echo "To attach: tmux attach-session -t $(PROJECT_NAME)"

tmux-scheme: ## Start Emacs with Scheme/Guile config in tmux session
	@echo "Starting tmux session '$(PROJECT_NAME)-scheme' with Scheme development Emacs..."
	@tmux has-session -t $(PROJECT_NAME)-scheme 2>/dev/null && tmux kill-session -t $(PROJECT_NAME)-scheme || true
	@tmux new-session -d -s $(PROJECT_NAME)-scheme "emacs -nw -Q -l $(PROJECT_ROOT)/squiggleconf-scheme.el"
	@echo "Getting TTY of tmux pane..."
	@tmux list-panes -t $(PROJECT_NAME)-scheme -F "TTY: #{pane_tty}"
	@echo ""
	@echo "Tmux session '$(PROJECT_NAME)-scheme' started with Scheme development environment."
	@echo "To attach: tmux attach-session -t $(PROJECT_NAME)-scheme"

# Help message using GNU tools available on FreeBSD
help: ## Show this help message
	@echo "SquiggleConf 2025 Notes Makefile"
	@echo ""
	@echo "Project: $(PROJECT_NAME)"
	@echo "Root: $(PROJECT_ROOT)"
	@echo ""
	@echo "Usage: gmake [target]"
	@echo ""
	@echo "Targets:"
	@ggrep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | gawk 'BEGIN {FS = ":.*## "}; {printf "  %-15s %s\n", $$1, $$2}'