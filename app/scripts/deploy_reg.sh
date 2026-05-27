#!/usr/bin/env bash
set -euo pipefail

# REG.RU deploy helper
# - main_site/* -> remote site root
# - project root (except main_site) -> remote /app

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

DEPLOY_HOST="${DEPLOY_HOST:-saran-edu.ru}"
DEPLOY_USER="${DEPLOY_USER:-u3494432}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
REMOTE_ROOT="${REMOTE_ROOT:-~/www/saran-edu.ru}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-${REMOTE_ROOT}/app}"
DEPLOY_DRY_RUN="${DEPLOY_DRY_RUN:-0}"

SSH_BIN="ssh"
RSYNC_BIN="rsync"
SSH_BASE_OPTS="-p ${DEPLOY_PORT} -o StrictHostKeyChecking=accept-new"

if [[ -n "${DEPLOY_PASSWORD:-}" ]]; then
  if command -v sshpass >/dev/null 2>&1; then
    SSH_BIN="sshpass -p ${DEPLOY_PASSWORD} ssh"
    RSYNC_BIN="sshpass -p ${DEPLOY_PASSWORD} rsync"
  else
    echo "DEPLOY_PASSWORD задан, но sshpass не установлен."
    echo "Установите sshpass или настройте вход по SSH-ключу."
    exit 1
  fi
fi

usage() {
  cat <<'EOF'
Использование:
  ./scripts/deploy_reg.sh inspect
  ./scripts/deploy_reg.sh deploy

Опциональные переменные окружения:
  DEPLOY_HOST=saran-edu.ru
  DEPLOY_USER=u3494432
  DEPLOY_PORT=22
  REMOTE_ROOT=~/www/saran-edu.ru
  REMOTE_APP_DIR=~/www/saran-edu.ru/app
  DEPLOY_DRY_RUN=1            # предпросмотр rsync без изменений
  DEPLOY_PASSWORD=...         # только если установлен sshpass
EOF
}

run_ssh() {
  # shellcheck disable=SC2086
  ${SSH_BIN} ${SSH_BASE_OPTS} "${DEPLOY_USER}@${DEPLOY_HOST}" "$@"
}

run_rsync() {
  local source="$1"
  local target="$2"
  shift 2
  local dry_flag=()
  if [[ "${DEPLOY_DRY_RUN}" == "1" ]]; then
    dry_flag=(-n)
  fi
  # shellcheck disable=SC2086
  ${RSYNC_BIN} -az --delete --progress "${dry_flag[@]}" \
    -e "ssh ${SSH_BASE_OPTS}" "$@" "${source}" "${DEPLOY_USER}@${DEPLOY_HOST}:${target}"
}

inspect_remote() {
  echo "== Проверка удаленной структуры =="
  run_ssh "pwd; echo '---'; ls -la ~; echo '---'; ls -la ${REMOTE_ROOT} || true; echo '---'; ls -la ${REMOTE_APP_DIR} || true"
}

deploy() {
  if [[ ! -d "${PROJECT_ROOT}/main_site" ]]; then
    echo "Не найдена папка main_site в ${PROJECT_ROOT}"
    exit 1
  fi
  if [[ ! -f "${PROJECT_ROOT}/main_site/index.html" ]]; then
    echo "Не найден файл main_site/index.html"
    exit 1
  fi

  echo "== Подготовка удаленных каталогов =="
  run_ssh "mkdir -p ${REMOTE_ROOT} ${REMOTE_APP_DIR}"

  echo "== Шаг 1: main_site -> корень сайта (${REMOTE_ROOT}) =="
  run_rsync "${PROJECT_ROOT}/main_site/" "${REMOTE_ROOT}/"

  echo "== Шаг 2: проект (кроме main_site) -> ${REMOTE_APP_DIR} =="
  run_rsync "${PROJECT_ROOT}/" "${REMOTE_APP_DIR}/" \
    --exclude ".git/" \
    --exclude ".vscode/" \
    --exclude "main_site/" \
    --exclude "Archive.zip" \
    --exclude ".DS_Store" \
    --exclude ".env" \
    --exclude "node_modules/" \
    --exclude "__pycache__/"

  echo "== Готово =="
}

main() {
  local cmd="${1:-}"
  case "${cmd}" in
    inspect) inspect_remote ;;
    deploy) deploy ;;
    *) usage; exit 1 ;;
  esac
}

main "${1:-}"
