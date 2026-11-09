# Contrato da API 3.0.1

Base local http://127.0.0.1:3000. No celular, usar a URL HTTPS temporária do túnel, sem /v1 no campo Conexão. JSON, exceto GET de mídia. Erros usam error.code e error.message. Escritas e dados privados exigem Authorization: Bearer TOKEN.

| Método e rota | Função |
|---|---|
| GET /health | Versão, serverId e capabilities accounts/media/community/account_security/report_states/moderation. |
| POST /v1/auth/register | name, password, phone e address opcionais; retorna user, token, expiresAt e recoveryCode mostrada uma vez. |
| POST /v1/auth/login | name e password; retorna sessão. |
| GET /v1/auth/me | Perfil da sessão. |
| PATCH /v1/auth/me | Atualiza nome, telefone, endereço e foto do próprio perfil. |
| POST /v1/auth/logout | Revoga a sessão apresentada. |
| POST /v1/media | base64 e mime; imagem até 2 MB; retorna uri relativa. |
| GET /v1/media/:id | Conteúdo da imagem e Content-Type, com cache HTTP. |
| GET /v1/observations | Histórico oficial, estado da fonte e serverId. |
| GET /v1/stations | Lista vazia enquanto a fonte não publicar estações com coordenadas. |
| POST /v1/reports | Cria ou recupera o relato pelo clientId. |
| GET /v1/sync/pull?cursor=N | Página de até 100 relatos, cursor, hasMore e serverId. |
| POST /v1/reports/:id/confirm | Confirma uma vez por conta; impede confirmar o próprio relato. |
| POST /v1/report-disputes | id estável, reportId, authorId, justification e photoUri opcional. |
| GET /v1/community | Contagens, IDs confirmados pela conta, contestações autorizadas e até 100 avisos. |
| POST /v1/notifications/read | id numérico; marca somente um aviso da própria conta. |

O POST do relato recebe clientId, authorId, category, description, address, coordinates, observedAt, locationMode e photoUri opcional. O cabeçalho Idempotency-Key deve ser igual ao clientId. authorId precisa corresponder à sessão; photoUri precisa ter sido enviada por essa conta. Latitude e longitude têm faixas validadas. Categorias do app: passable, partial, blocked. O app real exige GPS ou seleção no mapa para novos relatos.

O primeiro POST retorna 201. Repetição do mesmo conteúdo retorna 200 e preserva o registro. Conteúdo divergente com a mesma chave retorna 409. Uma tentativa sem sessão retorna 401; autor ou mídia de outra conta retorna 403. PATCH de relato enviado retorna 405, pois é imutável. Uma nova observação ou contestação registra a atualização sem sobrescrever o original.

As rotas canônicas /reports e /observations continuam disponíveis para o núcleo e ensaios; a escrita também exige conta por padrão. allowLegacyWritesForTest existe apenas como opção em código de servidores isolados de teste, sem endpoint, cabeçalho ou variável pública que o ative. A API normal não permite esse modo.

JSON comum tem limite de 16 KB. O upload possui limite próprio de 3 MB de JSON, com até 2 MB de bytes da imagem. O servidor confere a assinatura do formato. Não recebe URI file:// de outro aparelho como imagem compartilhada. Telefone e endereço do perfil não aparecem na lista pública de relatos.

## Rotas da versão 3

| Método e rota | Entrada e resultado |
|---|---|
| POST /v1/auth/recover | name, recoveryCode, newPassword; retorna nova sessão e nova chave; revoga as anteriores. |
| POST /v1/auth/password | Sessão, currentPassword, newPassword; revoga sessões e retorna sessão/chave novas. |
| POST /v1/auth/recovery-code | Sessão e currentPassword; retorna outra chave, invalidando a anterior. |
| POST /v1/auth/delete | Sessão, currentPassword e confirmation=EXCLUIR; remove dados próprios e registra remoção dos IDs dos relatos. |
| POST /v1/reports/:id/state | Sessão do autor, operationId, lifecycle active/resolved, note até 300 caracteres; atualização idempotente separada do original. |
| GET /v1/moderation | Sessão com role moderator; até 100 contestações, pendentes primeiro. |
| POST /v1/moderation/:id | Moderador, operationId, action keep/hide, note de 10 a 300 caracteres; decisão idempotente e aviso às partes. |

user inclui username imutável e role; name é editável. Contatos opcionais continuam privados. /v1/community inclui reportStates e estado da análise das contestações. O cliente consulta esses estados mesmo sem um novo relato no cursor. GET de relatos filtra ocultados conforme a conta; removidos nunca são entregues. Imagem ocultada responde 404. Atualização do autor não muda visibility; decisão de moderação não muda lifecycle.

CORS aceita origens HTTPS exatas configuradas, além dos padrões HTTP locais. Não é autenticação. TRUST_PROXY_HOPS é 0 por padrão e só deve ser habilitado atrás do proxy conhecido. Recuperação e operações sensíveis têm limite de tentativas. Não há rota pública para promover moderadores ou acionar falhas de teste.

## Configuração local no app 3.0.4

O código 180504 libera o campo de URL antes do login, sem criar sessão. A verificação
usa GET /health, confere capacidades e mantém a exigência de HTTPS no celular.
As rotas autenticadas e os papéis do servidor não foram alterados. O PIN controla
a interface local; não deve ser descrito como uma credencial secreta da API.
