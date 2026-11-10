# AGENTS.md — my_odk_client

Cliente de coleta offline-first (SPA/PWA) para ODK Central.
Documento operacional para agentes de código. Complementa o AGENTS.md global
(`~/.config/opencode/AGENTS.md`), que continua valendo integralmente.

## 0. Fonte de verdade e precedência

1. `PLAN.md` é a especificação vigente. Em conflito com este arquivo, vale o
   plano — e a divergência deve ser apontada, nunca resolvida em silêncio.
2. Requisito primário: coleta offline íntegra e entrega posterior ao Central.
   Framework, aparência e conveniência nunca têm precedência sobre conservação
   de dados (§1, §2).
3. O projeto está em PLANEJAMENTO. Sem autorização explícita de BUILD e sem os
   gates G0/G1, não criar scaffold, dependências, containers ou infraestrutura.
4. Decisões de §1.1 estão fechadas: IndexedDB transacional, fila no dispositivo,
   pacote de campo completo, persistência/backup obrigatórios, envio ao reabrir,
   estados de fila transparentes.
5. O motor XForms NÃO está escolhido (Web Forms × Enketo Express). Nada no código
   pode assumir um deles antes de `docs/adr/0001-engine-and-platform.md`.
6. Nome do produto: **My ODK Client** (`short_name`: `My ODK`), definido pelo
   usuário. "ODK" é marca da Get ODK Inc.; não sugerir produto oficial e revisar
   o nome antes de qualquer distribuição pública (§12).
7. Este arquivo vale para todo o repositório. Não criar AGENTS.md duplicado em
   `frontend/` ou `backend/`; se uma regra for específica de subprojeto, ela entra
   aqui com o caminho explícito.

## 1. Invariantes de dados (violação = bug crítico)

1. "Salvo" só aparece após commit local concluído; antes disso, "Salvando".
2. Nenhum dado confirmado depende de memória de página, `beforeunload` ou evento
   de descarregamento.
3. Nenhuma resposta pode referenciar anexo não persistido.
4. Finalização congela XML, IDs, nomes e bytes dos anexos; retry reutiliza o
   envelope exatamente, byte a byte.
5. `sending` interrompido vira `outcome_unknown`, nunca sucesso presumido.
6. Só `confirmed` (XML + todos os anexos aceitos) permite limpeza de pendentes.
7. Reenvio conserva `instanceID`; edição posterior cria novo ID com `deprecatedID`,
   quando suportada.
8. Atualização de formulário, app ou schema nunca migra silenciosamente rascunhos
   ou envelopes.
9. Falha de cota, I/O ou permissão é visível e preserva o último estado válido.
10. Recurso não suportado bloqueia a coleta daquele formulário (fail-closed), com
    motivo explícito e sem substituição por campo de texto.

## 2. Armazenamento local

- IndexedDB transacional para respostas, rascunhos, fila, anexos e tokens.
  `localStorage` é proibido para isso; no máximo um marcador de bootstrap.
- Anexos como `Blob` no IndexedDB. OPFS só com medição que justifique e com
  journal/reconciliação projetados — não é forma de escapar de eviction.
- Toda escrita relevante trata `QuotaExceededError`; nunca engolir erro e
  reportar sucesso.
- `persist()` / `estimate()` / `persisted()` são diagnóstico, não garantia.
  O resultado deve ser exibido como diagnóstico ao usuário.
- Schema versionado, migração transacional e idempotente; migração que falha não
  pode destruir dados.
- Não trocar origem (domínio/esquema/porta) sem plano de migração de dados.

## 3. Motor de formulários

- Acesso exclusivamente via `FormEngineAdapter` estreito; nenhum componente
  importa o engine diretamente.
- Durante o preenchimento: zero requisições de rede. Relevância, cálculos, CSV e
  mídia resolvem localmente.
- Interceptar resolução de recursos e finalização; o engine nunca envia ao
  Central por conta própria.
- Expor captura de alterações para autosave; não depender do evento final.
- Escrever primeiro o teste de serialize/restore que falha, depois a persistência.

## 4. Sincronização e protocolo Central

- Envelope e `OutboxItem` persistidos em transação antes de qualquer requisição.
- `navigator.onLine` é indício; verificar alcance real do backend.
- Lease por item e por conexão; duas abas/workers não enviam o mesmo item.
- `Idempotency-Key` pertence à API própria, não ao Central. Vincular a conexão,
  identidade, `instanceID` e digest; conteúdo diferente com a mesma chave = 409.
- Só 201 com todos os lotes concluídos confirma. 202 não é sucesso. Todo 409 é
  conflito explícito para investigação.
- Backoff exponencial com jitter e teto; respeitar `Retry-After`; estado
  persistido, não apenas timer.
- Preservar `X-OpenRosa-Version: 1.0`, namespaces, `xmlFormId`, versão,
  `instanceID` e `deprecatedID`.
- Não usar App User para listar submissões como prova; usar conta de verificação
  autorizada separada.
- Token de App User nunca em URL visível da SPA, log ou diagnóstico.

## 5. Backend adaptador

- Não interpreta lógica de formulário, não mantém segunda fila de coleta e não
  armazena submissões indefinidamente.
- Credenciais cifradas; cookie de sessão HttpOnly/Secure/SameSite + CSRF em escritas.
- Allowlist de servidor/projeto (opcional; por padrão, exigir host https público
  validado por DNS/IP); validar cada redirecionamento; bloquear SSRF e metadata
  services.
- XML/CSV são entradas não confiáveis: sem DTD/entidades externas, com limites de
  tamanho, profundidade, repeats e tempo; nunca `eval` para XPath.
- Encaminhar os bytes do XML congelado sem transformação.
- Nunca declarar sucesso definitivo quando só recebeu do navegador.
- Logs mascaram `/key/...`, credenciais e conteúdo de respostas.

## 6. Interface e comunicação

- Vocabulário fixo: "salvo neste aparelho", "enviando", "aguardando conexão",
  "confirmado pelo servidor".
- Proibido usar "sincronizado" ou "enviado" para dados apenas locais.
- Envio em andamento aparece como faixa discreta e não bloqueante; o usuário
  continua coletando.
- Contagem de pendentes idêntica em todas as telas.
- Acessibilidade: rótulos associados, erros anunciados (`aria-live`), foco
  previsível, alvos de toque adequados, 320–1280 px, safe areas, teclado virtual.
- iPhone: informar explicitamente que o envio ocorre com o app aberto.
- A entrega é PWA instalável: abre pelo ícone, em `standalone`, e funciona sem
  rede. Manifesto, ícones e service worker são critério de aceite, não detalhe.
- Não declarar "pronto para campo" sem instalação e abertura offline pelo ícone.

## 7. Segurança, privacidade e licenças

- QR e credenciais são segredos: nunca em log, screenshot, analytics, erro ou chat.
- Token de App User é **por agente** e nunca fica em JavaScript, IndexedDB ou
  `localStorage`: vive apenas dentro do cookie de sessão cifrado (ADR 0003).
  O cliente guarda somente o `workspaceId` opaco.
- Sanitizar labels/HTML; CSP compatível; nenhum script de CDN.
- HTTPS obrigatório; nunca desabilitar validação de certificado.
- Dados pessoais: minimização, retenção, responsáveis e recuperação definidos
  antes do piloto.
- Proteção em repouso é gate. Se houver cofre local, usar primitivas auditadas e
  chave fora dos registros em claro. Não inventar criptografia.
- Criptografia de submissão ≠ cifragem local; não recriptografar a cada retry.
- Preservar licenças e NOTICE; Apache-2.0 não concede uso de marcas.

## 8. Testes e evidência

- Test-first para regras de domínio, persistência e fila.
- Toda mudança em persistência/fila cita o caso T01–T30 (§17.1) que cobre ou mantém.
- Unitários + integração com IndexedDB real + backend real + E2E Playwright com
  falhas injetadas. Dispositivos reais são obrigatórios para iPhone e Android.
- Mock, 201 isolado ou CI verde não homologam integração com o Central.
- Comparar semântica com XML de referência do Collect; byte a byte apenas entre
  retries do mesmo envelope.
- Registrar versão, aparelho, SO, navegador, passos e IDs — sem conteúdo pessoal.

## 9. Código e estrutura

- Seguir a árvore de §16. Não criar abstrações especulativas: uma única
  implementação de `LocalRepository`, sem camada de plugins antecipada.
- TypeScript estrito; validação de entrada em runtime nas fronteiras (XML, JSON,
  IndexedDB); sem `any` implícito nessas fronteiras.
- Estado de edição e de transporte como tipos discriminados separados (§7.2);
  nunca um booleano `synced`.
- Dependência nova exige justificativa no PR (licença, manutenção, tamanho).
- Sem código morto, endpoint sem consumidor ou flag órfã.
- Docs e comentários em PT-BR; identificadores de código em inglês.
- Package manager, versão de Node e scripts de verificação serão fixados na
  Fase 2 e registrados aqui naquele momento. Até lá, não inventar comandos.

## 10. Fluxo de trabalho

- **Toda alteração nasce em branch própria**, criada a partir da `main`
  atualizada: código, documentação, configuração, assets e correções de uma
  linha. Nunca commitar direto na `main`.
- Nome da branch diz o tipo e o assunto: `feat/`, `fix/`, `docs/`, `test/`,
  `chore/`, `refactor/`.
- Commits pequenos e temáticos (Conventional Commits).
- Antes de encerrar: typecheck, lint, unitários e integrações afetadas verdes.
- Merge local e parada para teste manual. Sem push, PR, tag, release ou deploy
  sem autorização explícita.
- Não iniciar uma fase sem o gate da anterior aprovado (§15).
- O repositório já existe, com remoto em `github.com/lucianovilasboas/my-odk-client`.
  Push continua exigindo autorização explícita em cada rodada.
- Toda versão implantada recebe tag `vX.Y.Z`; o deploy sai da tag, nunca do
  topo móvel da `main`.
- Reversão de algo já publicado é `git revert` do merge na `main`. Nunca
  `reset --hard` em histórico publicado. Branch não mesclada pode ser descartada.
- Nunca implantar dentro da stack do ODK Central nem alterar o vhost do Central.
  O cliente é stack própria, com proxy e limites próprios (`PLAN.md` §6.4).

## 11. Proibições rápidas

- `localStorage` para dados de coleta, tokens ou fila.
- SPA chamando o Central diretamente, sem decisão registrada em ADR.
- `skipWaiting` que substitua o app durante edição ou envio.
- Tratar 2xx genérico, 409 ou HTML de proxy como sucesso.
- Apagar pendentes para liberar espaço.
- Substituir recurso não suportado por campo de texto livre.
- Declarar "offline homologado" com base em emulador ou WebKit desktop.
- Publicar a PWA por um path do Central ou dentro do compose do Central.
