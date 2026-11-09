# HYDRO PULSE

## Aplicação móvel distribuída para consulta de chuvas e relatos de alagamentos urbanos

Universidade Paulista — UNIP. Ciência da Computação, 7º/8º semestre. Atividades Práticas Supervisionadas, vinculada a Desenvolvimento de Sistemas Distribuídos. Professor: Prof. Vinícius Eduardo. Santos — SP, 25 de outubro de 2026.

Integrantes: Matheus Felipe dos Santos, RA G820CH-5; Roger Alexey Camargo Lamim, RA G81HCJ4; Vinícius da Silva Ribeiro, RA G772CA3.

## Versão desta entrega

Aplicativo 3.0.4, Android versionCode 12; API 3.0.1. A revisão atual organiza a interface de uso, mantendo os fluxos de conta, dados, mapa e sincronização. Uma base vazia prepara Roger como administrador (senha de ensaio 12345678), sem relatos e com as medições oficiais. Reinícios seguintes preservam os dados. Este pacote não inclui o banco particular nem suítes de testes. A validação registrada está em VERIFICACOES.md; as suítes completas continuam no pacote anterior.

## Configuração inicial da conexão

Na revisão 3.0.4, o login possui Configurar conexão. O código 180504 libera a URL enquanto a tela estiver aberta. O endereço é validado e persistido antes de permitir o login. Esse código é um controle de conveniência no cliente, sem criar sessão, alterar papel ou dispensar a autorização das rotas da API. Administradores também podem configurar pelo Perfil. O banco e a API 3.0.1 não foram reiniciados nem limpos por esta revisão.

## Resumo

O Hydro Pulse reúne histórico pluviométrico oficial de Santos e relatos colaborativos em um aplicativo Android. A arquitetura separa clientes, API e persistência central. O cliente conserva contribuições localmente antes do envio, recupera a fila após reabertura e sincroniza por identificadores estáveis e cursor. A implementação inclui recuperação de conta por chave secreta, troca de senha, exclusão, encerramento de ocorrências e moderação com decisão justificada. O servidor automatiza a consulta oficial e backups consistentes. A última rodada registrada aprovou 93 testes (22 servidor, 34 mobile e 37 integração/configuração). A revisão visual 3.0.4 usou 30 cenários locais e não foi uma nova inspeção física no celular. O ensaio físico usa um Samsung SM-S711B/Android 16 e um segundo cliente HTTP, com resultados detalhados na evidência específica da versão. A publicação permanente foi preparada para Render com disco persistente, mas ainda depende da conta e ativação pelo titular.

Palavras-chave: sistemas distribuídos; persistência; idempotência; Android; pluviometria.

## 1. Problema e objetivo

Um celular pode ficar sem rede enquanto outros participantes continuam usando o serviço. O projeto demonstra armazenamento local, comunicação cliente-servidor e recuperação após reconexão em um contexto ambiental urbano. O aplicativo distingue medições institucionais de observações da comunidade. Chuva acumulada não é convertida automaticamente em confirmação de alagamento.

O objetivo de uso é permitir consultar a fonte sem conta, registrar uma observação com ponto e foto, manter a fila durante uma desconexão e compartilhar o registro ao retornar. Contestações e atualizações acrescentam informações sem sobrescrever a observação original.

## 2. Arquitetura e tecnologias

O cliente usa Expo SDK 57, React Native 0.86.3, React 19, TypeScript, React Navigation e Zustand. AsyncStorage mantém dados e filas em gravações serializadas; SecureStore conserva o token da sessão Android separadamente. Leaflet 1.9.4 apresenta cartografia OpenStreetMap na WebView. A versão web usa iframe e sessão da aba.

O servidor usa Node.js 24, Express 5, Zod e SQLite via better-sqlite3. Um único processo acessa o banco central com relatos, fotos, contas, interações, eventos e estado da fonte. O ensaio disponibiliza HTTPS por túnel até o notebook; a publicação preparada usa um serviço com disco persistente. São componentes independentes comunicando-se por HTTP/JSON.

A proposta previa SQLite também no celular. Foi mantido o AsyncStorage já usado no novo mobile fornecido pelo grupo, reduzindo a reescrita e facilitando a explicação. A proposta admite ajustes tecnológicos que preservem os objetivos. O cliente não executa SQL local; SQLite permanece central. Persistência antes da rede e recuperação após reabertura sustentam a equivalência funcional demonstrada.

## 3. Procedência dos dados

A cópia embarcada da publicação da Prefeitura de Santos foi consultada em 24/10/2026 e contém 22 índices de 01 a 22/10/2026, soma 169,7 mm. Preserva fonte, abrangência municipal, unidade e data. O conjunto não informa horário de medição nem coordenadas de estações. O aplicativo não inventa essas informações e não cria marcadores de chuva sem posição publicada.

A consulta automática bem-sucedida de 25/10/2026 continuou encontrando 22/10 como última medição. O servidor consulta a fonte ao iniciar e a cada 6 horas; novas datas dependem da publicação da Prefeitura. A interface apresenta a data da medição e a última consulta separadamente. Ausência de linha não significa 0 mm. Falhas registram a tentativa e preservam o último histórico válido.

Os relatos têm procedência comunitária e horário observado. Dados de ensaio não se tornam dados institucionais. O projeto não oferece previsão nem substitui informação de autoridade.

## 4. Persistência e sincronização

O clientId é criado antes do primeiro POST. O cliente espera a gravação local e apresenta pendente, enviado ou erro. Fotos locais aguardam o upload antes do POST do relato. Encerrar e reabrir conserva os dados persistidos.

O servidor valida sessão, autoria e conteúdo e realiza a transação. A mesma chave e o mesmo conteúdo devolvem o original; a mesma chave com conteúdo divergente retorna conflito. Se o COMMIT aconteceu e a resposta se perdeu, reenviar conserva um registro lógico. Os testes injetam essa perda após uma gravação real.

O cursor é a sequência dos relatos no servidor. O cliente baixa páginas de até 100 itens e persiste cada página junto de seu cursor. O POST não avança o cursor, pois outros participantes podem ter registros anteriores ainda não recebidos. Uma página inválida não substitui dados válidos nem avança o cursor.

Interações e estados são recebidos separadamente em /v1/community, inclusive quando não há relato novo. A sincronização ocorre na abertura, retorno da conexão, retomada e consultas periódicas enquanto o app está ativo; não se pressupõe execução contínua em segundo plano. Sem rede e com sessão aberta, a fila permanece local.

## 5. Conta, segurança e dados pessoais

Cadastro e login são realizados na API. A senha tem salt aleatório e hash scrypt. O token é aleatório, seu resumo fica no servidor e a sessão tem prazo. Telefone e endereço são opcionais e privados; não integram a listagem pública de relatos. O nome de acesso é estável, mesmo quando o nome mostrado no perfil muda.

A recuperação usa uma chave secreta de alta entropia, exibida durante a operação e não incluída no estado persistido do aplicativo. Apenas seu resumo fica no banco. Usar ou gerar outra chave invalida a anterior. Recuperar ou trocar senha revoga sessões antigas e emite nova sessão/chave. Sem senha e sem chave não há recuperação por e-mail ou SMS. A interface orienta a guardar a chave em lugar privado.

A exclusão exige senha atual, texto EXCLUIR e confirmação final. Remove conta, sessões, mídia, relatos e interações próprios no serviço ativo e limpa pendências próprias no aparelho que a executa. IDs removidos ficam marcados para não serem recriados por um cliente antigo. Outros aparelhos precisam sincronizar para descartar cópias. Backups protegidos seguem a retenção operacional; restauração exige reaplicar exclusões posteriores antes de reabrir o serviço.

O ensaio identificou campos de segurança pouco claros no Android: texto de exemplo invisível e senha longe da ação de excluir. A revisão passou a usar cor explícita, rótulos persistentes, senha junto de cada ação e seleção entre troca, recuperação e exclusão. O teste físico final e sua confirmação no banco ficam registrados separadamente.

## 6. Ocorrências, mapa e moderação

Uma ocorrência possui ciclo de vida active/resolved e visibilidade visible/hidden/removed. São dimensões independentes. O autor pode atualizar ou encerrar com nota sem substituir o original. Cada operação tem ID estável, evento no banco e fila persistente para reenvio.

O mapa usa coordenadas confirmadas por GPS ou escolha explícita. A câmera inicial em Santos não representa ocorrência. Os filtros incluem 24 horas, 7 dias ou todas as datas, baseados no horário observado; atualizar o estado não torna uma observação antiga recente. Encerradas aparecem em cinza quando incluídas. Ocultadas saem do mapa. Ruas dependem de internet ou cache HTTP.

Confirmações são únicas por conta/relato e não podem ser do próprio autor. Contestações possuem ID e justificativa e geram avisos. Moderadores concedidos pelo operador acessam uma fila restrita e decidem manter ou ocultar, com nota de 10 a 300 caracteres. A decisão é idempotente e avisa as partes. A API pública não entrega relatos ocultados, e a foto ocultada responde 404; restaurar não altera o encerramento definido pelo autor. Isso não representa julgamento por autoridade nem validação automática de veracidade.

## 7. Operação e publicação

O servidor aceita HOST/PORT e origens CORS explícitas. A confiança em proxy é desativada por padrão e configurada conscientemente na hospedagem. Rotas sensíveis têm limite de tentativas; a atribuição de moderação ocorre por comando privado do operador, sem rota pública.

Ao iniciar e a cada 24 horas, a API gera backup consistente usando a operação de backup do SQLite. Mantém três arquivos próprios e não remove arquivos alheios. O teste de restauração verifica identidade do servidor, conta e bytes de foto. Copiar apenas um banco aberto em WAL não é tratado como backup consistente. Uma cópia privada externa ainda é necessária para proteger contra perda do volume.

Dockerfile e render.yaml preparam uma instância Render paga, disco de 1 GB em /data, banco e backups nesse volume e verificação em /health. A aplicação HTTP executa como usuário sem privilégios após preparar as permissões do volume. Não há conta de hospedagem fornecida, serviço contratado ou Docker disponível nesta máquina para validar a imagem; a publicação e o teste após redeploy permanecem externos. Os guias extensos de publicação permanecem no pacote completo. A hospedagem não é necessária para o ensaio local com túnel, mas precisa ser ativada para operação independente do notebook.

O APK de apresentação é arm64 e conserva a assinatura de desenvolvimento para atualizar a instalação de ensaio. A distribuição pública exige URL fixa, dados reais, configuração técnica oculta, chave própria e /health compatível. A checagem recusa túnel temporário, ambiente simulado e credenciais de assinatura ausentes. O titular precisa guardar a chave e realizar a publicação na loja, com contato e política de privacidade reais.

## 8. Método e resultados

A rodada registrada da revisão 3.0.4 aprovou 93 testes: 22 do servidor, 34 do aplicativo e 37 de integração/configuração. As suítes não acompanham este pacote enxuto. São usados node:test, assert, bancos isolados, armazenamento controlado e HTTP real. TypeScript, compilação Android, exportação web, assinatura e alinhamento do APK foram verificados. A demonstração de idempotência usa conta e banco temporários e confirma duas tentativas com um registro lógico.

| Requisito | Evidência |
|---|---|
| Armazenamento antes da rede e recuperação | Testes do estado, falhas de gravação, reabertura e ensaio físico offline. |
| Reenvio idempotente | Perda de resposta após COMMIT para relato, atualização e decisão. |
| Recuperação de contribuições de outros clientes | Paginação, cursor e cliente HTTP independente. |
| Fonte real e continuidade em falha | Importador validado, consulta periódica e preservação do histórico. |
| Conta e autorização | Sessões, papéis, recuperação, troca de senha, exclusão e autoria conferidos. |
| Ciclo de vida e moderação | Estado independente, histórico, ocultação/restauração e reenvio sem duplicação. |
| Operação | Restauração consistente, configuração de hospedagem e reinício com mesma identidade. |

O ensaio físico da versão 3.0 usa Samsung SM-S711B com Android 16, arm64, e outro cliente HTTP, com navegação manual do usuário. Confirmou atualização preservando sessão, cadastro com contatos vazios, recuperação e novo login, troca de senha/chave, relato com ponto/foto offline e reabertura, sincronização, encerramento, filtro de encerradas, moderação e restauração. A comprovação da revisão final e exclusão está em VERIFICACOES.md. O histórico detalhado permanece no pacote completo.

As capturas e logs privados ficam fora do ZIP; não se publicam senhas, chaves, tokens ou fotos do aparelho. O bloqueio anterior de abertura automatizada por ADB e inicialização Expo foi respeitado. O usuário controlou o celular; a verificação técnica usou leituras, instalação e consultas à API. A revisão visual 3.0.4 foi local, com componentes via React Native Web. Não equivale à validação física no Android nem a um ensaio completo da navegação web.

## 9. Limites e continuidade

Os resultados sustentam os cenários exercitados e não certificam todos os aparelhos Android, iOS, TalkBack ou todos os tamanhos de fonte. O mapa não é totalmente offline. Notificações são internas; não há push, previsão ou validação de alagamento por autoridade. A fila de moderação retorna até 100 contestações; maior volume requer evolução operacional.

Para funcionar sem o notebook, faltam ativar a hospedagem e seu volume, conferir persistência após redeploy e gerar/distribuir o APK com URL fixa e chave do titular. É necessário definir responsáveis pela moderação e publicar contato real e política de privacidade. O projeto mantém implementação e preparo separados de uma implantação que ainda não ocorreu.

## Referências

- Proposta APS_261023_121322.pdf fornecida pelo grupo.
- Prefeitura de Santos, Dados de Pluviometria: https://www.santos.sp.gov.br/?q=pluviometria-tabela . Consultas em 24 e 25/10/2026.
- Leaflet: https://leafletjs.com/reference.html . OpenStreetMap: https://operations.osmfoundation.org/policies/tiles/ .
- Render: https://render.com/docs/disks e https://render.com/docs/blueprint-spec . Consultados em 25/10/2026. O provedor recomenda backups próprios para recuperação de bancos personalizados.
- Código do app Hydro Pulse 3.0.4 e API 3.0.1. Nesta cópia, npm run typecheck e npm run demo:idempotency continuam disponíveis dentro da pasta codigo; as suítes de testes foram retiradas da distribuição enxuta.
