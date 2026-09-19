# I27 — Validar composição e opacidade de janela no Windows

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
- `cargo fmt --all -- --check` e `git diff --check` passam após a correção da faixa e do tratamento de erro.
- Teste isolado da conversão 70–100% → alpha (`rustc --test`): 1 teste passou.
- A validação cruzada/visual Windows 10 e 11 permanece pendente: o target foi instalado, mas a checagem cruzada não concluiu porque o ambiente não possui `x86_64-w64-mingw32-gcc`; a recompilação Linux também foi interrompida por falta de espaço nos artefatos GTK.
