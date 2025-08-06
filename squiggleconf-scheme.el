;;; squiggleconf-scheme.el --- Scheme development configuration for SquiggleConf 2025 -*- lexical-binding: t; -*-

;; Author: SquiggleConf 2025
;; Created: 2025
;; Description: Complete Scheme/Guile development environment with Geiser, TRAMP, and paredit

;;; Commentary:
;; This configuration provides a comprehensive Scheme development environment
;; optimized for Guile 3, including REPL integration, structural editing,
;; remote development support, and org-mode integration.

;;; Code:

;;;; Package Management
(require 'package)
(setq package-archives '(("melpa" . "https://melpa.org/packages/")
                         ("gnu" . "https://elpa.gnu.org/packages/")))

(package-initialize)

;; Ensure required packages are installed
(defvar squiggleconf-scheme-packages
  '(geiser
    geiser-guile
    paredit
    rainbow-delimiters
    company
    flycheck
    flycheck-guile
    magit)
  "List of packages required for Scheme development.")

(defun squiggleconf-ensure-packages ()
  "Ensure all required packages are installed."
  (package-refresh-contents)
  (dolist (package squiggleconf-scheme-packages)
    (unless (package-installed-p package)
      (package-install package))))

;; Install packages if needed (comment out if packages are already installed)
;; (squiggleconf-ensure-packages)

;;;; Geiser Configuration for Guile 3
(with-eval-after-load 'geiser
  ;; Set Guile as the default Scheme implementation
  (setq geiser-default-implementation 'guile)
  
  ;; Guile 3 specific settings
  (setq geiser-guile-binary "guile3"
        geiser-guile-load-path '("." "./src" "./lib")
        geiser-guile-init-file "~/.guile"
        geiser-guile-debug-show-bt-p t
        geiser-guile-jump-on-debug-p t
        geiser-guile-show-debug-help-p t
        geiser-guile-warning-level 'high)
  
  ;; REPL settings
  (setq geiser-repl-history-filename "~/.emacs.d/geiser-history"
        geiser-repl-query-on-kill-p nil
        geiser-repl-query-on-exit-p t
        geiser-repl-use-other-window t
        geiser-repl-autoeval-mode-lighter " ⟳")
  
  ;; Autodoc and completion
  (setq geiser-autodoc-delay 0.3
        geiser-autodoc-display-module-p t
        geiser-autodoc-identifier-format "%s → %s"
        geiser-completion-use-company t)
  
  ;; Debug settings
  (setq geiser-debug-jump-to-debug-p t
        geiser-debug-show-debug-p t))

;;;; Paredit Configuration
(autoload 'enable-paredit-mode "paredit"
  "Turn on pseudo-structural editing of Lisp code." t)

(defun squiggleconf-scheme-mode-setup ()
  "Setup function for Scheme mode."
  (enable-paredit-mode)
  (rainbow-delimiters-mode 1)
  (company-mode 1)
  (eldoc-mode 1)
  (show-paren-mode 1)
  (electric-pair-mode -1)  ; Disable electric-pair when using paredit
  
  ;; Custom key bindings for Scheme
  (local-set-key (kbd "C-c C-k") 'geiser-compile-current-buffer)
  (local-set-key (kbd "C-c C-l") 'geiser-load-file)
  (local-set-key (kbd "C-c C-d C-d") 'geiser-doc-symbol-at-point)
  (local-set-key (kbd "C-c C-d C-m") 'geiser-doc-module)
  (local-set-key (kbd "C-c C-d C-a") 'geiser-autodoc-mode)
  (local-set-key (kbd "C-c C-z") 'geiser-mode-switch-to-repl)
  (local-set-key (kbd "C-c C-a") 'geiser-mode-switch-to-repl-and-enter)
  
  ;; Paredit keybindings reminder
  (local-set-key (kbd "C-c C-h") 'paredit-cheat-sheet))

;; Apply setup to Scheme modes
(add-hook 'scheme-mode-hook #'squiggleconf-scheme-mode-setup)
(add-hook 'geiser-repl-mode-hook #'enable-paredit-mode)
(add-hook 'geiser-repl-mode-hook #'rainbow-delimiters-mode)

;;;; Company Configuration for Scheme
(with-eval-after-load 'company
  (setq company-idle-delay 0.2
        company-minimum-prefix-length 2
        company-tooltip-align-annotations t
        company-tooltip-flip-when-above t)
  
  ;; Add Geiser backend for Scheme completion
  (add-to-list 'company-backends 'geiser-company-backend))

;;;; Flycheck Configuration for Guile
(with-eval-after-load 'flycheck
  (require 'flycheck-guile nil t)
  (add-hook 'scheme-mode-hook #'flycheck-mode))

;;;; TRAMP Configuration for Remote Development
(require 'tramp)

(setq tramp-default-method "ssh"
      tramp-verbose 3
      tramp-use-ssh-controlmaster-options t
      tramp-persistency-file-name "~/.emacs.d/tramp")

;; Custom TRAMP method for Guile remote execution
(add-to-list 'tramp-methods
             '("guile-ssh"
               (tramp-login-program "ssh")
               (tramp-login-args (("-l" "%u") ("-p" "%p") ("%c")
                                 ("-e" "none") ("%h")))
               (tramp-async-args (("-q")))
               (tramp-remote-shell "/bin/sh")
               (tramp-remote-shell-login ("-l"))
               (tramp-remote-shell-args ("-c"))
               (tramp-gw-args (("-o" "GlobalKnownHostsFile=/dev/null")
                              ("-o" "UserKnownHostsFile=/dev/null")
                              ("-o" "StrictHostKeyChecking=no")))
               (tramp-default-port 22)))

;; Function to connect to remote Guile REPL
(defun squiggleconf-connect-remote-guile (host)
  "Connect to a remote Guile REPL on HOST."
  (interactive "sHost: ")
  (let ((geiser-guile-binary (format "/ssh:%s:guile3" host)))
    (geiser 'guile)))

;;;; Org-mode Integration for Literate Programming
(with-eval-after-load 'org
  ;; Enable Scheme code blocks in org-mode
  (org-babel-do-load-languages
   'org-babel-load-languages
   '((scheme . t)))
  
  ;; Custom Guile evaluation for org-babel
  (defun org-babel-execute:scheme (body params)
    "Execute a block of Scheme code with org-babel using Geiser."
    (let* ((result-type (cdr (assoc :result-type params)))
           (impl (or (cdr (assoc :scheme params)) 
                    geiser-default-implementation))
           (geiser-impl impl))
      (geiser-eval-region (point-min) (point-max))
      (geiser-eval-last-sexp nil)))
  
  ;; Default header arguments for Scheme blocks
  (setq org-babel-default-header-args:scheme
        '((:results . "output")
          (:exports . "both")
          (:session . "geiser-repl"))))

;;;; Project-specific Scheme Configuration
(defgroup squiggleconf-scheme nil
  "SquiggleConf Scheme development configuration."
  :group 'scheme)

(defcustom squiggleconf-scheme-project-root
  (or (getenv "PROJECT_ROOT") default-directory)
  "Root directory of the SquiggleConf project."
  :type 'directory
  :group 'squiggleconf-scheme)

(defcustom squiggleconf-scheme-source-dirs
  '("src" "lib" "tests" "examples")
  "List of source directories for Scheme code."
  :type '(repeat string)
  :group 'squiggleconf-scheme)

;; Add project directories to Guile load path
(defun squiggleconf-setup-guile-paths ()
  "Setup Guile load paths for the project."
  (let ((paths (mapcar (lambda (dir)
                        (expand-file-name dir squiggleconf-scheme-project-root))
                      squiggleconf-scheme-source-dirs)))
    (setq geiser-guile-load-path (append geiser-guile-load-path paths))))

(add-hook 'scheme-mode-hook #'squiggleconf-setup-guile-paths)

;;;; Custom Scheme Development Commands
(defun squiggleconf-scheme-run-tests ()
  "Run Scheme tests for the current project."
  (interactive)
  (let ((test-file (expand-file-name "tests/run-tests.scm" 
                                     squiggleconf-scheme-project-root)))
    (if (file-exists-p test-file)
        (geiser-load-file test-file)
      (message "Test file not found: %s" test-file))))

(defun squiggleconf-scheme-compile-project ()
  "Compile all Scheme files in the project."
  (interactive)
  (dolist (dir squiggleconf-scheme-source-dirs)
    (let ((full-dir (expand-file-name dir squiggleconf-scheme-project-root)))
      (when (file-directory-p full-dir)
        (dolist (file (directory-files full-dir t "\\.scm$"))
          (geiser-compile-file file))))))

(defun squiggleconf-scheme-format-buffer ()
  "Format the current Scheme buffer using paredit."
  (interactive)
  (when (bound-and-true-p paredit-mode)
    (save-excursion
      (goto-char (point-min))
      (paredit-reindent-defun)
      (while (paredit-forward-down)
        (paredit-reindent-defun)))))

(defun squiggleconf-paredit-cheat-sheet ()
  "Display paredit cheat sheet in a temporary buffer."
  (interactive)
  (with-output-to-temp-buffer "*Paredit Cheat Sheet*"
    (princ "PAREDIT CHEAT SHEET

BASIC MOVEMENT:
  C-M-f    - Forward s-expression
  C-M-b    - Backward s-expression
  C-M-d    - Down into list
  C-M-u    - Up out of list
  C-M-n    - Forward to next list
  C-M-p    - Backward to previous list

DEPTH-CHANGING:
  M-(      - Wrap with parens
  M-s      - Splice (remove parens)
  M-<up>   - Splice killing backward
  M-<down> - Splice killing forward
  M-r      - Raise s-expression

SLURPAGE & BARFAGE:
  C-)      - Slurp forward
  C-}      - Barf forward
  C-(      - Slurp backward
  C-{      - Barf backward

KILLING:
  C-k      - Kill to end of list
  M-d      - Forward kill word
  M-DEL    - Backward kill word

MISC:
  M-;      - Comment/uncomment
  C-j      - New line and indent
  M-q      - Reindent s-expression
  M-J      - Join lines
")))

;;;; Mode Line Enhancement
(defun squiggleconf-scheme-mode-line ()
  "Enhanced mode line for Scheme development."
  (setq mode-line-format
        '("%e"
          mode-line-front-space
          mode-line-mule-info
          mode-line-client
          mode-line-modified
          mode-line-remote
          mode-line-frame-identification
          mode-line-buffer-identification
          "  "
          mode-line-position
          "  "
          (:eval (when (bound-and-true-p geiser-mode)
                   (format "[Geiser:%s]" geiser-impl--implementation)))
          "  "
          (:eval (when (bound-and-true-p paredit-mode) "[Paredit]"))
          "  "
          mode-line-modes
          mode-line-misc-info
          mode-line-end-spaces)))

(add-hook 'scheme-mode-hook #'squiggleconf-scheme-mode-line)

;;;; Keybindings
(defvar squiggleconf-scheme-mode-map
  (let ((map (make-sparse-keymap)))
    ;; Development commands
    (define-key map (kbd "C-c s t") 'squiggleconf-scheme-run-tests)
    (define-key map (kbd "C-c s c") 'squiggleconf-scheme-compile-project)
    (define-key map (kbd "C-c s f") 'squiggleconf-scheme-format-buffer)
    (define-key map (kbd "C-c s r") 'squiggleconf-connect-remote-guile)
    (define-key map (kbd "C-c s h") 'squiggleconf-paredit-cheat-sheet)
    ;; Geiser shortcuts
    (define-key map (kbd "C-c g z") 'geiser-mode-switch-to-repl)
    (define-key map (kbd "C-c g d") 'geiser-doc-symbol-at-point)
    (define-key map (kbd "C-c g l") 'geiser-load-file)
    (define-key map (kbd "C-c g k") 'geiser-compile-current-buffer)
    map)
  "Keymap for SquiggleConf Scheme development.")

;; Apply keymap to Scheme mode
(add-hook 'scheme-mode-hook
          (lambda () (use-local-map 
                     (make-composed-keymap squiggleconf-scheme-mode-map
                                          scheme-mode-map))))

;;;; Initialize
(defun squiggleconf-scheme-initialize ()
  "Initialize SquiggleConf Scheme development environment."
  (interactive)
  (message "Initializing SquiggleConf Scheme environment...")
  (squiggleconf-setup-guile-paths)
  (when (y-or-n-p "Start Geiser REPL? ")
    (geiser 'guile))
  (message "SquiggleConf Scheme environment ready!"))

;; Load existing SquiggleConf configuration if available
(let ((main-config (expand-file-name "squiggleconf-2025.el"
                                     (or (getenv "PROJECT_ROOT") 
                                         default-directory))))
  (when (file-exists-p main-config)
    (load main-config)))

;; Display welcome message
(message "SquiggleConf Scheme Development Environment Loaded
  C-c s h - Show paredit cheat sheet
  C-c g z - Switch to REPL
  C-c s t - Run tests
  C-c s c - Compile project")

(provide 'squiggleconf-scheme)
;;; squiggleconf-scheme.el ends here