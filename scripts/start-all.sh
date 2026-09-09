#!/bin/bash
# Sobe o servidor Next.js principal + os processos em segundo plano (filas de
# saída, realtime do painel, fechamento de conversas inativas, escalonamento
# de SLA) num único container. Se qualquer um morrer, encerra os demais e sai
# com erro, pra o orquestrador (EasyPanel/Docker) reiniciar o container inteiro
# — evita um processo "zumbi" ficando parado sem os outros.
set -e

npm start &
PIDS="$!"
npm run worker &
PIDS="$PIDS $!"
npm run worker-instagram &
PIDS="$PIDS $!"
npm run realtime &
PIDS="$PIDS $!"
npm run close-inactive-conversations &
PIDS="$PIDS $!"
npm run escalate-sla &
PIDS="$PIDS $!"

trap 'kill $PIDS 2>/dev/null' TERM INT

wait -n $PIDS
EXIT_CODE=$?
kill $PIDS 2>/dev/null
exit $EXIT_CODE
