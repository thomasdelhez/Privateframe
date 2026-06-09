#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
    echo "Usage: remote-deploy.sh <git-sha> <release-archive>" >&2
    exit 2
fi

SHA="$1"
ARCHIVE="$2"
BASE_DIR="/var/www/privateframe"
RELEASES_DIR="${BASE_DIR}/releases"
SHARED_DIR="${BASE_DIR}/shared"
RELEASE_DIR="${RELEASES_DIR}/${SHA}"
CURRENT_LINK="${BASE_DIR}/current"
ENV_DIR="/etc/privateframe"
ENV_FILE="${ENV_DIR}/backend.env"
LEGACY_REVISION="efe6fdc87b1e"
HEALTH_URL="http://127.0.0.1:8080/health"

if [[ ! "${SHA}" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Invalid git SHA: ${SHA}" >&2
    exit 2
fi

if [[ ! -f "${ARCHIVE}" ]]; then
    echo "Release archive not found: ${ARCHIVE}" >&2
    exit 2
fi

mkdir -p "${RELEASES_DIR}" "${SHARED_DIR}/media" "${SHARED_DIR}/backups" "${ENV_DIR}"
chmod 700 "${ENV_DIR}"

if [[ ! -f "${ENV_FILE}" ]]; then
    EXISTING_ENV="$(systemctl show privateframe-backend.service -p Environment --value 2>/dev/null || true)"
    DATABASE_URL="$(printf '%s\n' "${EXISTING_ENV}" | grep -o 'DATABASE_URL=[^ "]*' | head -n 1 | cut -d= -f2-)"
    if [[ -z "${DATABASE_URL}" ]]; then
        echo "DATABASE_URL could not be recovered from the existing service." >&2
        echo "Create ${ENV_FILE} before deploying." >&2
        exit 1
    fi

    umask 077
    {
        printf 'DATABASE_URL=%q\n' "${DATABASE_URL}"
        printf 'SESSION_EXPIRE_DAYS=7\n'
        printf 'EMAIL_VERIFICATION_EXPIRE_HOURS=24\n'
        printf 'PASSWORD_RESET_EXPIRE_MINUTES=60\n'
        printf 'AUTH_RATE_LIMIT_ATTEMPTS=10\n'
        printf 'AUTH_RATE_LIMIT_WINDOW_SECONDS=60\n'
        printf 'CORS_ORIGINS=http://77.42.77.241:8080\n'
        printf 'FRONTEND_URL=http://77.42.77.241:8080\n'
        printf 'EMAIL_BACKEND=console\n'
        printf 'EMAIL_FROM=%q\n' 'PrivateFrame <noreply@privateframe.local>'
        printf 'MEDIA_STORAGE_PATH=/var/www/privateframe/shared/media\n'
    } > "${ENV_FILE}"
fi

rm -rf "${RELEASE_DIR}"
mkdir -p "${RELEASE_DIR}"
tar -xzf "${ARCHIVE}" -C "${RELEASE_DIR}"
rm -f "${ARCHIVE}"
find "${RELEASE_DIR}" -name '._*' -delete

if [[ -d "${BASE_DIR}/media" ]] && [[ -z "$(find "${SHARED_DIR}/media" -mindepth 1 -print -quit)" ]]; then
    cp -a "${BASE_DIR}/media/." "${SHARED_DIR}/media/"
fi

python3 -m venv "${RELEASE_DIR}/backend/.venv"
"${RELEASE_DIR}/backend/.venv/bin/pip" install --disable-pip-version-check --upgrade pip
"${RELEASE_DIR}/backend/.venv/bin/pip" install --disable-pip-version-check "${RELEASE_DIR}/backend"

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

BACKUP_DATABASE_URL="${DATABASE_URL/postgresql+psycopg:/postgresql:}"
BACKUP_FILE="${SHARED_DIR}/backups/privateframe-$(date -u +%Y%m%dT%H%M%SZ)-${SHA:0:12}.sql.gz"
pg_dump "${BACKUP_DATABASE_URL}" | gzip -9 > "${BACKUP_FILE}"

cd "${RELEASE_DIR}/backend"
DATABASE_STATE="$("${RELEASE_DIR}/backend/.venv/bin/python" - <<'PY'
from sqlalchemy import create_engine, inspect
from app.core.config import get_settings

tables = set(inspect(create_engine(get_settings().database_url)).get_table_names())
if "alembic_version" in tables:
    print("managed")
elif "user" in tables and "usersession" in tables:
    print("legacy")
elif not tables:
    print("empty")
else:
    print("unknown")
PY
)"

case "${DATABASE_STATE}" in
    legacy)
        "${RELEASE_DIR}/backend/.venv/bin/alembic" stamp "${LEGACY_REVISION}"
        ;;
    managed|empty)
        ;;
    *)
        echo "Unknown database state; refusing to migrate." >&2
        exit 1
        ;;
esac

"${RELEASE_DIR}/backend/.venv/bin/alembic" upgrade head

install -m 0644 "${RELEASE_DIR}/deploy/privateframe-backend.service" /etc/systemd/system/privateframe-backend.service
install -m 0644 "${RELEASE_DIR}/deploy/nginx-privateframe.conf" /etc/nginx/sites-available/privateframe
ln -sfn /etc/nginx/sites-available/privateframe /etc/nginx/sites-enabled/privateframe
nginx -t
systemctl daemon-reload
systemctl enable privateframe-backend.service >/dev/null

PREVIOUS_RELEASE="$(readlink -f "${CURRENT_LINK}" 2>/dev/null || true)"
NEXT_LINK="${BASE_DIR}/.current-${SHA}"
ln -sfn "${RELEASE_DIR}" "${NEXT_LINK}"
mv -Tf "${NEXT_LINK}" "${CURRENT_LINK}"

systemctl restart privateframe-backend.service
systemctl reload nginx.service

HEALTHY=false
for _ in {1..30}; do
    if curl --fail --silent --show-error "${HEALTH_URL}" >/dev/null; then
        HEALTHY=true
        break
    fi
    sleep 1
done

if [[ "${HEALTHY}" != true ]]; then
    echo "Healthcheck failed; rolling back application files." >&2
    if [[ -n "${PREVIOUS_RELEASE}" ]] && [[ -d "${PREVIOUS_RELEASE}" ]]; then
        ROLLBACK_LINK="${BASE_DIR}/.rollback-${SHA}"
        ln -sfn "${PREVIOUS_RELEASE}" "${ROLLBACK_LINK}"
        mv -Tf "${ROLLBACK_LINK}" "${CURRENT_LINK}"
        systemctl restart privateframe-backend.service
        systemctl reload nginx.service
    fi
    exit 1
fi

find "${SHARED_DIR}/backups" -type f -name 'privateframe-*.sql.gz' -printf '%T@ %p\n' \
    | sort -nr \
    | tail -n +8 \
    | cut -d' ' -f2- \
    | xargs -r rm -f

find "${RELEASES_DIR}" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
    | sort -nr \
    | tail -n +6 \
    | cut -d' ' -f2- \
    | while IFS= read -r old_release; do
        if [[ "${old_release}" != "$(readlink -f "${CURRENT_LINK}")" ]]; then
            rm -rf "${old_release}"
        fi
    done

echo "PrivateFrame ${SHA} deployed successfully."
