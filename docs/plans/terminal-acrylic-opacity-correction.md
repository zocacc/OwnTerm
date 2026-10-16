# Plano — transparência do terminal sobre Desktop Acrylic

Estado: implementação revisada e checks locais aprovados; gates completos acompanham o commit na PR #69. **Aceite visual Windows pendente**.

## Resultado acordado

Interface Opacity e Terminal Background Opacity são independentes. Com interface em 100% e terminal em 55%, as células de fundo padrão devem revelar o desktop ou outras janelas atrás do OwnTerm, ao vivo e com Acrylic. Em 100%, o fundo do terminal deve ficar sólido; texto e cursor permanecem opacos. O usuário escolheu Acrylic nativo e aceitou a tonalidade do sistema, em vez de um compositor próprio.

## Causas verificadas

- O xterm 6 mantém uma viewport legada preta: o override em `terminal.css` a torna transparente. Isso é necessário, mas não suficiente para provar o resultado nativo.
- A revisão anterior forçava fallback opaco no Windows build 22621+, bloqueando deliberadamente o fundo externo no Windows 11 moderno.
- `WindowControls` e o carregamento de Appearance atualizavam o material por respostas independentes. Uma resposta tardia podia voltar o documento para `data-material="opaque"` após uma preparação bem-sucedida.
- Testes de RGBA, mocks e build verde não demonstravam a composição visual completa.

## Correção

- Restaurar Desktop Acrylic no Windows 11 build 22621+ via `DWMSBT_TRANSIENTWINDOW`, verificando o HRESULT. Manter o adapter legado nas versões anteriores.
- Carregar preferências e configurar material no mesmo caminho, após a montagem. Guardar o resultado em estado sincronizado, reutilizado por leituras e saves que não alteram `useAcrylic`.
- Restringir `prepare_window_chrome` a metadados dos controles; nenhuma resposta desse comando modifica o material.
- Manter WebView, documento e wrappers transparentes quando o material estiver ativo; aplicar alfa exclusivamente ao fundo padrão do xterm. Acrylic desabilitado ou falha nativa produz fallback sólido.
- Preservar chaves persistidas e padrões; ampliar o terminal para 0–100% conforme o retorno do usuário. Registrar as definições em `CONTEXT.md` e a decisão em ADR 0011.

Não é necessário atualizar `window-vibrancy` para esta correção. A alegação anterior de que a dependência `^0.6` do Tauri impediria por si só a coexistência com 0.8 não foi demonstrada e foi retirada. O adapter moderno usa diretamente a API DWM documentada para verificar o retorno real.

## Evidência por fronteira

1. App/IPC: reproduzir estado opaco após resposta tardia dos controles, depois verificar estado estável; preservar avisos e independência dos sliders.
2. Chromium: executar App, TerminalSurface, xterm e CSS reais sobre fundo externo contrastante. Medir as combinações 100/55, 55/100, 55/55 e 100/100; verificar glyphs opacos, fallback e preservação da instância.
3. Windows: testar o instalador no computador do usuário conforme `../qa/E11-windows-acceptance.md`, registrando SHA e ambiente. Só esta etapa comprova blur sobre desktop/janelas reais.

Evidência local: 35 testes Vitest aprovados, typecheck/build/lint/format aprovados (um aviso de lint preexistente), testes dos crates não-Tauri aprovados e testes do estado de material executados separadamente. O teste App reproduziu `backdrop → opaque` antes da correção e passou depois. No Chromium, terminal 55% sobre RGB(240,180,80) produziu RGB(115,89,48), e terminal 100% produziu RGB(12,15,21), independentemente do chrome. Reintroduzir temporariamente a viewport preta fez o mesmo teste falhar com RGB(7,8,12); a transparência foi restaurada. O CI retém as capturas em `terminal-composition-chromium`.

Sucesso da chamada DWM indica que a configuração foi aceita; políticas de acessibilidade, transparência ou energia do Windows podem produzir outro resultado visual. A matriz Windows deve registrar essas condições, sem prometer que um booleano ou screenshot Chromium prova Acrylic.

## Ajuste após retorno: ambos em 0%, sem aviso de fallback

- O limite anterior de 55% ainda existia no frontend e no domínio; 0% persistido era substituído pelo padrão. Agora ambas as preferências aceitam 0–100%, mantendo os padrões 92/82.
- Com Appearance aberto, seu overlay aplicava escurecimento de 58% e blur CSS sobre todo o terminal, independentemente dos sliders. Remover esse véu somente de Appearance; preservar foco modal, overlays dos demais diálogos e fallback nativo.
- Regressão Chromium mede também 100/0 e 0/0, com o diálogo fechado e aberto. Antes da correção do overlay, o ponto externo RGB(240,180,80) ficava RGB(106,81,42) com Appearance aberto; após a correção mantém RGB(240,180,80). Testes App/IPC e domínio verificam gravação e round-trip de 0%.
- Essa evidência prova a remoção das camadas web identificadas, não o resultado visual de Acrylic no Windows do usuário; o aceite nativo permanece pendente.
