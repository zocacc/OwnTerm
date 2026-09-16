# I24 — Tornar o workspace integralmente terminal-first

- **Status:** planned
- **GitHub:** [#60](https://github.com/zocacc/OwnTerm/issues/60)
- **Dependências:** I21
**Epic:** [E11 — Shell terminal-first](../epics/E11-terminal-first-shell.md)

## Objetivo

Remover chrome redundante abaixo da title bar e realocar feedback/ações para que a sessão ativa ocupe toda a área útil.

## Escopo

- [ ] Remover `session-info` e seus badges duplicados.
- [ ] Remover a status bar permanente.
- [ ] Fazer `terminal-workspace`/`terminal-stage` ocupar toda a área abaixo da title bar.
- [ ] Reduzir o wrapper de `TerminalSurface` a padding interno de `8–12px`.
- [ ] Criar região de feedback transitório com `aria-live` para erro, exit code e informações relevantes.
- [ ] Oferecer ação de reconexão em feedback de falha e/ou menu contextual de aba.
- [ ] Preservar copiar/colar por terminal/atalhos e retirar dependência do footer.
- [ ] Redesenhar estado vazio com “Open default shell” e “Open connections”.
- [ ] Garantir que resize visual execute fit/resize apenas na sessão ativa.
- [ ] Manter todas as sessões abertas montadas exatamente uma vez.

## Fora do escopo

Split panes, scrollback persistente, gravação de sessão, configuração de fonte/opacidade e command palette.

## Invariantes

- Feedback não inclui payload do terminal nem segredo.
- Eventos tardios de sessão fechada continuam ignorados.
- Remoção do footer não reduz a capacidade de reconectar, copiar, colar ou diagnosticar exit code.

## Critérios de aceite

- [ ] Somente a title bar ocupa espaço permanente fora do terminal.
- [ ] Terminal começa imediatamente abaixo dela e preenche o restante.
- [ ] Falha, desconexão e exit code continuam visíveis e acessíveis.
- [ ] Reconexão SSH continua alcançável.
- [ ] Estado vazio permite abrir shell e conexões.
- [ ] Abrir overlays não perde buffer, seleção ou foco definitivamente.

## Testes

- [ ] Estado vazio e ações primárias.
- [ ] Saída, status, exit code, erro e reconexão.
- [ ] Cópia/cola sem status bar.
- [ ] Identidade/mount único de `TerminalSurface` durante mudanças visuais.
- [ ] Resize em troca de aba, janela e retorno de overlay.

## Entrega observável

Com uma sessão aberta, toda a janela abaixo da barra apresenta somente o terminal e feedback temporário quando necessário.
