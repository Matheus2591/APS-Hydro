# Validação registrada do app 3.0.4

Aplicativo 3.0.4, Android versionCode 12; API 3.0.1. O APK permite liberar a configuração da URL pelo login usando 180504. O código e o desbloqueio são mantidos apenas na tela; a URL validada é persistida. O código não autentica uma conta nem concede papel de administrador.

- 93 testes automatizados aprovados: 22 servidor, 34 mobile e 37 integração/configuração. As suítes continuam fora deste pacote enxuto.
- Os cenários novos conferem código incorreto, configuração sem login, persistência da URL após reabertura, exigência de nova liberação e bloqueio de rotas protegidas sem sessão. Conta comum autenticada continua sem permissão para alterar a conexão. Configuração e autenticação não executam mudanças concorrentes de destino.
- TypeScript, exportação web e build Android concluídos. Assinatura v2, alinhamento de 16 KB e integridade do APK aprovados. Os fontes móveis do build foram comparados byte a byte.
- 30 cenários visuais locais com componentes via React Native Web. Incluem login, código incorreto, liberação, edição de URL, salvar, reabrir bloqueado, modo administrador, fonte ampliada e telas principais. Sem erro de execução ou transbordamento horizontal. Os controles do mapa usam área neutra nesse ensaio, sem nova validação de GPS/ruas.
- Esta revisão não foi instalada nem inspecionada fisicamente no Android. Ensaios anteriores usaram um Samsung SM-S711B e contraparte HTTP, sem declarar um segundo Android.

APK: 34287511 bytes. SHA-256: DC8E40A1E655F87929F74EDAA4744A860C6DFDD19329C03A9691EBDD7E45E537.

Os slides 3.0.1 foram preservados e registram a rodada anterior de 90 testes. O número atual é 93. A URL embutida tem caráter temporário; quando mudar, a configuração por código permite indicar o novo serviço antes do login.

O pacote mantém app/API/Android e dados oficiais, sem banco particular, tokens, fotos, caches ou suítes de testes. O backup completo anterior foi preservado. API e dados ativos não foram alterados por esta atualização.

## Preparador automático de ferramentas Windows

PREPARAR_DEPENDENCIAS.cmd agora chama o auxiliar PowerShell ambiente-windows.ps1. Ele reaproveita Node.js 24 e cloudflared compatíveis ou baixa cópias locais para codigo/.runtime/ferramentas. Node.js é obtido de nodejs.org com o SHA-256 publicado em SHASUMS256.txt; cloudflared vem da publicação oficial Cloudflare no GitHub, com seu digest SHA-256. O iniciador compartilha o mesmo resolvedor e recebe o caminho completo do cloudflared selecionado. As instalações de outros projetos não são substituídas. Não é exigido WinGet.

A conferência usou uma pasta temporária nova, sem node_modules e sem ligações para as bibliotecas do projeto original. Foram baixados e executados Node.js 24.22.1 e cloudflared 2026.10.4. Em Windows PowerShell 5.1, a preparação completa instalou as dependências do servidor e do mobile, incluindo os recursos do mapa. O TypeScript passou, a API 3.0.1 respondeu com 22 medições e o login de Roger funcionou em banco isolado. O iniciador reconheceu as ferramentas e a demonstração de idempotência confirmou duas tentativas e uma linha. Os caches de download do usuário puderam ser reutilizados; esse ensaio não é declarado como teste em outro computador ou sistema operacional limpo.

Em cenários isolados adicionais, checksum divergente, URL sem HTTPS e caminho fora da pasta de ferramentas foram rejeitados. Nenhum túnel público foi iniciado nessa conferência. Na conferência do preparador, o APK e seu endereço embutido permaneceram inalterados; o APK 3.0.4 foi compilado depois, na revisão descrita acima.
