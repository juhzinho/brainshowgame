# Brain Show

Quiz multiplayer em Next.js com estado persistido em Redis via Upstash, preparado para deploy no Vercel.

## Produção

Variáveis obrigatórias no Vercel:

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Healthcheck:

```text
https://SEU-DOMINIO/api/health
```

Resultado esperado:

```json
{"status":"ok","runtime":"nodejs","storage":"redis"}
```

Se aparecer `"storage":"memory"`, o deploy está sem Redis.

## Teste Manual

Checklist mínimo depois de cada deploy:

1. Abrir a home e criar uma sala.
2. Entrar na mesma sala com outro navegador, aba anônima ou outro celular.
3. Marcar ambos como prontos e iniciar a partida.
4. Responder perguntas dos dois lados e verificar atualização de placar.
5. Testar sabotagem durante a fase de resposta.
6. Testar voto de roubo e contra-ataque quando a rodada especial aparecer.
7. Recarregar uma página no meio do jogo e confirmar que a sala continua consistente.
8. Fechar uma aba por alguns segundos e verificar se o jogador aparece como desconectado.
9. Reiniciar a partida no final e confirmar que o fluxo volta ao início.

## Vercel

Cada projeto deve ter:

- domínio próprio correto
- variáveis próprias
- deploy próprio

Nao reutilize o projeto de outro site para este jogo.

Checklist de segurança operacional:

1. Confirme o nome do projeto antes de editar variáveis.
2. Confirme o domínio em `Project > Settings > Domains`.
3. Confirme o healthcheck depois de cada redeploy.
4. Se trocar as variáveis do Redis, faça redeploy.

## Domínio

Se voce tiver outro site no mesmo time do Vercel, mantenha este projeto separado.

Exemplo correto:

- `brainshowgame.vercel.app` no projeto Brain Show
- `arcadeflappy.xyz` no projeto Flappy

Nao aponte o mesmo domínio para dois projetos diferentes.

## Desenvolvimento Local

Instalar dependências:

```bash
pnpm install
```

Rodar local:

```bash
pnpm dev
```

Validar:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Troubleshooting

### `/api/health` mostra `memory`

Causa provável:

- variáveis do Upstash ausentes
- variáveis salvas no projeto errado
- faltou redeploy

### Sala some depois de um tempo

Causa provável:

- deploy sem Redis
- projeto está rodando em fallback local

### Jogadores nao conseguem entrar

Verifique:

1. se o código da sala está correto
2. se a sala ainda está em `waiting`
3. se o deploy atual está saudável em `/api/health`

### Erro após alterar variáveis

Faça:

1. confirmar valores no Vercel
2. redeployar
3. testar `/api/health`

## Arquitetura Atual

- frontend: Next.js App Router
- armazenamento persistente: Upstash Redis REST
- fallback local: memória do processo, apenas para desenvolvimento
- sincronização de jogo: avanço de fases por timestamp persistido
- proteção básica: token por jogador, rate limiting, logs estruturados e headers de segurança
