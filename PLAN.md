# ODK Client — plano de aplicação SPA offline-first

> STATUS: PLANEJAMENTO. Nenhuma aplicação foi implementada. Este documento não autoriza BUILD, instalação, alteração de infraestrutura nem escrita em ODK Central.
>
> Prioridade confirmada por Luciano: o aplicativo precisa funcionar offline e enviar os formulários posteriormente ao ODK Central, quando houver uma rede acessível. Esse requisito precede decisões de framework, aparência e distribuição.

**Objetivo:** criar um cliente de coleta multiplataforma, com interface SPA, inspirado no ODK Collect, capaz de preparar formulários online, coletar e persistir dados sem rede e sincronizar com ODK Central posteriormente.

**Arquitetura proposta:** interface SPA instalável como PWA, motor ODK XForms executado no dispositivo, armazenamento local transacional e fila persistente. Backend REST desacoplado para credenciais e adaptação ao protocolo do Central; não participa do preenchimento offline. A distribuição exclusivamente web depende de aprovação em testes reais de durabilidade; uma variante híbrida com armazenamento nativo é alternativa a aprovar se a PWA não satisfizer o requisito primordial.

**Stack candidata:** Vue 3 + TypeScript + Vite + componentes/motor oficiais ODK Web Forms; IndexedDB/Dexie; Service Worker; FastAPI + PostgreSQL para o adaptador REST. A escolha do motor e a admissibilidade da PWA serão decididas antes da construção do produto.

**Data da análise:** 08/11/2026. **Destino autorizado:** `/mnt/DATA/Dev/_my_odk_client`.

---

## 1. Resumo executivo e decisões já confirmadas

O projeto é viável como cliente web offline-first para um conjunto homologado de formulários e dispositivos. Não é tecnicamente correto prometer uma cópia integral do Collect ou funcionamento garantido em qualquer navegador existente.

Decisões do usuário, não abertas à rediscussão neste plano:

1. Entregar somente análise, estruturação e plano nesta etapa.
2. Usar ODK Collect como referência funcional e técnica, incluindo investigação com REA.
3. Modelar a interface como SPA, para dispositivos Android, iPhone/iOS e outras plataformas compatíveis.
4. Fazer do funcionamento offline o requisito principal, e não uma funcionalidade opcional de uma fase tardia.
5. Comunicar-se com ODK Central, preservando a interoperabilidade dos formulários e submissões, como o Collect.
6. Salvar o planejamento nesta pasta para leitura e execução posterior.
7. Reforço explícito: o funcionamento offline é o requisito principal; o aplicativo deve salvar a coleta sem rede e enviá-la ao Central quando houver conexão, e deve exibir ao usuário o que está acontecendo com esses dados.

### 1.1 Decisões técnicas fechadas nestas conversas

Registradas para a fase de implementação; não reabrir sem motivo novo:

1. **Armazenamento local: IndexedDB com transações.** `localStorage` está descartado para respostas, rascunhos, fila, anexos e tokens (limite ~5 MiB por origem, só texto, escrita síncrona e sem transação). `localStorage` pode, no máximo, guardar um marcador minúsculo de bootstrap que aponte para o banco. Anexos em Blob no IndexedDB no início; OPFS só como evolução de desempenho, não como forma de escapar de eviction.
2. **A fila vive no dispositivo.** Preencher e salvar é 100% local; o backend próprio não participa da coleta e só entra no cadastro de credenciais (QR/App User) e no encaminhamento ao Central quando há conexão.
3. **Pacote de campo completo.** Não basta ter a fila: engine, JS/WASM, labels, mídias de enunciado, CSVs e traduções precisam estar locais via Service Worker, senão não há formulário para preencher.
4. **Persistência e backup são camadas obrigatórias.** Solicitar `navigator.storage.persist()` e respeitar o resultado; exportação/restauração protegida antes de sair para o campo.
5. **Semântica de envio.** Reabrir o aplicativo é o gatilho de sincronização no iPhone (não existe Background Sync no Safari/iOS). Só marcar "enviado" após o Central aceitar XML + todos os anexos; nunca duplicar.
6. **Transparência ao usuário.** Estados de fila visíveis e distintos, com mensagem informando que os dados offline estão sendo enviados (detalhado na seção 11.2). "Salvo no aparelho" nunca pode ser exibido como "enviado".

Recomendações ainda sujeitas à aprovação:

- Preferir reaproveitar o motor web oficial; não portar Java/Kotlin tela por tela nem escrever um interpretador XPath do zero.
- Manter um adaptador REST próprio para reduzir exposição de credenciais e dependência de CORS do Central. Isso mantém os protocolos e formatos do Central, mas acrescenta um salto de rede em relação à conexão direta do Collect.
- Não lançar o produto antes de passar pelos gates OFFLINE e CENTRAL deste documento.
- Se armazenamento estritamente independente das políticas de descarte de sites for inegociável, uma PWA pura não pode ser escolhida só por conveniência: avaliar empacotamento híbrido com banco e arquivos nativos.

O primeiro resultado executável futuro deve ser a prova de coleta offline e envio posterior; não um dashboard visual conectado à internet.

## 2. O que significa “funcionar offline” neste projeto

### 2.1 Contrato obrigatório

Após uma preparação online bem-sucedida, o usuário deve conseguir, sem internet e sem contato com nosso backend ou com o Central:

- Abrir o aplicativo instalado e a lista local de formulários.
- Iniciar novas instâncias dos formulários preparados.
- Preencher perguntas, executar cálculos, relevância, obrigatoriedade, restrições e repetições suportadas.
- Consultar traduções, opções e arquivos auxiliares previamente baixados.
- Registrar e persistir os anexos e recursos de dispositivo homologados.
- Salvar rascunhos, continuar depois, revisar e finalizar localmente.
- Fechar o aplicativo, reabri-lo e recuperar tudo que foi confirmado como salvo.
- Reiniciar o aparelho e reencontrar rascunhos, anexos e fila pendente.
- Manter várias submissões pendentes, com identificação clara do que está salvo somente no dispositivo.
- Ao voltar a uma rede que realmente alcance o serviço e o Central, enviar os pendentes, com tentativas seguras diante de interrupções.
- Receber confirmação de envio somente depois de o Central aceitar o XML e todos os anexos previstos.

### 2.2 Pré-condições honestas

- Primeira instalação, cadastro de conexão e preparação de um formulário exigem conexão. Nenhum cliente consegue baixar um formulário desconhecido sem uma fonte acessível.
- Offline exige pacote completo: interface, motor, recursos JS/WASM, formulário, mídias de enunciado, arquivos CSV/XML e traduções. Carregar apenas o HTML não basta.
- Recursos externos não baixados — por exemplo, mapa remoto ou consulta HTTP arbitrária — não passam a funcionar offline automaticamente. O formulário deve ser bloqueado ou adaptado explicitamente antes do uso em campo.
- Permissões de câmera/microfone/localização continuam sujeitas ao sistema. A ausência de sinal GPS é diferente da ausência de internet; a captura de posição também depende de condições físicas e do dispositivo.
- Desinstalação, limpeza explícita dos dados, perda física ou corrupção do aparelho não podem ser cobertas por uma promessa absoluta de conservação local. Precisa existir procedimento de recuperação/backup.
- Revogação no servidor não apaga magicamente informações que já estão em um aparelho desconectado. Essa limitação precisa constar da política de dados.

### 2.3 Envio quando a rede voltar

Garantia funcional proposta: com o aplicativo aberto ou reaberto, ele identifica conectividade real, tenta enviar a fila e mantém um botão “Enviar pendentes”. Não exigir que o usuário redigite os dados.

Envio com o aplicativo totalmente fechado é uma capacidade distinta. Safari/iOS não oferece Background Sync equivalente ao dos navegadores Chromium [W3]. Mesmo onde existe, o sistema pode adiar ou encerrar o trabalho. A própria fila offline do Enketo, no ecossistema ODK, só envia automaticamente “only if the form is open” [O9]. Assim:

- A sincronização em primeiro plano é obrigatória em todas as plataformas homologadas.
- Reabrir o aplicativo é o gatilho de sincronização onde o segundo plano não existe. No iPhone, é este o comportamento garantido: fechar o app não envia sozinho; abrir de novo inicia o envio. A interface deve dizer isso ao usuário em vez de deixá-lo achar que "fechar" resolve.
- Ao reabrir, o aplicativo também revalida a sessão. Token de App User revogado ou expirado não apaga nada: a fila fica aguardando e o app pede reautorização.
- Background Sync é otimização, nunca fundamento da integridade ou da entrega.
- Se Luciano exigir envio automático sem reabrir o app, isso se torna uma decisão adicional de plataforma; nem um wrapper híbrido elimina todas as restrições de segundo plano impostas pelo iOS.

### 2.4 Gate de plataforma

A PWA só poderá ser declarada apta ao uso offline nos dispositivos/versões testados. A instalação na tela inicial e o pedido `navigator.storage.persist()` não substituem a prova de durabilidade. O navegador pode negar persistência; IndexedDB e OPFS pertencem à mesma política de armazenamento por origem [W1–W2].

Se persistência for negada ou os testes críticos falharem, não mostrar “Pronto para coleta crítica offline”. Corrigir, restringir formalmente a matriz homologada ou apresentar a alternativa híbrida para aprovação. Não reduzir o requisito offline silenciosamente para preservar a escolha de PWA.

## 3. Base analisada e confiabilidade das conclusões

### 3.1 Referência fixada

| Item | Evidência |
|---|---|
| Projeto | https://github.com/getodk/collect |
| Release retornada como latest pela API pública durante a consulta | `v2026.3.5`, publicada em `2026-09-28T17:56:05Z` |
| Commit correspondente à tag | `87bf04ec0a94e3dec1abc87db73c8326d8667162` |
| Artefato | `ODK-Collect-v2026.3.5.apk` |
| URL | https://github.com/getodk/collect/releases/download/v2026.3.5/ODK-Collect-v2026.3.5.apk |
| SHA-256 calculado e comparado com o digest da release | `82f3fa0d5b95a650f591c0f74a9b920fef448e45c02523a3aaf9505848c91a24` |
| Licença lida no arquivo `LICENSE.md` | Apache License 2.0; não inferida apenas do indicador da API GitHub |
| Motor no código de referência | JavaRosa; `gradle/libs.versions.toml:69` declara `6.0.0` |

A correspondência entre tag e release foi estabelecida; não foi realizado um build reproduzível para provar equivalência binária integral entre o código publicado e o APK.

### 3.2 Uso efetivo do REA

Executado:

1. `inspect_android_package` sobre o APK oficial: bloqueado por ausência de `REA_JADX_MCP_JAR`, que deve apontar para `jadx-headless-mcp 0.7.1`.
2. `open_binary`: identificou formato APK/archive e o SHA-256 acima.
3. `inspect_artifact(detail=summary)`: inventário estático do pacote.
4. `inspect_analysis_view`: confirmou entradas selecionadas `AndroidManifest.xml`, `classes.dex`, `classes2.dex` e `resources.arsc`.
5. Exportação das evidências em cache temporário e encerramento da sessão REA.

Identificadores para rastreabilidade:

- Inspeção pai: `ev_88ad9288770d7aa629e820e472ccf1cb11a46651398b2d49544e2d8319ff6569`.
- Resumo: `ev_1cee8b277aa79ebc5b5077683336f19dda99aaccf872fadf8b9efbb649b6c4f5`.
- Inventário: `ev_af7b413e61f4efcca0aa47228d5f3fb6a74246f36947e6ea29f5d665c7729d9b`.
- Vista das entradas: `ev_06c697f901c679fa9d55d002b1e50315b0d0bfac54d071256ba2406e433a0115`.
- Inventário reportado: 1.894 nós, 2.054 ocorrências e 2.053 arestas; zero contradições de integridade reportadas no escopo dessa inspeção.

Limites: inventário ZIP não prova semântica das classes, execução do app, validade da assinatura Android ou integridade dos bytes fora das entradas ZIP. A ferramenta também registrou colisões lógicas de nomes ao desconsiderar maiúsculas/minúsculas. Não houve decompilação nem execução do APK, emulador ou instrumentação de tráfego. Nenhuma dependência foi instalada para contornar o bloqueio.

A investigação comportamental usa o código-fonte público da versão fixada e as especificações oficiais. Isso é engenharia reversa/modelagem estática com evidência de fonte, não observação de execução.

### 3.3 Achados relevantes do Collect

Nos caminhos abaixo, `A/` significa `collect_app/src/main/java/org/odk/collect/android/`; todos se referem ao commit fixado.

| Achado observado em fonte | Localização | Consequência de projeto |
|---|---|---|
| QR importa configuração de projeto; trata conexão duplicada | `A/projects/QrCodeProjectCreatorDialog.kt:239–278`; `settings/.../SettingsImporter.kt:24–113` | Importação precisa validar e traduzir configurações; não executar configurações Android indiscriminadamente |
| Diretórios locais segregados por UUID de projeto | `A/storage/StoragePathProvider.kt:13–24,47–94` | Isolar dados, credenciais, pacotes e filas por conexão/projeto |
| Estados `incomplete`, `invalid`, `valid`, `newEdit`, `complete`, `submitted`, `submissionFailed` | `forms/src/main/java/org/odk/collect/forms/instances/Instance.java:29–57` | Separar edição/validação de transporte; um booleano `synced` é insuficiente |
| XML e arquivos são gravados, além do registro de instância | `A/tasks/SaveFormToDisk.java:335–356`; `A/database/instances/DatabaseInstancesRepository.java:184–217` | Persistência de respostas e anexos precisa de consistência e recuperação |
| Finalização valida, gera XML de submissão e pode criptografar | `A/tasks/SaveFormToDisk.java:119–144,358–430` | “Salvar rascunho” não é “finalizar”; congelar payload para envio |
| Revisão gera novo `instanceID` e usa antigo em `deprecatedID` | `A/formmanagement/finalization/EditedFormFinalizationProcessor.kt:15–29` | Editar enviado não é reenviar bytes idênticos nem sobrescrever UUID |
| Interface do motor inclui navegação, idiomas, validação, repeats e finalização | `A/javarosawrapper/FormController.kt:16–236` | Um formulário HTML simples não substitui JavaRosa |
| Envio possui negociação de tamanho, erros de autenticação e confirmação | `A/instancemanagement/send/OpenRosaServerInstanceUploader.kt:82–206,265–278` | Confirmar sucesso remoto, preservar erro e evitar redirecionamento inseguro |
| Upload pode ser dividido em múltiplos POSTs com mesmo XML | `open-rosa/src/main/java/org/odk/collect/openrosa/http/okhttp/OkHttpConnection.java:140–194` | Não confundir lote completo com primeiro POST aceito |
| Autoenvio usa política e tarefas agendadas com retry | `A/backgroundwork/SendFormsTaskSpec.kt:25–44`; `A/backgroundwork/FormUpdateAndInstanceSubmitScheduler.java:71–95` | Na web, reconstruir a fila persistente sem depender do WorkManager |
| Entidades têm criação/atualização local e reconciliação com servidor | `entities/src/main/java/org/odk/collect/entities/LocalEntityUseCases.kt:23–188` | Entidades offline não são apenas baixar um CSV |
| Há permissões, Intents, ContentProviders e serviço de microfone nativos | `collect_app/src/main/AndroidManifest.xml`; `audio-recorder/src/main/AndroidManifest.xml:4–8` | Não prometer equivalência direta dessas integrações em navegador |

O Collect aceita outros servidores OpenRosa. Seu uploader contempla respostas 201/202; o Central documenta que não retorna 202 nesse endpoint [O2]. O adaptador deste projeto deve seguir o contrato do Central, não copiar genericamente qualquer 2xx como sucesso.

## 4. Escopo funcional e compatibilidade

### 4.1 MVP proposto — já integralmente offline no escopo aprovado

| ID | Capacidade | Regra de aceite |
|---|---|---|
| RF01 | Configurar uma conexão Central por App User; múltiplos perfis isolados | Importação manual e QR com validação; sem privilégios administrativos |
| RF02 | Listar e baixar formulários autorizados | XML, versão/hash, recursos e dependências preparados como pacote consistente |
| RF03 | Diagnóstico “Pronto para usar offline” | Apenas após verificação de pacote completo, motor disponível e armazenamento aprovado |
| RF04 | Texto, números, datas/horas, notas, seleção simples/múltipla | Valores e XML compatíveis com o corpus de teste |
| RF05 | Grupos, repeats, relevância, constraints, required, cálculos e idiomas | Mesma semântica relevante ao domínio nos casos homologados |
| RF06 | CSVs/listas externas estáticas | Acesso local sem consulta ao backend durante o preenchimento |
| RF07 | Rascunhos e retomada | Reabertura offline recupera respostas e anexos confirmados como salvos |
| RF08 | Foto, arquivo e geopoint | Captação e serialização homologadas nos aparelhos; falha de permissão não destrói rascunho |
| RF09 | Revisar/finalizar e enfileirar | Validação local, payload imutável e fila persistente |
| RF10 | Envio posterior ao Central | Retry, reconciliação de resultado incerto, anexos completos e ausência de duplicação lógica |
| RF11 | Histórico local e diagnóstico de pendências | Distinguir “salvo no aparelho”, “aguardando envio” e “confirmado pelo Central” |
| RF12 | Recuperação e exportação protegida | Backup de pendentes inclui XML, anexos, hashes e metadados; restauração validada |
| RF13 | Atualização segura do aplicativo | Não perder fila, rascunhos nem versões de formulário em uso |
| RF14 | Detecção prévia de incompatibilidades | Recurso sem suporte bloqueia a coleta daquele formulário com motivo explícito |

MVP não significa “quase offline”. Significa menos tipos de recurso, mas funcionamento offline completo e verificável dos que forem admitidos.

### 4.2 Recursos condicionados ao inventário real de formulários

| Recurso | Proposta de tratamento |
|---|---|
| Entidades: leitura de listas do Central | Snapshot local consistente; diferenciar lista estática de semântica de entidade |
| Criar/atualizar entidades e usar o resultado em outro formulário ainda offline | Trilha própria obrigatória se os formulários reais dependerem disso; não declarar suportado porque o motor envia metadados de entidade |
| Assinatura/desenho, áudio, vídeo, barcode de perguntas | Incluir por necessidade do corpus e testes de dispositivo; QR de configuração é um recurso separado |
| Geotrace/geoshape e mapas offline | Homologação específica; GPS não fornece automaticamente mapa offline; prever licença e armazenamento dos mapas |
| Criptografia de submissões ODK | Candidata com apoio do motor oficial, mas precisa teste de interoperabilidade e de retomada; nunca enviar plaintext quando o XForm exigir criptografia |
| Editar submissão já enviada | Fase posterior, com cadeia `deprecatedID`, autorização e conflito; reenvio do mesmo payload fica no MVP |
| Auditoria compatível com `audit.csv` | Módulo específico; logs de diagnóstico próprios não equivalem à auditoria ODK |
| Intents Android, apps externos, impressoras e hardware especial | Fora da promessa PWA; redesenhar integração ou avaliar plugin nativo autorizado |
| Captura contínua de áudio/localização em segundo plano | Não garantida em PWA; dependente de plataforma e aprovação explícita |

Não retirar funcionalidades críticas apenas para caber no MVP. Na fase 0, um formulário essencial com Entities offline, criptografia, auditoria ou outro recurso muda o escopo mínimo de lançamento.

### 4.3 Fora de escopo inicial

Editor XLSForm, substituto administrativo do Central, gestão global de usuários, dashboards analíticos, sincronização de rascunhos entre aparelhos, migração automática do armazenamento privado do Collect, acesso a qualquer servidor arbitrário e suporte a todos os navegadores/versões históricas.

O Central permanece fonte oficial de formulários publicados, permissões, submissões recebidas e entidades do servidor. Esta aplicação é um cliente de coleta, não outro Central.

## 5. Motor de formulários: decisão antes de implementar

### 5.1 Achados que evitam caminhos desatualizados ou otimistas demais

Quatro verificações documentais mudam a estratégia e precisam ser lidas antes de escolher:

1. O repositório `getodk/web-forms` informa que foi arquivado e que o desenvolvimento migrou para `getodk/central-frontend`. Os pacotes continuam publicados separadamente [E1]. Não começar por um fork do repositório arquivado.
2. A documentação de uso do ODK afirma explicitamente que Web Forms ainda não suporta uso offline: “ODK Web Forms does not yet support offline use. If someone loses connectivity while filling out an ODK Web Forms form, they will be able to complete filling it out but will need an Internet connection before they can submit” [O9]. A matriz oficial, no commit `23c4b931a890fb235c7cfb7541d4b6191feb0c4b`, deixa sem suporte `save as draft`, `offline entities` e camadas de mapas offline, além de marcar criptografia de submissões como suportada [E2]. Renderizar um formulário com esse componente, portanto, não entrega o requisito primordial deste projeto: abertura offline, rascunho durável e catálogo local seriam trabalho nosso.
3. Enketo tem dois níveis distintos. O README atual registra que “Enketo Core doesn't provide offline caching of in-progress submissions, form transformation, or form URL management” [E5]. A documentação ODK descreve o modo offline do Enketo com rascunhos e fila, mas com uma limitação operacional clara: “Queued submissions are automatically sent **only if the form is open** in a browser when a connection is available” [O9]. Importar apenas o Core não traz essas capacidades.
4. Existe uma tensão documentada entre rascunho local e criptografia no Enketo atual: `_isAutoSaveDisabled()` retorna verdadeiro quando o formulário possui chave de criptografia, e o botão de salvar rascunho é removido nesse caso [E6]. Ou seja, “offline + rascunho recuperável + submissão cifrada” não é uma combinação que se possa prometer sem projeto e prova próprios.

Informação de apoio: em `central-frontend`, os manifests de `@getodk/web-forms` e `@getodk/xforms-engine` declaram versão `1.1.1` e licença Apache-2.0 [E3]; isso identifica o código consultado, não é ordem de instalação.

### 5.2 Alternativas

| Caminho | Benefício | Custo/limite | Recomendação |
|---|---|---|---|
| Componente e motor Web Forms oficiais mais persistência própria | Reuso de XPath/XForms, UI pronta e alinhamento ao ecossistema; caminho mais provável para paridade futura | Offline, rascunho e catálogo são trabalho nosso; lacunas documentadas de Entities offline, barcode, audit e mapas | Manter como direção de renderização e testar no spike |
| Enketo Express com fila e armazenamento próprios | Canal offline já documentado (rascunhos e fila) no ecossistema; menor distância para o requisito primordial | Exige infraestrutura adicional (a distribuição recomendada usa Docker, incluindo Redis); envio automático só com formulário aberto; criptografia desabilita autosave/rascunho [E5–E6] | Avaliar como caminho de menor risco documental no spike |
| Importar apenas Enketo Core | Controle maior sobre a integração | Não fornece cache offline de rascunhos, transformação nem gestão de URL [E5] | Não atende sozinho ao requisito offline |
| Apenas usar os formulários web já oferecidos pelo Central | Menor desenvolvimento se resolver o fluxo institucional | A oferta web atual não entrega o contrato offline deste plano [O9] | Comparar antes de criar produto redundante |
| Motor próprio em TypeScript | Controle integral | Grande risco semântico, tempo de manutenção e corrupção silenciosa de coleta | Não recomendado |
| Portar JavaRosa para navegador/WASM | Possível investigação de paridade | Não há portabilidade automática nem custo já conhecido | Não é baseline; somente se as alternativas falharem |

Consequência para o plano: nenhuma das alternativas é “cliente offline pronto”. A escolha principal é qual caminho cobra menos trabalho próprio para atingir o contrato da seção 2. A decisão fica no spike da fase 1, não neste documento.

Não presumir que a licença de um componente se aplica a todos os serviços e componentes da distribuição. As licenças atuais de Collect, do Central Frontend e de pacotes Enketo foram lidas como Apache-2.0, mas a seleção de Enketo Express ainda exige revisar NOTICE e o conjunto efetivamente implantado, além de eventuais recursos de terceiros.

### 5.3 Gate ENGINE

Usar um corpus sintético e cópias autorizadas/anonimizadas de formulários reais para verificar:

1. Carregar XML e dependências locais com todas as requisições de rede bloqueadas.
2. Executar XPath, tipos e fluxo do corpus sem divergência significativa do Collect.
3. Exportar estado de rascunho e restaurar sem regenerar indevidamente UUID, defaults ou cálculos temporais.
4. Preservar repeats, idiomas, respostas não visíveis e semântica de remoção de nós não relevantes na submissão.
5. Serializar XML, metadados e anexos aceitos pelo Central.
6. Expor uma forma segura de capturar alterações para autosave; não depender exclusivamente do evento final de envio.
7. Interceptar submissão e resolução de recursos para que o motor não envie diretamente nem busque recursos secretos fora do adaptador.
8. Verificar criptografia e Entities separadamente quando exigidas.

Se o motor não permitir salvar e restaurar rascunho com segurança, ele não passa no gate, ainda que renderize todos os campos.

O componente pronto pode não reproduzir a navegação exata do Collect. Priorizar experiência acessível por página/grupo com funcionalidade equivalente; customização profunda só depois da prova offline.

## 6. Arquitetura proposta

```text
Dispositivo
  SPA / telas / projeto ativo
       |
       +-- FormEngineAdapter --> motor XForms local
       |                         recursos do pacote local
       |
       +-- LocalRepository --> IndexedDB
       |      pacotes, rascunhos, anexos, outbox, recibos
       |
       +-- SyncCoordinator --> fila durável + retry + locks
       |          |
       |          | HTTPS / API REST própria, quando disponível
       |          v
       |      Backend adaptador
       |        sessões, credenciais protegidas, escopo,
       |        validação de destinos, ledger de tentativas
       |          |
       |          | OpenRosa / endpoints permitidos do Central
       |          v
       |      ODK Central existente
       |
       +-- Service Worker --> shell e recursos estáticos versionados
```

### 6.1 Responsabilidades

Frontend:

- Dono do fluxo offline, dos rascunhos e da fila até confirmação remota.
- Não necessita do backend para abrir o que já está preparado e desbloqueado localmente.
- Não usa chamadas HTTP para avaliar relevância, calcular campos ou salvar respostas.
- Mostra estado real de gravação e conectividade, sem confundir “Wi-Fi conectado” com “Central acessível”.

Backend:

- API REST independente; não importa componentes nem estado interno da SPA.
- Guarda credenciais de upstream cifradas e mantém sessão própria com cookie HttpOnly/Secure e proteção CSRF.
- Conecta somente a servidores Central autorizados; aplica limites, valida XML de forma segura, não interpreta lógica de formulário.
- Mantém ledger de idempotência/recibos, mas não oferece uma segunda fila de coleta nem armazena submissões indefinidamente no MVP.
- Encaminha payloads sem transformar os bytes do XML congelado. Processamento transitório de anexos tem limpeza e limites de disco/memória.
- Nunca declara sucesso definitivo se só recebeu os dados do navegador.

Central:

- Continua aplicando autorização, aceitando submissões e gerenciando dados/entidades.
- Não requer alteração de código ou acesso direto a seu banco.

### 6.2 Por que separar SPA e backend

Uma SPA puramente estática poderia conversar diretamente com Central se CORS, autenticação e política de credenciais permitirem. Isso reduz infraestrutura, mas expõe mais o token de App User ao ambiente JavaScript e exige validar o suporte CORS da instalação concreta.

O adaptador recomendado evita assumir esse suporte e permite mascarar URLs com token. Em contrapartida, vira mais uma dependência para sincronizar e precisa operar com disponibilidade e segurança. A indisponibilidade dele não pode impedir a coleta local.

Servir SPA e `/api` na mesma origem por um reverse proxy não acopla os componentes: builds, código e contrato permanecem independentes.

### 6.3 Stack e simplicidade

- Vue 3 favorece integração com o componente oficial existente; React só seria preferível com outro requisito concreto que compensasse o adaptador adicional.
- IndexedDB com uma biblioteca transacional é o armazenamento inicial. Evitar `localStorage` para respostas, mídia e tokens.
- Anexos em Blobs no IndexedDB inicialmente, permitindo commit consistente com metadados. OPFS é opção de performance futura, não forma de escapar de eviction; exigiria journal/reconciliação entre dois armazenamentos.
- FastAPI + PostgreSQL: sessão, conexão autorizada, segredos cifrados e ledger de tentativas. Redis, filas distribuídas e object storage não são necessários no baseline.
- Docker para ambiente reproduzível; configurações externas por bind mount/segredos. Nenhum container será criado nesta etapa.
- HTTPS é requisito nos aparelhos. HTTP em IP da LAN não é equivalente à exceção de desenvolvimento `localhost`.
- Hospedagem privada via rede autorizada/ZeroTier é o padrão de segurança a avaliar. Acesso público, domínio, certificados e lojas de aplicativo exigem decisão posterior.

## 7. Modelo de dados e invariantes

### 7.1 Armazenamento local proposto

| Objeto | Chave/atributos principais | Regra |
|---|---|---|
| Workspace | `workspaceId`, servidor, projeto Central, identidade local, política | Nenhum dado de outra conexão aparece por simples troca de projeto |
| FormPackage | `workspaceId`, `xmlFormId`, versão literal, hash, geração de recursos, versão de motor | Versão pode ser vazia; identidade inclui hashes, não só número de versão |
| PackageResource | pacote, caminho lógico, tipo, hash remoto, SHA-256 local, Blob | Não aceitar path traversal; recurso faltante impede prontidão |
| Draft | `localId`, pacote fixado, `instanceID`, XML de trabalho, revisão local, idioma, cursor, timestamps | Abrir rascunho não troca pacote automaticamente |
| Attachment | rascunho/instância, nome lógico, MIME, tamanho, digest, Blob protegido | Resposta não pode apontar para anexo não persistido |
| SubmissionEnvelope | identidade, XML final exato, hashes de anexos, conjunto esperado, pacote, digest | Imutável após enfileiramento |
| OutboxItem | envelope, estado, tentativas, próxima tentativa, lease, último erro | Existe antes de qualquer requisição de envio |
| SyncReceipt | identidade, tentativa, confirmação, lotes aceitos, data do servidor | Só prova sucesso quando todo o envelope foi aceito |
| EntitySnapshot/EntityOverlay | dataset, versão/base, UUID, alterações locais/dependências | Somente quando a trilha Entities for incluída e homologada |

No backend: `Connection`, `ClientSession`, `SubmissionAttempt` e `SubmissionReceipt`, com escopo por identidade/projeto; chave única para operação e digest do conteúdo. Dados pessoais não são incluídos no ledger só para facilitar debugging.

### 7.2 Máquina de estados proposta

Separar duas dimensões:

- Edição: `draft_incomplete`, `draft_invalid`, `draft_valid`, `finalized`.
- Transporte: `not_queued`, `queued`, `sending`, `retry_wait`, `auth_required`, `conflict`, `failed_permanent`, `outcome_unknown`, `confirmed`.

Essa é uma modelagem nova inspirada no Collect, não a reprodução literal de seus nomes de estado.

Invariantes obrigatórias:

1. “Salvo” só aparece após commit local concluído; antes disso, “Salvando”.
2. Respostas confirmadas como salvas não dependem de memória de página ou evento `beforeunload`.
3. Finalização congela XML, IDs, nomes e bytes dos anexos; retry reutiliza exatamente o envelope.
4. Dois cliques, duas abas ou Service Worker + página não podem enviar operações concorrentes incompatíveis.
5. `sending` abandonado após encerramento vira resultado incerto/retentável, nunca sucesso presumido.
6. Só `confirmed` permite limpeza normal de pendentes; retenção local posterior é política explícita.
7. Reenvio conserva `instanceID`; edição posterior cria revisão com novo ID e `deprecatedID`, quando suportada.
8. Atualização de formulário não migra silenciosamente rascunhos e envelopes antigos.
9. Revogação/autenticação expirada pausa sincronização, mas não elimina o que está salvo.
10. Um formulário com funcionalidade não suportada não deve coletar respostas com semântica incorreta silenciosamente.

## 8. Preparação e persistência offline

### 8.1 Pacote de campo

Fluxo online de preparação:

1. Autenticar, obter lista de formulários permitidos e escolher os necessários.
2. Baixar XML e manifesto; identificar dependências efetivas do XForm, não apenas os arquivos que o servidor conseguiu listar.
3. Baixar recursos e datasets, com limites de tamanho e nomes seguros.
4. Validar compatibilidade, referências e integridade. Manifesto incompleto não equivale a pacote completo.
5. Gravar geração de pacote em staging; somente promover atomicamente para `ready` após terminar todas as validações.
6. Preservar pacote anterior se download for interrompido. Atualização de dataset é outra geração mesmo quando o XML não mudou.
7. Garantir que shell, chunks, fontes, CSS, WASM e recursos do motor estejam locais; não depender de CDN.
8. Confirmar persistência/capacidade e executar um teste de abertura sem rede antes de liberar uso de campo.

A interface mostra data da última preparação, tamanho estimado, versão/hash, dependências e pendências. Ter uma linha no catálogo não significa estar pronto offline.

### 8.2 Autosave e recuperação

- Capturar alterações do motor e gravar snapshots locais com revisão crescente.
- Salvar em cada confirmação de resposta/navegação; debounce curto para digitação, com indicador de alteração ainda não persistida.
- Uma foto só aparece como anexada de forma definitiva após persistir seus bytes e referência.
- Testar explicitamente fechamento durante captura, serialização e transação. Não prometer recuperação de caracteres ainda marcados “Salvando”.
- Ao abrir, verificar migração de schema, referências de anexos, transações interrompidas e leases expiradas.
- A gravação precisa falhar de forma visível se faltar espaço. Não mostrar sucesso e descobrir o erro no envio.
- Exportação de recuperação é um pacote versionado e protegido contendo XML, anexos, hashes, IDs e referências de formulário; CSV de respostas não é backup suficiente.
- Restauração valida integridade, escopo, duplicatas e disponibilidade de pacotes; não envia automaticamente dados importados para um servidor diferente.

### 8.3 Cota e ciclo de vida

- Consultar `estimate()`, pedir `persist()` e conferir `persisted()`; registrar o resultado como diagnóstico, não garantia absoluta [W1–W2].
- Tratar `QuotaExceededError` e erros de I/O em todas as gravações relevantes.
- Evitar modo privado para uso de campo; não depender de uma detecção infalível de navegação privada, que não existe como contrato universal. Usar preflight, instruções e matriz de uso suportado.
- Não limpar pendentes para abrir espaço. Limpeza automática, se houver, limita-se a cache regenerável não referenciado e dados confirmados cuja retenção permita remoção.
- Evitar troca de domínio, esquema ou porta: muda a origem e pode tornar o armazenamento anterior inacessível ao novo app.
- Desbloqueio offline deve usar mecanismo local aprovado; ausência de cookie/sessão online válida não pode bloquear arbitrariamente rascunhos já autorizados para campo.
- Download de atualização e ativação do Service Worker precisam ser separados. Não aplicar `skipWaiting` de modo a substituir o aplicativo durante edição/envio sem checkpoint e compatibilidade.

## 9. Comunicação com ODK Central

### 9.1 Contrato upstream observado

Autenticação preferida: App User, com privilégio mínimo e acesso somente aos formulários concedidos. App Users não são contas administrativas e não podem ser tratados como leitores irrestritos de submissões ou datasets [O3].

| Operação | Endpoint Central documentado, sem prefixo de token |
|---|---|
| Listar formulários autorizados | `GET /v1/projects/{projectId}/formList` |
| Baixar XML | Usar `downloadUrl` da listagem; padrão documentado `/v1/projects/{projectId}/forms/{xmlFormId}.xml` |
| Manifesto | `GET /v1/projects/{projectId}/forms/{xmlFormId}/manifest` |
| Recursos | Usar `downloadUrl` do manifesto, validado contra origem e escopo autorizados |
| Enviar submissão | `POST /v1/projects/{projectId}/submission` |
| Integridade de entidades, quando aplicável | `GET /v1/projects/{projectId}/datasets/{name}/integrity` |

Com App User, usar o prefixo `/v1/key/{appUser}/...` conforme a autenticação oficial. Não inserir token em rotas visíveis da SPA nem em logs de diagnóstico. Preservar seus caracteres literalmente; não “corrigir” o token.

Regras de interoperabilidade:

- Header `X-OpenRosa-Version: 1.0` nas operações OpenRosa.
- XML/XForms é o formato de execução; XLSForm é formato de autoria. Não tentar renderizar a planilha como se fosse o contrato do cliente.
- Submissão multipart com `xml_submission_file` e anexos identificados pelos nomes referenciados no XML.
- Preservar namespaces, `xmlFormId`, versão, `instanceID`, tipos, repetições, formatos de data/hora e convenções de localização.
- HEAD pode obter limite anunciado; não assumir que o limite anunciado é o limite real do proxy/instalação. Central documenta 100 MB anunciados, com limite real dependente de implantação [O2].
- Mesmo `instanceID` com XML diferente gera conflito. Reenvio para completar mídia exige XML idêntico, inclusive entre múltiplos POSTs.
- Central retorna 201 no fluxo documentado e não retorna 202. Validar resposta OpenRosa e conclusão de todos os lotes.
- Não tratar todo 409 como “já enviado”: pode ser XML diferente, submissão excluída ou cadeia de revisão incompatível.
- Hash de um anexo ligado a dataset pode ser derivado de timestamp, não do conteúdo CSV. Manter versão/hash remoto como identificador e calcular digest local separado [O2].
- Um manifesto só lista arquivos presentes no servidor. Um anexo requerido ausente deve ser detectado antes de começar a coleta.

### 9.2 Semântica da sincronização

1. Persistir envelope e item da outbox em transação antes de tentar rede.
2. Ao iniciar/reabrir/voltar ao primeiro plano, ao receber sinal de rede e ao tocar “Enviar”, verificar alcance real do backend. `navigator.onLine` é apenas indício.
3. Obter lease por item e contexto de projeto; evitar concorrência entre abas e workers.
4. Registrar tentativa no backend antes de encaminhar; validar identidade, limites e digest.
5. Encaminhar ao Central, em lote único no caso simples ou lotes de anexos completos quando necessário. Retomada por arquivo/lote não é upload resumível por byte.
6. Persistir recibos parciais; só confirmar a instância quando todos os arquivos previstos tiveram confirmação.
7. Se conexão cair depois de o Central receber e antes de o cliente receber resposta, marcar `outcome_unknown`. Consultar ledger próprio; se ainda incerto, reenviar o mesmo envelope segundo o contrato OpenRosa. Não criar novo UUID.
8. Não depender de listar submissões remotamente com App User, pois o escopo dessa identidade não garante tal operação. A prova independente em testes pode usar uma conta de verificação autorizada.
9. Retry com backoff exponencial, jitter e teto; respeitar `Retry-After`. Estado e prazo ficam persistidos, não apenas em timer.
10. Após confirmação, manter cópia local conforme retenção aprovada; desligar exclusão automática por padrão no piloto.

A estratégia é entrega com repetição segura e reconciliação, não promessa abstrata de “exactly once”. A prova é o Central conter uma única instância lógica correta, com anexos completos, após falhas simuladas.

### 9.3 Classificação de falhas

| Falha | Comportamento esperado |
|---|---|
| Offline, DNS, TLS, captive portal, backend fora | Manter fila; não marcar como enviado; explicar condição |
| 401/403 | Pausar aquela conexão, pedir reautorização; não descartar dados nem fazer retry infinito |
| 400/422 estrutural | Erro permanente do payload ou incompatibilidade; preservar envelope para diagnóstico protegido |
| 409 | Conflito explícito para investigação/reconciliação; nunca tratar como sucesso automático |
| 413 | Reavaliar tamanho/lotes de anexos; arquivo individual excessivo requer solução explícita, sem perda silenciosa de qualidade |
| 429/5xx | Backoff com limites; estado visível e tentativa manual possível |
| Timeout após envio | Resultado incerto; replay do mesmo XML/arquivos, não nova submissão |
| Central aceita XML, falta mídia | Ainda não confirmado; completar/repetir mídia e conservar a cópia local |
| HTML de proxy em vez de resposta esperada | Mensagem sanitizada; não exibir corpo cru nem interpretá-lo como sucesso |

## 10. API REST própria proposta

Este contrato é projeto novo, não uma API existente. Deve ser formalizado em `contracts/openapi.yaml` no BUILD, com schemas, autenticação, limites e erros explícitos. O frontend não chama endpoints administrativos do Central.

| Método e rota | Entrada | Saída/semântica |
|---|---|---|
| `POST /api/v1/connections` | JSON `{label, approvedServerId, projectId, appUserCredential}` obtido de formulário seguro/QR | 201 `{connectionId, scope}` e cookie próprio; jamais devolver o segredo |
| `GET /api/v1/session` | Cookie | 200 identidade/escopos ou 401; não é requisito para reabrir dados offline |
| `DELETE /api/v1/session` | Cookie + CSRF | 204 encerra sessão própria, sem revogar automaticamente App User nem apagar pendentes |
| `PUT /api/v1/connections/{id}/credential` | Nova credencial + CSRF | 204 após validar mesma identidade/escopo permitido; troca de identidade exige reaprovação de pendentes |
| `GET /api/v1/connections/{id}/forms` | Cookie, cursor se aplicável ao adaptador | 200 catálogo normalizado, sem URLs com segredo |
| `POST /api/v1/connections/{id}/form-packages` | JSON `{xmlFormId}` | 201 descrição de pacote, XML e recursos por IDs opacos; falha se snapshot consistente não puder ser obtido |
| `GET /api/v1/connections/{id}/form-packages/{packageId}/resources/{resourceId}` | Identificadores opacos, não URL arbitrária | 200 bytes + MIME/digest; valida geração para não misturar recursos de atualizações |
| `POST /api/v1/connections/{id}/submission-attempts` | Multipart: envelope, XML final, anexos; header `Idempotency-Key` | 201 recibo quando confirmado; 200 no replay já confirmado; erro estruturado ou resultado incerto, nunca 202 interpretado como recebido pelo Central |
| `GET /api/v1/connections/{id}/submission-attempts/{attemptId}` | Cookie | 200 estado do ledger próprio: confirmado, parcial ou incerto; 404 não prova ausência no Central |
| `GET /api/v1/health` | Sem dados privados | 200/503 saúde do adaptador, sem garantia de alcance do Central |

`Idempotency-Key` pertence à API própria: não presumir suporte a esse header pelo Central. Vincular a chave a conexão, identidade, `instanceID` e digest do envelope; reutilização com conteúdo diferente retorna 409. Requisições concorrentes recebem erro retryable enquanto a primeira possui lease, não dois envios independentes.

Pacote de formulário precisa ser consistente: o backend pode usar cache temporário protegido e de curta duração para congelar os recursos durante download; alternativamente, revalidar hashes e abortar se mudarem. Não expor um descritor “imutável” que busque recursos atuais mutáveis silenciosamente.

Erro padrão proposto: `{code, message, retryable, attemptId?, details?}`. `details` sanitizado, sem token, resposta preenchida ou imagem. Exemplos de códigos: `AUTH_REQUIRED`, `UNSUPPORTED_FORM`, `PACKAGE_CHANGED`, `REMOTE_CONFLICT`, `PAYLOAD_TOO_LARGE`, `REMOTE_UNAVAILABLE`, `OUTCOME_UNKNOWN`.

## 11. Telas e jornadas

Navegação mobile proposta:

- Início: projeto ativo, condição offline, “Preparar para campo”, pendentes e alertas de armazenamento.
- Formulários: abas “No dispositivo” e “Disponíveis no servidor”; versão, tamanho e compatibilidade.
- Coleta: pergunta/página, progresso, salvar, anterior/próxima e erros acessíveis.
- Rascunhos: última gravação confirmada, formulário/versão e opção de continuar.
- Pendentes: quantidade, envio manual, progresso por instância, falhas e recuperação.
- Enviados: recibo remoto e retenção local; não confundir com consulta de todo o histórico do Central.
- Configuração: projeto, permissões, persistência, diagnóstico, política de dados e backup protegido.

Jornadas principais:

1. Antes do campo: cadastrar conexão → baixar pacote → verificar capacidade → testar abertura offline → indicador “Pronto”.
2. No campo: abrir offline → preencher → salvar → fechar/reabrir → continuar → finalizar → pendente.
3. Com rede novamente: abrir → verificar alcance → enviar → repetir em caso de falha → confirmar no Central.
4. Sem espaço/permissão: manter estado anterior válido → avisar → corrigir condição ou exportar recuperação, sem apagar pendentes.
5. Token revogado: conservar dados → pausar envio → reautorizar a mesma conexão de modo controlado.
6. Nova versão de formulário: preservar rascunhos existentes; novas coletas usam pacote novo apenas após preparação completa.

Acessibilidade: rótulos associados, erros anunciados, foco previsível, alvos de toque adequados, teclado mobile, VoiceOver/TalkBack, zoom e rotação. Nenhuma barra fixa pode cobrir “Salvar” ou “Próximo”; validar larguras de 320 a 1280 px, safe areas e teclado virtual.

### 11.2 Mensagens de fila e sincronização (requisito)

O usuário precisa entender, sem termos técnicos, o que está acontecendo com os dados. Proposta de estados e textos, escritos para o usuário final:

| Situação | Mensagem | Regras |
|---|---|---|
| Coleta salva sem rede | “3 formulários salvos neste aparelho. Serão enviados quando houver conexão.” | Só aparece após commit local concluído |
| Enviando agora | “Enviando 2 de 3…” com progresso por item | Mostrar item atual e resultado por item |
| Sem conexão / tentativa agendada | “Sem conexão com o servidor. Vamos tentar de novo automaticamente. Você também pode tocar em Enviar agora.” | Não usar contagem regressiva enganosa |
| Falha recuperável | “Não foi possível enviar 1 formulário. Os dados continuam salvos neste aparelho.” | Oferecer “Tentar novamente”; nunca prometer sucesso |
| Autorização expirada | “Não foi possível autenticar. Os dados continuam salvos. Informe o token/senha para enviar.” | Reautorizar sem perder a fila |
| Conflito no servidor | “O servidor recusou este registro (já existe com conteúdo diferente). Nada foi enviado. Os dados seguem no aparelho.” | Exige investigação; não tratar como enviado |
| Confirmado | “Enviado e aceito pelo servidor.” | Só após XML + anexos aceitos |
| Conectado, nada pendente | “Tudo enviado.” | Não mostrar barra de sync permanentemente |

Regras transversais:

- Vocabulário fixo e não ambíguo: “salvo neste aparelho”, “enviando”, “aguardando conexão”, “confirmado pelo servidor”.
- Nunca usar “sincronizado” ou “enviado” para algo que só foi salvo localmente.
- Mensagem de envio em andamento deve aparecer no topo das telas relevantes e persistir durante o processo; no iPhone, explicar que o envio ocorre com o aplicativo aberto.
- Preferir uma faixa discreta a um modal bloqueante: o usuário deve poder continuar coletando enquanto a fila envia.
- Anunciar a conclusão por leitor de tela (aria-live) e não interromper digitação em andamento.
- Contagem de pendentes sempre visível no início/lista, com o mesmo número em qualquer tela.

## 12. Segurança, privacidade e licenças

- QR de configuração pode conter credencial. Tratar como segredo, não salvar em screenshot/log/analytics; não pedir que o usuário cole credenciais no chat.
- Backend faz allowlist de servidor/projeto, valida DNS/IP e cada redirecionamento, impede SSRF, acesso a metadata services e encaminhamento de token a outro host. Hosts privados só entram por configuração administrativa explícita.
- XML/CSV/arquivos são entradas não confiáveis: bloquear DTD/entidades externas no servidor, limitar profundidade/tamanho/repeats e tempo de processamento; não usar `eval` para XPath.
- Sanitizar labels/HTML e usar CSP compatível com dependências verificadas. XSS tem acesso ao ambiente de coleta; não adicionar scripts terceiros por conveniência.
- Autenticação própria com cookie HttpOnly/Secure/SameSite apropriado; CSRF em escritas; limites por conexão; logs mascaram URLs `/key/...` e segredos.
- App Users são distribuídos por identidade/política institucional, não um token administrador compartilhado por todos.
- HTTPS é obrigatório, inclusive na rede privada. Erro de certificado não é contornado desabilitando validação.
- Respostas, fotos, geolocalização e datasets podem conter dados pessoais. Definir finalidade, minimização, retenção, responsáveis e recuperação antes do piloto.
- Proteção local em repouso é um gate de segurança: IndexedDB não é um cofre da aplicação. Escolher entre dispositivos institucionalmente gerenciados com criptografia do sistema e política aprovada, ou cofre local cifrado com chave/desbloqueio offline e recuperação projetados. Não alegar proteção forte por um PIN visual ou por guardar a chave ao lado do ciphertext.
- Se cofre local for necessário, usar primitivas/bibliotecas auditadas, chave fora dos registros em claro e testes de recuperação; não inventar criptografia. Backup deve manter a proteção. Perda da senha/chave precisa de política explícita.
- Criptografia ODK de submissão e cifragem de rascunho local são coisas diferentes. Uma não comprova a outra. Submissão criptografada deve ser congelada uma vez; recriptografar a cada retry pode mudar o XML com o mesmo ID.
- Existe tensão conhecida entre criptografia e rascunho local no ecossistema web: no Enketo atual, um formulário com chave de criptografia desabilita autosave e remove o botão de rascunho [E6]. Se algum formulário do escopo exigir submissão cifrada **e** recuperação de rascunho offline, isso é uma lacuna a resolver com projeto e prova próprios — não uma combinação herdada de graça.
- Não remover dados automaticamente no logout; oferecer bloqueio local e fluxo separado de remoção com tratamento dos pendentes.
- Preservar licenças e notices das dependências. Apache-2.0 do Collect não concede automaticamente uso de marcas/logos. “ODK Client” é nome de trabalho; identidade final deve evitar alegar produto oficial ODK.

## 13. Entidades offline — trilha com gate próprio

Se os formulários de Luciano dependerem de entidades, esta seção passa a compor o caminho crítico, não uma melhoria opcional.

A matriz do motor oficial não marca `offline entities` como suportado [E2]. Portanto, suporte a criar/atualizar entidades em submissões online não satisfaz automaticamente os workflows do Collect.

Planejar e provar:

1. Snapshot de lista com identidade, versão e metadados de aprovação.
2. Camada local de criações/atualizações, separada do snapshot remoto.
3. UUID, versão/base/branch e demais metadados segundo a especificação de Entities vigente [O6]; não inventar um protocolo simplificado.
4. Formulário B consulta alteração produzida por A ainda sem rede, quando a política permitir.
5. Dependências de envio: respeitar ordem e relação entre criação e atualização; aprovação exigida pode impedir uso local imediato.
6. Reconciliação após refresh, incluindo exclusão no servidor, atualização concorrente e mudança de versão.
7. Não reaplicar efeitos locais de revisão ou retry como se fossem uma nova criação.
8. Não remover instância pendente que sustenta uma entidade/dependência sem resolver as consequências.
9. Testes com dois dispositivos e branches concorrentes; não resolver conflitos por “último timestamp ganha” sem respaldo na especificação.

Sem essa prova, formulários que exijam encadeamento de entidades offline são bloqueados. Se forem essenciais e a PWA/motor não conseguirem satisfazê-los, reavaliar a arquitetura antes de liberar o aplicativo.

## 14. Matriz de plataformas

| Plataforma alvo | Estratégia | Riscos/condições de homologação |
|---|---|---|
| Android + Chrome estável selecionado | PWA instalada, Service Worker, IndexedDB | Cota, suspensão do processo, mídia, políticas de bateria e versão real do navegador |
| iPhone/iPad + Safari/Web App instalado | PWA na tela inicial, storage preflight e sync em primeiro plano | Persistência por heurística, ausência de Background Sync, suspensão, reabertura e pressão de armazenamento |
| Desktop Chrome/Edge/Firefox/Safari selecionados | Mesma SPA, layout responsivo | Nem todos oferecem instalação e sync em segundo plano equivalentes; arquivo/câmera dependem do dispositivo |
| WebViews/navegadores embutidos em apps | Não homologados inicialmente | Ambiente/armazenamento/permissões variam; orientar abrir no navegador suportado |
| Distribuição híbrida futura | Mesma interface e domínio; repositório local nativo por adaptador | Requer build/distribuição iOS/Android, plugins auditados e autorização; wrapper usando só IndexedDB não resolve por si o risco |

Versões mínimas, modelos e volume de campo não foram definidos pelo usuário. A fase 0 os fixa. Safari 17 introduziu melhorias relevantes da Storage API documentadas pelo WebKit [W2], mas isso não transforma “iOS 17+” em matriz já testada. A regra de sete dias do WebKit refere-se a dias de uso do navegador sem interação com o site, e o tratamento de aplicativos instalados na Tela de Início é distinto [W2]; portanto, evitar tanto “o iOS apaga toda PWA após sete dias” quanto “PWA instalada nunca perde dados”. Validar aba e aplicativo instalado separadamente.

## 15. Plano de execução por fases e gates

A execução futura deve usar tarefas pequenas com testes primeiro, revisão e autorização entre fases. Não criar um esqueleto completo antes de resolver os riscos de armazenamento e motor.

### Fase 0 — inventário e critérios reais

Entregáveis futuros: `docs/requirements.md`, `docs/compatibility-matrix.md`, `tests/fixtures/manifest.json`.

- Selecionar formulários reais autorizados e anonimizados, incluindo o mais complexo e o maior.
- Inventariar tipos, expressões, anexos, Entities, criptografia e auditoria.
- Confirmar Central de teste, versão, escopo de App User e uma conta de verificação separada quando necessário.
- Definir aparelhos/navegadores, tempo máximo offline, volume e limites de mídia.
- Confirmar política de proteção local, recuperação e distribuição privada/pública.
- Registrar quais recursos são essenciais; aprovar recorte do MVP sem diminuir o offline.

Gate G0: corpus, requisitos e cenários aprovados por Luciano. Sem acesso a dados reais, continuar apenas com sintéticos; não alegar homologação institucional.

### Fase 1 — prova de viabilidade offline antes do produto

Entregáveis futuros: experimento isolado em `spikes/offline-engine/`, `docs/adr/0001-engine-and-platform.md`, evidências em `docs/validation/offline-gate.md`.

Tarefas em ordem:

1. Selecionar/fixar versões e licenças do motor, avaliando explicitamente o componente/motor Web Forms **e** o Enketo Express com fila e armazenamento próprios, já que nenhum dos dois entrega sozinho o contrato offline da seção 2 [E2][E5][O9].
2. Criar fixture mínima com lógica, repeat, mídia e CSV.
3. Escrever teste que falhe ao tentar restaurar rascunho offline antes de existir persistência.
4. Provar serialize/restore e resolução inteiramente local dos recursos do motor.
5. Persistir pacote + rascunho + anexo; verificar commit e recuperação após encerramento.
6. Provar abertura fria offline, reboot e sessão online expirada em Android e iPhone reais.
7. Medir cota/persistência, testar falta de espaço e atualização de Service Worker.
8. Fazer uma submissão de teste após reconexão e confirmar XML/anexos no Central autorizado.
9. Rodar corpus complexo e testes iniciais de criptografia/Entities se essenciais.
10. Comparar PWA com alternativa híbrida se alguma condição offline crítica não for atendida.

Gate G1-OFFLINE + ENGINE + CENTRAL: aprovação documentada. Falha implica ajustar o caminho, não prosseguir para aparência do produto. Não deixar um teste real de vários dias ser substituído por alteração artificial do relógio.

### Fase 2 — fundação mínima após G1

Arquivos previstos: `frontend/package.json`, `frontend/src/app/`, `frontend/src/domain/`, `backend/app/main.py`, `backend/app/api/`, `contracts/openapi.yaml`, `compose.yaml` e configurações de teste.

- Criar repositório/branch apenas após autorização de BUILD; preservar este plano.
- API e frontend independentes, schemas e modelo de ameaça.
- Componentes de sessão, configuração segura, importação de QR e isolamento de conexão.
- Lint/typecheck/unitários e integração do adaptador com upstream controlado.
- Confirmar HTTPS nos aparelhos sem expor serviços indiscriminadamente.

Gate G2: conexão segura, contrato verificável e isolamento; sem dados de produção.

### Fase 3 — coleta local completa do MVP

Arquivos previstos: `frontend/src/engine/`, `frontend/src/storage/`, `frontend/src/offline/`, `frontend/src/features/forms/`, `frontend/src/features/drafts/`.

- Pacotes consistentes com diagnóstico de prontidão.
- Interface do motor e dispositivos, autosave transacional, anexos e recuperação.
- Finalização e outbox imutável; instalação e ciclo de atualização.
- Exportação/restauração protegida e testes de cota.
- Repetir testes offline reais, agora com a interface final e todo o corpus.

Gate G3: nenhuma dependência de rede durante coleta; nenhum falso “salvo”; integridade local após os cenários adversos aprovados.

### Fase 4 — sincronização resiliente

Arquivos previstos: `frontend/src/sync/`, `backend/app/central/`, `backend/app/submissions/`, `backend/app/models/`, `backend/tests/integration/`.

- Protocolo Central, fila durável, ledger, lock e retry.
- Lotes de anexos, timeout após recebimento, conflito, credencial revogada e atualização de pacote.
- Confirmar no Central as instâncias e anexos de cada cenário autorizado.
- Testar reinício do navegador e do backend entre envio e recibo.

Gate G4: cada pendente termina confirmado ou em erro explícito recuperável; nenhuma duplicação lógica ou perda silenciosa nos cenários da suíte.

### Fase 5 — recursos críticos adicionais

Arquivos previstos: `frontend/src/entities/`, `frontend/src/security/`, `frontend/src/features/media/`, conforme escopo.

- Entities offline, criptografia, auditoria, mapas, assinatura ou outros recursos escolhidos.
- Se algum deles for essencial desde G0, suas provas já começam na fase 1 e o lançamento espera sua conclusão.
- Não substituir silenciosamente recursos não suportados por campos de texto.

Gate G5: comparação com Collect e aceitação remota no corpus real; matriz de compatibilidade atualizada.

### Fase 6 — piloto e operação

Arquivos previstos: `docs/runbooks/field-preparation.md`, `docs/runbooks/recovery.md`, `docs/runbooks/releases.md`, `docs/validation/device-matrix.md`.

- Piloto controlado com aparelhos reais, período offline e volumes definidos.
- Treinar preparação antes de campo, conferência de pendentes e reabertura para envio no iPhone.
- Backup/restore de configuração e ledger, retenção, atualização/rollback e indicadores sem conteúdo pessoal.
- Publicação, DNS, infraestrutura externa ou lojas somente após autorização específica.

Gate G6: usuário aprova a operação com evidências. “Build passou” não equivale a produto aprovado para coleta em campo.

## 16. Estrutura futura de arquivos

A árvore abaixo é proposta, não foi criada nesta etapa:

```text
_my_odk_client/
  PLAN.md
  contracts/openapi.yaml
  frontend/
    src/
      app/
      domain/
      engine/FormEngineAdapter.ts
      storage/LocalRepository.ts
      storage/schema.ts
      offline/package-manager.ts
      offline/readiness.ts
      sync/outbox.ts
      sync/coordinator.ts
      security/
      entities/
      features/{projects,forms,drafts,collection,submissions,settings}/
    tests/{unit,integration,e2e}/
    public/manifest.webmanifest
    src/service-worker.ts
  backend/
    app/{api,central,connections,submissions,security,models}/
    tests/{unit,integration}/
    migrations/
  tests/
    fixtures/{xforms,resources,golden-submissions}/
    conformance/
  docs/
    requirements.md
    compatibility-matrix.md
    adr/
    validation/
    runbooks/
  spikes/offline-engine/
  compose.yaml
```

A interface `LocalRepository` permite substituir o armazenamento por um adaptador nativo se a alternativa híbrida for aprovada. Não criar múltiplas implementações ou arquitetura de plugins antecipadamente.

## 17. Plano de testes e critérios de aceite

Todos os testes abaixo são futuros. Nesta análise não foi executada a aplicação, pois ela ainda não existe.

### 17.1 Casos obrigatórios

| ID | Cenário | Resultado exigido |
|---|---|---|
| T01 | Primeiro acesso sem internet, sem instalação prévia | Explicar ausência de preparação; não fingir que há formulários disponíveis |
| T02 | Preparar pacote e abrir em modo avião | Interface e formulário funcionam sem requisições bem-sucedidas externas |
| T03 | Salvar rascunho, encerrar completamente, reabrir offline | Restaurar XML, idioma, repeats e anexos confirmados |
| T04 | Reiniciar aparelho sem rede | Mesmo resultado de T03, sem login online obrigatório |
| T05 | Várias coletas offline por período/volume aprovados | Todas preservadas; indicadores coerentes de espaço e pendentes |
| T06 | Digitar/fotografar durante falha de gravação | Não exibir “salvo”; manter estado anterior íntegro; comunicar falha |
| T07 | QuotaExceededError/disco sob pressão | Pendentes não apagados; preflight e aviso impedem falsa garantia |
| T08 | Rede cai no download de recurso | Pacote não fica `ready`; versão anterior continua disponível |
| T09 | Rede volta com captive portal/sem acesso ao Central | Não marcar como enviado nem entrar em loop agressivo |
| T10 | Central recebe; resposta ao navegador se perde | Replay conserva ID/bytes; uma instância lógica, sem perda de mídia |
| T11 | XML aceito e falha em um lote de anexos | Estado parcial/incerto; finalizar envio antes de confirmar |
| T12 | Dois cliques/abas/worker tentam enviar juntos | Lock/idempotência evitam operações conflitantes |
| T13 | Cookie expira ou token é revogado durante período offline | Dados locais permanecem; reabertura local conforme política; envio pede autorização |
| T14 | Mesmo ID com XML diferente ou cadeia deprecatedID inválida | 409 tratado como conflito, nunca sucesso |
| T15 | Nova versão do formulário/dataset durante rascunho | Rascunho conserva sua geração; novos registros usam pacote aprovado |
| T16 | Atualização de app/schema com pendentes | Migração preserva dados e permite recuperação; sem ativação destrutiva |
| T17 | Rótulo malicioso, XML com entidades externas, URL de mídia externa | Sanitização/validação impede execução e acesso indevido |
| T18 | Formulário com recurso não suportado | Bloqueio antes de coleta, com motivo e alternativa clara |
| T19 | CSV, timezone, números locais, repeats aninhados e relevance | Resultado semântico equivalente ao esperado e XML aceito pelo Central |
| T20 | Permissão de câmera/GPS negada, interrompida ou revogada | Rascunho preservado e orientação, sem travamento |
| T21 | Backup protegido e restauração em ambiente limpo | Integridade de XML/anexos/IDs; nenhuma submissão automática indevida |
| T22 | Entities A cria, B utiliza/atualiza offline, depois sincroniza | Semântica de entidade e conflitos corretos, se recurso estiver no escopo |
| T23 | Formulário criptografado, retry após falha e descriptografia autorizada | Central recebe envelope correto; conteúdo recuperável; nenhum downgrade plaintext |
| T24 | iPhone instalado, app fechado, rede retorna | Nada depende de execução oculta; reabrir inicia envio e preserva os pendentes |
| T25 | Inatividade e uso prolongado nos dispositivos reais | Evidência de conservação durante janela aprovada, sem extrapolar garantia universal |
| T26 | 320–1280 px, teclado, zoom, rotação e leitores de tela | Sem overflow horizontal indevido nem controles de navegação cobertos |
| T27 | Reiniciar backend entre POST remoto e gravação do recibo | Recuperação por replay idêntico/ledger, sem sucesso inventado |
| T28 | Trocar conexão/identidade e importar backup | Isolamento, autorização e prevenção de envio para projeto errado |
| T29 | Acompanhar a fila nas telas durante offline, envio, falha e confirmação | Usuário distingue “salvo no aparelho” de “enviado”; mensagem de envio aparece sem bloquear a coleta; nenhuma promessa de envio antes da aceitação |
| T30 | iPhone: coletar offline, fechar o app, reabrir com rede e token válido | Ao reabrir, o envio inicia e conclui; se o token foi revogado, a fila permanece intacta e o app pede reautorização |

### 17.2 Método de verificação

- Unitários: estados, serialização, compatibilidade, fila, política de retry, erros e transações.
- Integração: IndexedDB real no navegador, motor com recursos locais, backend + banco e contrato OpenRosa.
- E2E: Playwright em Chromium/WebKit/Firefox homologados, interceptação de rede e falhas injetadas.
- Dispositivos reais: obrigatórios para iPhone/Android, persistência após encerramento/reboot, mídia, bateria e política de armazenamento. WebKit em desktop não substitui Safari instalado no iPhone.
- Durabilidade real: após confirmação de salvamento, fechar forçadamente, reiniciar e retomar deve preservar respostas e anexos confirmados. Ensaiar quota cheia, persistência negada e ausência prolongada; falha nunca pode aparecer como “salvo”.
- Sensores com falha controlada: negar/revogar permissão, alternar câmera, interromper gravação e capturar localização sem rede, com limites de tamanho/duração e metas de precisão definidos pelo projeto.
- Atualização sob risco: publicar nova versão com rascunhos pendentes e aparelho offline, verificando compatibilidade entre aplicação, service worker, banco e versão do formulário.
- Conformidade: fixtures públicas e corpus real autorizado; produzir XML de referência no Collect futuramente, comparar semântica e metadados controlados. Não exigir byte a byte entre clientes quando timestamps/UUIDs legitimamente diferirem; exigir byte a byte entre retries do mesmo envelope.
- Central de teste: ler de volta registros/anexos com identidade autorizada para auditoria. HTTP 201 isolado ou mocks não encerram a homologação.
- Cada teste registra versão de app/motor, aparelho, SO, navegador, passos, IDs das instâncias e resultado. Não registrar conteúdo pessoal em evidência pública.

Comandos propostos para o futuro, após os scripts/containers existirem: `docker compose run --rm frontend npm run test:unit`, `npm run test:integration`, `npm run typecheck`, `npm run build`; no backend, `docker compose run --rm backend pytest`; suíte E2E via container de testes com `npx playwright test`. Esses comandos são contratos a configurar, não comandos executados ou garantidamente existentes hoje.

### 17.3 Metas para dimensionamento — provisórias, não resultados

Proposta inicial para discussão: testar período de 7 dias de uso offline e 14 dias de inatividade; 100 instâncias pendentes; até 250 MiB de dados locais; formulário com 200 perguntas e 100 ocorrências de repeat. Esses números são cenários de ensaio, não limites homologados nem estimativas da demanda real. Ajustar ao pior caso do portfólio e aos aparelhos na fase 0.

A meta de integridade é zero perda de dados que a UI tenha confirmado como salvos nos cenários de falha homologados. Medir tempo de abertura, autosave e envio; aprovar limites de desempenho depois de estabelecer aparelho e corpus de referência.

## 18. Riscos, mitigação e alternativas

| Risco | Impacto | Mitigação / decisão |
|---|---|---|
| Nenhum motor web entrega offline completo hoje | Crítico para o requisito primordial | O contrato da seção 2 exige trabalho próprio (rascunho durável, catálogo, fila) em qualquer caminho; decidir no spike entre Web Forms e Enketo Express [E2][E5][O9] |
| Criptografia desabilita rascunho/autosave no ecossistema web | Alto quando o formulário exigir ambos | Tratar como lacuna a projetar e provar; não presumir rascunho recuperável em formulário cifrado [E6] |
| Navegador descarta dados ou nega persistência | Crítico para requisito primordial | Gate em dispositivos, preflight, backup e alternativa de armazenamento nativo; não mascarar o risco |
| Motor renderiza mas não restaura estado fielmente | Crítico | Spike de serialize/restore antes de telas e catálogo |
| Lacuna de XPath/recurso produz dados errados | Crítico | Corpus, bloqueio fail-closed e comparação com Collect |
| Atualização ativa schema incompatível em campo | Crítico | Gerações, migração transacional e checkpoint/rollback testados |
| Resultado de envio ambíguo | Alto | Envelope congelado, ledger, replay seguro e verificação no Central |
| Entities parecem simples CSV e divergem offline | Alto | Trilha própria, protocolos e testes com dependências/conflitos |
| Token/QR vaza em logs, URLs ou XSS | Alto | Adaptador, CSP, mascaramento, menor privilégio e revisão de segurança |
| Volume real excede testes ou cota | Alto | Dimensionamento do pior caso, monitoramento e bloqueio seguro de preparação |
| iOS não sincroniza com app fechado | Expectativa operacional | Contrato explícito de reabertura; avaliar nativo se exigido |
| Copiar todo o Collect torna projeto inviável | Prazo/manutenção | Matriz orientada pelos formulários reais; sem fingir paridade total |
| Dependência de biblioteca upstream muda API | Manutenção | Pin, adapter estreito, corpus de regressão e atualização controlada |
| Novo backend adiciona ponto de falha | Disponibilidade do envio | Coleta independente dele, monitoramento e recuperação; avaliar modo direto somente se necessário e seguro |

Não estimar prazo fechado antes de G0/G1. Complexidade cresce sobretudo com Entities offline, auditoria, mapas, grandes anexos e paridade completa de XForms — não com o número de telas.

## 19. Pendências para a próxima decisão

As perguntas abaixo não impedem a entrega deste planejamento, mas precisam ser resolvidas antes do BUILD correspondente. O item 4 já está fechado e permanece apenas como registro:

1. Quais formulários são essenciais no primeiro piloto? Há dependência de Entities offline, auditoria ou criptografia?
2. Qual é o tempo e o volume máximos de coleta sem rede? Quantidade e tamanho de fotos/áudios/vídeos?
3. Quais aparelhos e versões mínimas de Android/iOS serão homologados?
4. ~~Enviar ao reabrir o aplicativo atende à operação, ou envio com app fechado é obrigatório?~~ **Fechado:** enviar ao reabrir atende. No iPhone, o envio acontece com o aplicativo aberto; a interface informa isso. Ver seções 2.3 e 11.2.
5. O usuário aceita distribuição híbrida com armazenamento nativo se a PWA pura não atingir o nível de durabilidade necessário?
6. Qual Central de teste poderá receber dados sintéticos, com quais identidades e autorização?
7. A aplicação será privada por VPN/rede institucional ou precisará de acesso público? Qual política de proteção local e retenção?

Ponto de partida recomendado quando houver autorização: fase 0 e, em seguida, somente a prova da fase 1. Não começar construindo toda a aplicação.

## 20. Fontes e trilha de evidências

### ODK / protocolos

- [O1] Collect, fonte fixada: https://github.com/getodk/collect/tree/87bf04ec0a94e3dec1abc87db73c8326d8667162 ; release: https://github.com/getodk/collect/releases/tag/v2026.3.5
- [O2] Central OpenRosa, cabeçalhos, listagem, manifesto, uploads, conflitos e Entities Integrity: https://docs.getodk.org/central-api-openrosa-endpoints/
- [O3] Autenticação e escopo de App Users: https://docs.getodk.org/central-api-authentication/
- [O4] ODK XForms: https://getodk.github.io/xforms-spec/ ; lógica: https://docs.getodk.org/form-logic/
- [O5] Criptografia de submissão: https://getodk.github.io/xforms-spec/encryption
- [O6] Especificação de Entities: https://getodk.github.io/xforms-spec/entities
- [O7] Visão funcional Collect: https://docs.getodk.org/collect-intro/
- [O8] Form submission: https://docs.getodk.org/openrosa-form-submission/
- [O9] Submissões web: afirma que Web Forms não suporta uso offline e descreve a fila do Enketo enviada somente com o formulário aberto: https://docs.getodk.org/central-submissions/ (texto-fonte consultado em https://github.com/getodk/docs/blob/master/docs/central-submissions.rst)

### Motores e reuso

- [E1] Migração do Web Forms para Central Frontend: https://github.com/getodk/web-forms/blob/main/README.md
- [E2] Matriz Web Forms fixada no commit consultado: https://github.com/getodk/central-frontend/blob/23c4b931a890fb235c7cfb7541d4b6191feb0c4b/packages/web-forms/README.md
- [E3] Manifesto/licença do motor: https://github.com/getodk/central-frontend/blob/23c4b931a890fb235c7cfb7541d4b6191feb0c4b/packages/xforms-engine/package.json ; componente: https://github.com/getodk/central-frontend/blob/23c4b931a890fb235c7cfb7541d4b6191feb0c4b/packages/web-forms/package.json
- [E4] Enketo Core, licença consultada: https://github.com/enketo/enketo-core/blob/master/LICENSE
- [E5] Enketo, níveis de integração e limite do Core: https://github.com/enketo/enketo/blob/main/README.md
- [E6] Enketo Express, controle de autosave/rascunho com formulário cifrado: https://github.com/enketo/enketo/blob/main/packages/enketo-express/public/js/src/module/controller-webform.js
- [E7] Fila offline do Enketo e envio apenas com o formulário aberto: ver [O9].
- [E8] CORS de uma SPA externa contra uma implantação Central concreta: não verificado; o backend próprio evita depender dessa hipótese.

### Plataforma web

- [W1] MDN, quotas, persistência e eviction: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- [W2] WebKit, política de armazenamento e Storage API: https://webkit.org/blog/14403/updates-to-storage-policy/
- [W3] MDN, suporte e restrições de Background Sync: https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API
- [W4] MDN, Service Worker, HTTPS e ciclo de atualização: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

Documentação web consultada em 08/11/2026; fontes vivas podem mudar. As versões dos motores e capacidades devem ser reconferidas no início do BUILD.

### Pesquisa delegada e rastreabilidade

Além da inspeção direta, três investigações públicas foram executadas em paralelo e tiveram seus trechos-chave reconferidos antes de entrar neste plano: comportamento dos módulos Android do Collect (fonte fixada) e levantamento documental sobre motores/protocolo e sobre limites de SPA/PWA offline. Os relatórios completos de pesquisa ficaram em cache temporário (`/home/luciano/.hermes/cache/scratch/`), inclusive `odk-engine-conclusoes.md`. As conclusões materiais foram verificadas nas fontes primárias citadas; fontes secundárias não são usadas como prova final.

### Artefatos temporários da investigação

Fonte e APK foram baixados apenas para `/home/luciano/.hermes/cache/scratch/odk-client-analysis-20261108/`. Não são dependências do futuro projeto nem devem ser versionados junto à aplicação.

Bundle REA temporário: `/home/luciano/.hermes/cache/scratch/odk-client-analysis-20261108/rea-evidence.json`; exportação verificada por leitura/parsing, 4.624.524 bytes e SHA-256 `92f95ddd26a64372f1ee6f2c0e0d4f5b7a177fc7c7fd64000ad4dd4b54082165`. Cache pode ser expurgado; este documento preserva identidade, evidências principais, limitações e URLs suficientes para repetir a inspeção. Os IDs REA não devem ser tratados como links permanentes fora do bundle/sessão.

## 21. Verificação da etapa de planejamento

- [x] Referência oficial localizada e fixada por versão/commit.
- [x] APK oficial inspecionado com REA e hash conferido.
- [x] Limitação de decompilação registrada, sem instalar/configurar ferramentas.
- [x] Fluxos de projeto, rascunho, finalização, upload, revisão e entidades modelados a partir de fonte.
- [x] Offline elevado a requisito principal conforme reforço explícito do usuário.
- [x] Protocolos Central e diferença entre reenvio/revisão documentados.
- [x] Alternativas de motor, arquitetura, dados, API, UX, segurança e fases propostas.
- [x] Gates reais de persistência, interoperabilidade e plataforma definidos.
- [x] Pendências e ausência de testes runtime expressamente registradas.
- [x] Decisões técnicas fechadas (IndexedDB, fila local, pacote completo, persistência/backup, gatilho de envio ao reabrir, mensagens ao usuário) consolidadas em §1.1 e §11.2.
- [ ] BUILD autorizado — pendente, não iniciar nesta etapa.
- [ ] Homologação em dispositivos/Central — futura; nenhuma alegação de funcionamento já comprovado.

**Conclusão:** a arquitetura será escolhida para cumprir a coleta offline e a entrega posterior íntegra ao Central. A preferência por SPA/PWA não tem precedência sobre a conservação dos dados. Este plano permite iniciar uma prova técnica objetiva, mas não confunde pesquisa estática com aplicativo implementado ou offline já garantido.
