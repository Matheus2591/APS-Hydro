#!/bin/sh
set -eu
# O volume é montado depois do build. Ajuste somente o diretório reservado aos dados.
mkdir -p /data/backups
chown -R node:node /data
exec gosu node "$@"
