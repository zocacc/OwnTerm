# Spec — Sessões SSH

## Objetivo

Abrir terminal SSH interativo e seguro a partir de um Host, deixando visíveis os estados de conexão e exigindo confiança explícita na identidade do servidor.

## Fluxo

1. O usuário inicia um Host salvo ou fornece destino no Quick Connect.
2. A Session entra em `starting` e o backend resolve configuração e Credential Reference.
3. Para fingerprint inédita, a Session entra em `awaiting_trust` e mostra destino, porta e fingerprint.
4. A confirmação persiste o Known Host e continua a conexão; rejeição encerra a Session sem persistir confiança.
5. Se for necessário segredo indisponível, entra em `awaiting_credential`; o valor entra por command direto para o cofre/backend.
6. Após autenticação, entra em `connected`; saída, entrada e resize são encaminhados pelo IPC.
7. Timeout, cancelamento, encerramento remoto ou erro levam a `disconnected` ou `failed` com razão sanitizada.

## Escopo

- Hostname/IP, porta padrão 22, senha, chave privada local e passphrase.
- TOFU estrito, store OwnTerm de Known Hosts, terminal remoto, resize, timeout, cancelamento e reconexão manual.
- Servidor SSH local de teste com fixtures determinísticas.

## Fora do escopo

- Alterar `~/.ssh/known_hosts`, aceitar chave alterada uma vez, SFTP, port forwarding, jump hosts, agent funcional e reconexão automática.

## Critérios de aceite

- [ ] Conexão por senha e por chave privada funciona contra o servidor de teste.
- [ ] Nova fingerprint não abre sessão antes de confirmação explícita.
- [ ] Fingerprint alterada é bloqueada e informa ação de revisão segura.
- [ ] Resize, entrada e saída interativa funcionam em sessão conectada.
- [ ] Cancelamento durante handshake encerra recursos e não deixa Session conectada.
- [ ] Reconexão manual cria ciclo novo, sem reutilizar handle encerrado.
- [ ] Falhas não expõem senha, passphrase, chave ou payload de terminal em logs/eventos.

## Testes

- Integração com servidor local para handshake, senha, chave, trust, mismatch, I/O, resize e cancelamento.
- Unidade para transições de estado permitidas e mapeamento de erros sanitizados.
- E2E mockado para confirmação, rejeição, falha e reconexão.
