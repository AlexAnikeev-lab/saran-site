#!/usr/bin/env bash
set -euo pipefail

# One-command deploy wrapper for REG.RU FTP.
# Usage:
#   ./scripts/deploy.sh
#   ./scripts/deploy.sh inspect
#   ./scripts/deploy.sh dry-run
#   ./scripts/deploy.sh verify

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FTP_SCRIPT="${SCRIPT_DIR}/deploy_reg_ftp.sh"

if [[ ! -x "${FTP_SCRIPT}" ]]; then
  echo "Не найден исполняемый скрипт ${FTP_SCRIPT}"
  echo "Сделайте его исполняемым: chmod +x ${FTP_SCRIPT}"
  exit 1
fi

FTP_HOST_DEFAULT="31.31.197.15"
FTP_USER_DEFAULT="u3494432"
FTP_PASS_DEFAULT="mH9sJ1cV3beO0qF3"
FTP_ROOT_DEFAULT="/www/saran-edu.ru"
FTP_APP_DIR_DEFAULT="/www/saran-edu.ru/app"

CMD="${1:-deploy}"
DRY="0"

case "${CMD}" in
  deploy) ;;
  inspect) ;;
  verify) ;;
  dry-run)
    CMD="deploy"
    DRY="1"
    ;;
  *)
    echo "Неизвестная команда: ${CMD}"
    echo "Использование: ./scripts/deploy.sh [deploy|inspect|verify|dry-run]"
    exit 1
    ;;
esac

FTP_HOST="${FTP_HOST:-${FTP_HOST_DEFAULT}}"
FTP_USER="${FTP_USER:-${FTP_USER_DEFAULT}}"
FTP_PASS="${FTP_PASS:-${FTP_PASS_DEFAULT}}"
FTP_ROOT="${FTP_ROOT:-${FTP_ROOT_DEFAULT}}"
FTP_APP_DIR="${FTP_APP_DIR:-${FTP_APP_DIR_DEFAULT}}"
DEPLOY_DRY_RUN="${DEPLOY_DRY_RUN:-${DRY}}"

FTP_HOST="${FTP_HOST}" \
FTP_USER="${FTP_USER}" \
FTP_PASS="${FTP_PASS}" \
FTP_ROOT="${FTP_ROOT}" \
FTP_APP_DIR="${FTP_APP_DIR}" \
DEPLOY_DRY_RUN="${DEPLOY_DRY_RUN}" \
"${FTP_SCRIPT}" "${CMD}"
