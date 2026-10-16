# Desktop Acrylic nativo sob o terminal

O OwnTerm usa Desktop Acrylic do Windows para revelar o desktop e outras janelas através do fundo padrão do terminal. Aceitamos a tonalidade e as políticas do sistema; os sliders ajustam independentemente as superfícies da interface e o fundo do xterm, sem tornar texto ou cursor translúcidos. Mica não atende ao requisito de mostrar outras janelas, e um compositor próprio para controlar tint/luminosity não se justifica para esta entrega.

No Windows 11 build 22621+, o adapter chama `DwmSetWindowAttribute(DWMWA_SYSTEMBACKDROP_TYPE, DWMSBT_TRANSIENTWINDOW)` e verifica o HRESULT. Nas versões anteriores permanece o adapter legado; seu retorno não comprova a composição visual. Falha nativa ou Acrylic desabilitado usam fundo sólido e preservam preferências. Sucesso da API e CI verde não substituem o aceite visual do instalador Windows.

A fundação terminal-first também estende o frame sobre a área cliente via `DwmExtendFrameIntoClientArea` com margens negativas, verificando HRESULT. Um subclass Win32 no thread da janela recupera mudanças da composição DWM, compartilha o resultado com o cache e informa o frontend; resize não reaplica o material. Essa extensão é uma correção da configuração nativa, não uma causa visual comprovada no computador do usuário.

Referências: [materiais DWM](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/ne-dwmapi-dwm_systembackdrop_type) e [fundo do WebView2](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2controller2).
