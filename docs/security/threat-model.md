# Modelo de ameaças

## Ativos e fronteiras

| Ativo | Proteção |
| --- | --- |
| Senhas e passphrases | Cofre do sistema; referências opacas no SQLite |
| Chaves privadas | Somente caminho persistido; conteúdo nunca é lido para persistência ou exportação |
| Identidade de servidor SSH | Store OwnTerm de Known Hosts no SQLite |
| Configurações de Hosts | SQLite local com migrations |
| Saída de terminal e erros | Runtime; logs estruturados e sanitizados |

Frontend, commands Tauri, aplicação, adapters de I/O e sistema operacional são fronteiras distintas. A interface não recebe handles, nem segredos fora do formulário de gravação direta no cofre.

## Ameaças e respostas

- **Exfiltração por persistência:** não há colunas para segredo, nem conteúdo de chave no banco ou exportação.
- **Exfiltração por observabilidade:** logs não incluem credenciais, passphrases, conteúdo de terminal sensível ou payloads de command brutos.
- **MITM SSH:** a primeira identidade exige confirmação explícita; uma identidade diferente é bloqueada e requer remoção/revisão explícita do Known Host.
- **Arquivo OpenSSH hostil ou incompleto:** o importador lê apenas diretivas permitidas, mostra prévia e relata o que ignorou antes de gravar.
- **Falha do cofre:** a conexão falha com erro acionável; não existe fallback para texto puro.
- **Dados deixados por processo:** encerrar Session encerra PTY/cliente SSH e remove seus handles de runtime.

## Propriedades verificáveis

- Exportação não contém senha, passphrase, conteúdo de chave ou Known Host.
- SQLite não possui coluna que armazene segredo.
- Uma troca de fingerprint não pode abrir sessão sem ação explícita de revisão.
- Nenhuma conexão, telemetria ou conta é necessária para os fluxos essenciais.
