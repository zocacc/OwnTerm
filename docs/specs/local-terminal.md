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

## Critérios de aceite

- [ ] PowerShell e CMD aparecem e podem abrir uma aba interativa no Windows 11.
- [ ] WSL não disponível não é erro e não deixa item quebrado na interface.
- [ ] Resize do painel redimensiona o PTY ativo.
- [ ] Sequências ANSI e aplicações interativas básicas não são corrompidas pelo IPC.
- [ ] Fechar aba encerra o processo e a interface recebe o estado final/exit code quando houver.
- [ ] Copiar/colar funciona sem a interface tentar interpretar comandos ou saída.

## Testes

- Unidade para detecção e serialização de Shell Profile.
- Integração PTY em Windows para PowerShell e CMD: entrada, saída, resize e encerramento.
- Componente para criação/fechamento/troca de abas e eventos atrasados de sessão encerrada.
