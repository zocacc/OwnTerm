# Auditoria e reprodução — composição nativa sem xterm

Estado: teste nativo pendente. Nenhum print foi anexado ao pedido atual; a duplicação visual ainda não está confirmada. Não iniciar a entrega 2 do redesign.

## Constatações

- Windows usa `decorations:false`, `transparent:true`, `shadow:true`, sem `titleBarStyle`. O App renderiza um único TitleBar/WindowControls; não há segundo conjunto React.
- Tao conserva flags Win32 de caption/menu/minimizar/maximizar e suprime a área não cliente via WM_NCCALCSIZE. Flags isolados não provam outra titlebar desenhada; removê-los sem evidência arrisca resize e comportamento da janela.
- Wry já configura o WebView2 com RGBA(0,0,0,0), antes e depois da criação do controller, e a classe de container usa brush nulo. O diagnóstico lê o valor efetivo, sem repetir setters.
- O reset legado ainda adicionava WS_EX_LAYERED e chamava SetLayeredWindowAttributes(255), restaurando o estilo original quando antes não era layered. Foi removido o adapter, seu estado e seu chamador. HWNDs novos não herdam estilos de versões anteriores. Isso elimina uma transição redundante; não demonstra que o cinza era causado por ela.
- Containers principais são transparentes no caminho de material configurado. O fundo sólido estrutural existente é o fallback identificado; a opacidade da interface afeta fundos CSS, e a do terminal só o background RGBA do xterm. Texto/cursor não usam alpha global.

## Teste do Windows

Baixar `ownterm-transparency-diagnostic` do CI do SHA atual, extrair **todo** o ZIP, fechar outras instâncias do OwnTerm e executar `Start-TransparencyTest.cmd`. O launcher usa o mesmo executável/configuração do instalador com `--transparency-test`. Alternativa: iniciar manualmente o executável instalado com esse argumento.

O bootstrap escolhe o modo antes de importar App, CSS da aplicação ou xterm. O teste não abre Session nem lê/grava preferências visuais. O serviço desktop abre seu banco normalmente na inicialização, mas os comandos de diagnóstico não modificam seu conteúdo.

1. **Pass 1:** texto no DOM, sem React, titlebar customizada ou xterm. Mover uma janela colorida atrás e registrar se há desfoque real ou fundo uniforme.
2. **Pass 2:** adicionar somente root/texto React; repetir a mesma observação.
3. **Pass 3:** adicionar titlebar customizada com os controles existentes; verificar um único conjunto de controles, drag, minimizar/maximizar/restaurar.
4. Usar **Copy diagnostic report** em cada passe; anexar resultados e screenshots sanitizados. Se o clipboard falhar, o JSON pode ser selecionado em Native and DOM measurements.
5. Para encerrar os passes sem titlebar, usar Alt+F4. Não reintroduzir o xterm no teste nem avançar ao restante do frontend até o teste mínimo revelar corretamente o conteúdo externo.

O painel pequeno de diagnóstico é opaco para leitura; não cobre a área de teste. O restante da janela tem fundo transparente forçado. Nenhuma confirmação automática de “Acrylic visível” é feita.

## Medidas e interpretação

- Relatório: ID do run/build, SO, versão WebView, tema, contagem de janelas Tauri, configuração e decoração efetiva, flags HWND, tipo de backdrop DWM, limites dos botões de caption, RGBA efetivo do WebView e estilos computados das camadas DOM.
- Sem dados de Hosts, credenciais, saída/comandos de terminal, argumentos arbitrários ou endereços de HWND.
- Cinza já no Pass 1: investigar Tauri/WebView/DWM/políticas do Windows; não atribuir ao xterm.
- Pass 1 correto e falha após React/titlebar: a fronteira que introduziu a diferença está identificada para o próximo teste controlado.
- Alfa WebView zero e API aceita ainda não provam pixels transparentes. Existe relato aberto semelhante no Runtime154; não é diagnóstico confirmado deste projeto.
- Chromium mede apenas isolamento e composição web sobre cor externa. O teste inicialmente falhou por ausência do diagnóstico; o teste verde não é uma reprodução/correção comprovada do cinza nativo.

## Referências

- [WebView2 DefaultBackgroundColor](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2controller2).
- [Relato WebView2 #5752, Runtime154 e fundo opaco com alfa zero](https://github.com/MicrosoftEdge/WebView2Feedback/issues/5752), aberto em 2026-10-08; hipótese externa não confirmada.
- Fontes já instaladas: Tao0.35.3 window_state.rs/event_loop.rs, Wry0.55.1 webview2/mod.rs. Nenhum clone ou versão nova desses componentes foi introduzido. As referências COM diretas reutilizam exatamente as versões já transitivas do lockfile.

## Ciclo de vida

Rota, comandos e artefato são instrumentação temporária do gate. Removê-los quando a origem for confirmada e a correção nativa aceita; manter apenas regressões que cubram o defeito demonstrado. Não distribuir este ZIP como release nem tratá-lo como evidência de Acrylic aprovado.
