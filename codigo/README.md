# Código Hydro Pulse 3.0.4

App em mobile/, API em server/, dados oficiais em data/ e auxiliares em scripts/.
Execute os dois arquivos CMD da pasta superior para preparar e iniciar a apresentação.

Na pasta codigo, npm run typecheck confere o TypeScript e npm run demo:idempotency
executa a demonstração isolada de reenvio com duas tentativas e uma gravação.

As suítes e os comandos npm test foram retirados deste pacote por escolha do responsável.
O pacote completo anterior preserva os testes e toda a documentação de desenvolvimento.
Os fontes do aplicativo, da API e do projeto nativo Android foram mantidos.
PREPARAR_DEPENDENCIAS.cmd prepara Node.js 24, cloudflared e as dependências automaticamente.
As ferramentas locais ficam em codigo/.runtime/ferramentas; downloads oficiais têm SHA-256 conferido.
Para comandos sem Node.js global, dentro de codigo use:
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ambiente-windows.ps1 -Acao Demonstrar
Troque Demonstrar por Tipos para conferir o TypeScript. SDK/JDK são necessários somente
para recompilar Android, não para utilizar o APK já fornecido.

Downloads oficiais do preparador: https://nodejs.org/dist/index.json e
https://developers.cloudflare.com/tunnel/downloads/ . O Node.js usa o SHA-256 do
arquivo SHASUMS256.txt oficial; cloudflared usa o digest da publicacao Cloudflare
no GitHub. A preparacao local dispensa WinGet e nao troca instalacoes de outros projetos.

## Conexão antes do login

No app, toque em Configurar conexão, informe 180504 e toque em Liberar configuração.
Cole a URL HTTPS da API, teste e salve. Depois volte para entrar ou cadastrar.
O código controla somente essa opção local e não é autenticação da API. O texto do
código e a liberação não são persistidos; somente a URL é guardada. Uma conta comum
já conectada continua sem a opção administrativa; para usar a configuração inicial,
saia da conta e informe o código na entrada.
