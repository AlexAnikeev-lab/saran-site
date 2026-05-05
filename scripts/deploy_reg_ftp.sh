#!/usr/bin/env bash
set -euo pipefail

# FTP deploy for REG.RU without SSH.
# Layout:
#   main_site/*   -> remote web root
#   project/*     -> remote /app (except main_site and excluded files)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

FTP_HOST="${FTP_HOST:-saran-edu.ru}"
FTP_USER="${FTP_USER:-}"
FTP_PASS="${FTP_PASS:-}"
FTP_ROOT="${FTP_ROOT:-/}"
FTP_APP_DIR="${FTP_APP_DIR:-/app}"
DEPLOY_DRY_RUN="${DEPLOY_DRY_RUN:-0}"

if ! command -v lftp >/dev/null 2>&1; then
  echo "Не найден lftp. Установите: brew install lftp"
  exit 1
fi

if [[ -z "${FTP_USER}" || -z "${FTP_PASS}" ]]; then
  echo "Нужно задать FTP_USER и FTP_PASS."
  echo "Пример:"
  echo "  FTP_USER='u3494432' FTP_PASS='***' ./scripts/deploy_reg_ftp.sh inspect"
  exit 1
fi

usage() {
  cat <<'EOF'
Использование:
  ./scripts/deploy_reg_ftp.sh inspect
  ./scripts/deploy_reg_ftp.sh deploy
  ./scripts/deploy_reg_ftp.sh verify

Переменные окружения:
  FTP_HOST=saran-edu.ru
  FTP_USER=u3494432
  FTP_PASS=...
  FTP_ROOT=/
  FTP_APP_DIR=/app
  DEPLOY_DRY_RUN=1
EOF
}

lftp_run() {
  local script="$1"
  lftp -u "${FTP_USER},${FTP_PASS}" "${FTP_HOST}" -e "
set net:max-retries 1
set net:timeout 12
set cmd:fail-exit yes
set ssl:verify-certificate no
set ftp:ssl-allow yes
set ftp:ssl-force false
${script}
bye
"
}

inspect() {
  echo "== FTP inspect =="
  lftp -u "${FTP_USER},${FTP_PASS}" "${FTP_HOST}" -e "
set net:max-retries 1
set net:timeout 12
set cmd:fail-exit no
set ssl:verify-certificate no
set ftp:ssl-allow yes
set ftp:ssl-force false
pwd
cls -la ${FTP_ROOT}
cls -la ${FTP_APP_DIR}
bye
"
}

verify() {
  echo "== FTP verify =="
  lftp -u "${FTP_USER},${FTP_PASS}" "${FTP_HOST}" -e "
set net:max-retries 1
set net:timeout 12
set cmd:fail-exit yes
set ssl:verify-certificate no
set ftp:ssl-allow yes
set ftp:ssl-force false
cls -la ${FTP_ROOT}
cls -la ${FTP_ROOT}/assets
cls -la ${FTP_APP_DIR}
cls -la ${FTP_APP_DIR}/api
bye
"
}

preflight() {
  echo "== Preflight local =="
  local required=(
    "${PROJECT_ROOT}/main_site/index.html"
    "${PROJECT_ROOT}/index.html"
    "${PROJECT_ROOT}/SaranLogo.jpg"
  )
  local miss=0
  for f in "${required[@]}"; do
    if [[ ! -f "${f}" ]]; then
      echo "Нет файла: ${f}"
      miss=1
    fi
  done
  if [[ "${miss}" != "0" ]]; then
    echo "Preflight не пройден."
    exit 1
  fi
}

deploy() {
  preflight
  if [[ ! -f "${PROJECT_ROOT}/main_site/index.html" ]]; then
    echo "Не найден ${PROJECT_ROOT}/main_site/index.html"
    exit 1
  fi

  local dry=""
  if [[ "${DEPLOY_DRY_RUN}" == "1" ]]; then
    dry="--dry-run"
  fi

  echo "== Шаг 1: main_site -> ${FTP_ROOT} =="
  (
    cd "${PROJECT_ROOT}"
    lftp_run "
set cmd:fail-exit no
mkdir ${FTP_ROOT}
set cmd:fail-exit yes
mirror -R --delete --verbose ${dry} \
  --exclude-glob .DS_Store \
  --exclude-glob ._* \
  --exclude-glob .htaccess \
  --exclude-glob app/ \
  main_site/ ${FTP_ROOT}/
"
  )

  echo "== Шаг 2: project -> ${FTP_APP_DIR} (без main_site и служебного) =="
  (
    cd "${PROJECT_ROOT}"
    lftp_run "
set cmd:fail-exit no
mkdir ${FTP_APP_DIR}
set cmd:fail-exit yes
mirror -R --delete --verbose ${dry} \
  --exclude-glob .git/ \
  --exclude-glob .vscode/ \
  --exclude-glob main_site/ \
  --exclude-glob node_modules/ \
  --exclude-glob __pycache__/ \
  --exclude-glob .DS_Store \
  --exclude-glob .env \
  --exclude-glob Archive.zip \
  ./ ${FTP_APP_DIR}/
"
  )

  echo "== Деплой завершен =="
  verify
}

case "${1:-}" in
  inspect) inspect ;;
  deploy) deploy ;;
  verify) verify ;;
  *) usage; exit 1 ;;
esac
