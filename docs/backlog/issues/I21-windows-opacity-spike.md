# I21 — Validar composição e opacidade de janela no Windows

**Status:** in progress
**GitHub:** [#49](https://github.com/zocacc/OwnTerm/issues/49)
**Dependências:** I16

## Objetivo

Descobrir e validar o adapter nativo necessário para Window Opacity em Windows 10 e 11, sem acoplar React ou o domínio a APIs de sistema.

## Escopo

- [x] Implementar adapter isolado para aplicação, atualização, restauração e detecção de capacidade da opacidade nativa.
- [ ] Registrar matriz Windows 10/11, comportamento de erro e impacto de decorations/window effects.
- [x] Definir contrato `WindowOpacitySupport`/`WindowOpacityError` com fallback sólido fora do Windows e em falhas nativas.
- [ ] Atualizar a spec e criar ADR somente se a decisão tiver trade-off duradouro.

## Fora do escopo

Persistência, diálogo Appearance, opacidade do canvas xterm e publicação de Release.

## Critérios de aceite

- [ ] Evidência reproduzível identifica o mecanismo escolhido ou confirma fallback por plataforma.
- [ ] Falha nativa não encerra o app nem deixa a janela ilegível.

## Testes

- [x] Teste determinístico de conversão percentual → alpha e capacidade do fallback não-Windows.
- [ ] Verificação manual em Windows 10 e 11.

## Evidência do spike

- `apps/desktop/src-tauri/src/window_opacity.rs` encapsula `HWND`, `WS_EX_LAYERED` e `SetLayeredWindowAttributes(LWA_ALPHA)`; o estilo original é preservado e restaurado quando a opacidade retorna a 100%.
- Tauri 2.11 fornece `set_effects` para Mica/Acrylic, mas não uma API de opacidade percentual; por isso o adapter usa a API Win32 diretamente somente na fronteira Tauri.
- `cargo test -p ownterm-desktop window_opacity --lib`: 2 testes passaram no Linux.
- A validação cruzada/visual Windows 10 e 11 permanece pendente: este ambiente não possui runner Windows e a instalação do target `x86_64-pc-windows-gnu` falhou por falta de espaço em disco.
