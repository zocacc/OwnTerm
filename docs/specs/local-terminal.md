# Spec — Terminal local

## Objetivo

Permitir abrir e operar shells locais interativos em abas, com comportamento de terminal preservado durante resize e encerramento.

## Escopo

- Detectar PowerShell e CMD no Windows 11; detectar distribuições WSL quando disponíveis.
- Exibir Shell Profiles disponíveis e iniciar uma Session local a partir de um perfil.
- Criar PTY, enviar entrada, encaminhar saída ANSI, redimensionar e encerrar o processo filho.
- Exibir exit code quando o processo o fornecer.
- Permitir múltiplas abas, alternância, fechar aba, copiar e colar.

## Fora do escopo

- Cadastro de executáveis/argumentos arbitrários, split panes, duplicação de sessão e persistência da saída.

## Contrato

`list_shell_profiles` retorna somente perfis disponíveis. `start_local_session(shellProfileId)` retorna um Session Descriptor; `write_session`, `resize_session` e `close_session` exigem seu `sessionId`. Saída, estado e exit code chegam em eventos da Session.

A saída usa chunks binários com fila limitada e batching curto; o evento de exit só é publicado após a drenagem do pump. A entrada digitada é agrupada antes do command IPC, colagens são enviadas sem interpretação e resize usa debounce. Fechamento é idempotente e a interface mantém tombstones para ignorar eventos atrasados.

## Critérios de aceite

- [x] PowerShell e CMD aparecem e podem abrir uma aba interativa no Windows 11.
- [x] WSL não disponível não é erro e não deixa item quebrado na interface.
- [x] Resize do painel redimensiona o PTY ativo.
- [x] Sequências ANSI e aplicações interativas básicas não são corrompidas pelo IPC.
- [x] Fechar aba encerra o processo e a interface recebe o estado final/exit code quando houver.
- [x] Copiar/colar funciona sem a interface tentar interpretar comandos ou saída.

## Testes

- Unidade para detecção e serialização de Shell Profile.
- Integração PTY em Windows para PowerShell e CMD: entrada, saída, resize e encerramento.
- Componente para criação/fechamento/troca de abas e eventos atrasados de sessão encerrada.
