# Contrato IPC

## Princípios

O frontend chama comandos para ações iniciadas pelo usuário e recebe eventos tipados para dados assíncronos de uma Session. Handles internos, bytes de chave, senha e passphrase nunca fazem parte de um evento nem de estado Zustand persistido.

## Tipos públicos

```ts
type SessionStatus =
  | "starting"
  | "awaiting_trust"
  | "awaiting_credential"
  | "connected"
  | "disconnected"
  | "failed";

type SessionDescriptor = {
  id: string;
  kind: { type: "local"; shellProfileId: string } | { type: "ssh"; hostId: string };
  title: string;
  status: SessionStatus;
};
```

## Commands

| Grupo | Operações |
| --- | --- |
| Configuração | listar shells, listar/buscar Hosts, criar, editar e excluir Host, listar grupos, favoritos e recentes |
| Segredos | salvar ou substituir senha/passphrase por referência; remover referência de credencial |
| Sessões | iniciar sessão local ou SSH, escrever entrada, redimensionar, encerrar e reconectar |
| Confiança | confirmar fingerprint inédita, rejeitar fingerprint e listar/remover Known Hosts |
| Portabilidade | pré-visualizar importação, aplicar decisões por entrada, exportar workspace e pré-visualizar exportação OwnTerm |

Commands de sessão retornam um `SessionDescriptor` ou erro tipado. Commands de segredo aceitam o valor apenas na chamada e retornam uma `CredentialRef`; a interface descarta o valor imediatamente após a resposta.

## Eventos

Eventos são identificados por `sessionId` e possuem versão de payload:

- `session.output.v1`: `{ version: 1, sessionId, data: number[] }`, preservando bytes sem assumir fronteiras UTF-8.
- `session.status.v1`: `{ version: 1, sessionId, status, reason? }`.
- `session.trust-required.v1`: destino e fingerprint inédita, sem segredo.
- `session.credential-required.v1`: referência da necessidade de autenticação, sem solicitar valor por evento.
- `session.exit.v1`: `{ version: 1, sessionId, exitCode? }`, publicado após drenar a saída pendente.

Eventos atrasados de uma Session encerrada são ignorados pela interface. A saída não é persistida pelo MVP. O transporte local aplica fila limitada e batching conforme ADR 0009.
