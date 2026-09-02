# Spec — Importação e exportação

## Objetivo

Permitir migrar configurações SSH e transportar um workspace OwnTerm de forma compreensível, versionada e sem segredos.

## Importação OpenSSH

O parser reconhece blocos `Host` com alias concreto e as diretivas `HostName`, `User`, `Port` e `IdentityFile`. Padrões (`*`, `?`, `!`), `Include`, `ProxyJump`, diretivas desconhecidas e blocos sem alias concreto são ignorados e relatados na prévia.

A prévia classifica cada entrada em criar ou conflito. Para cada conflito, o usuário escolhe criar, atualizar ou ignorar. Aplicar a seleção é transacional: erro de validação ou gravação não deixa importação parcial. Caminhos de chave são preservados como metadados; arquivos não são lidos, copiados ou exportados.

## Exportação OwnTerm

O formato é JSON legível e versionado:

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-09-02T12:00:00Z",
  "groups": [],
  "hosts": [],
  "settings": {}
}
```

IDs, campos obrigatórios, validação e estratégia de conflito são definidos no schema da spec de persistência. Senhas, passphrases, conteúdo de chave, Credential References e Known Hosts são sempre omitidos. Ao reimportar, Hosts exigem configuração de credencial no destino quando ela for necessária.

## Fora do escopo

- Interpretação completa de OpenSSH, download de arquivos, criptografia de backup, merge automático e sincronização remota.

## Critérios de aceite

- [ ] Uma prévia informa entradas reconhecidas, conflitos e diretivas ignoradas antes de gravar.
- [ ] A seleção por entrada respeita criar, atualizar e ignorar em uma transação.
- [ ] Exportação é validável por versão e pode ser reimportada.
- [ ] Nenhuma exportação contém segredos, referências de cofre ou Known Hosts.
- [ ] Falha de parser ou persistência produz relatório acionável sem modificar o workspace.

## Testes

- Fixtures para aliases, campos válidos, padrões, diretivas ignoradas, portas inválidas e IdentityFile.
- Integração para preview, conflitos, rollback transacional, exportação e reimportação.
- Teste de propriedade/inspeção para ausência de nomes/campos de segredo no JSON gerado.
