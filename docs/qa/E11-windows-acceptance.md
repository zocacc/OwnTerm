# E11 — Evidência de aceitação Windows 11

## Gate 1 — Fundação reconstruída

Esta entrega não expõe gestão de Hosts/SSH nem configurações avançadas. Dados e backend permanecem preservados; a segunda entrega só começa após aceite visual desta base. Os cenários históricos abaixo que envolvem SSH/gestão continuam pendentes, não são resultados aprovados da fundação.

1. Registrar SHA do instalador, versão/build Windows, WebView2 e DPI. Testar com foco na janela e efeitos de transparência do Windows habilitados.
2. Abrir: um shell local deve iniciar sem dashboard/launcher intermediário. Escolher CMD/PowerShell/WSL disponível no menu da seta; + abre outro shell padrão.
3. Ajustar terminal 0% e Acrylic ativo. Mover uma janela colorida atrás do OwnTerm; conteúdo deve mudar ao vivo com blur, sem véu adicional ao abrir Appearance. Repetir 100/0, 0/0, 100/55 e 100/100.
4. Minimizar/restaurar, maximizar/restaurar, arrastar pelo espaço vazio, redimensionar repetidamente, trocar foco e testar DPI 100/150/200%. Confirmar fundo externo, texto opaco e PTY corretamente dimensionado.
5. Abrir pelo menos 13 abas: barra continua com 40px e overflow horizontal; terminal ocupa o restante, buffers preservados ao alternar e com Ctrl+Tab.
6. Testar fechamento de aba ativa, Cancelar, confirmação da última aba e Alt+F4 com várias sessões. Falha ao encerrar processo deve manter a aba e o erro.
7. Desativar Acrylic: fallback sólido identificado. Reativar; reiniciar e verificar preservação dos sliders e perfis anteriores. Testar mudança dos efeitos de transparência do Windows; registrar quando o sistema substituir material apesar de chamada aceita.

Anexar capturas/vídeo sanitizados de janela colorida em movimento e dos estados normal/maximizado, sem comandos, hosts ou segredos. **Se continuar cinza em 0%, não liberar o gate nem iniciar a entrega 2.**

Execute esta matriz no artefato Windows gerado pelo CI, sem registrar hosts, comandos, saída de terminal, senhas ou chaves nos screenshots.

## Pré-condições

- Build Windows do PR verde e artefato NSIS disponível.
- PowerShell e CMD detectados; WSL, se instalado, aparece como opcional.
- Uma conexão SSH de teste sem segredo persistente, preparada para trust e credencial efêmera.

## Matriz

| Cenário | Passos | Evidência esperada | Resultado |
| --- | --- | --- | --- |
| Inicial | Abrir app novo e inspecionar o primeiro frame | Gaveta fechada; janela borderless com controles próprios; nenhum rail, label ou acionador Connections fora da titlebar | [ ] |
| Shell local | Abrir PowerShell e CMD pelo launcher | Uma aba por sessão; I/O e Ctrl+Tab preservam buffer | [ ] |
| Gaveta/launcher | Abrir e fechar dez vezes com sessão SSH ativa | Overlay não reserva largura; nenhum remount, reconnect, perda de output ou resize persistente | [ ] |
| SSH | Quick Connect, trust, credencial e falha | Foco no diálogo, segredo não exposto e Reconnect acessível | [ ] |
| Janela | Normal, 800x600, maximizada, restaurada | Terminal preenche toda área abaixo da titlebar, sem moldura; controles não sobrepõem | [ ] |
| Opacidades | Janela/terminal: 100/55, 55/100, 55/55 e 100/100; reiniciar entre extremos | Cada slider preserva o outro; xterm segue legível e independente do chrome | [ ] |
| Material | Desktop Acrylic, fallback opaco e transparência reduzida | Fundo externo perceptível com Acrylic; fallback sólido identificado; foco visível | [ ] |
| DPI | 100%, 150% e 200% | Texto, controles e gaveta permanecem utilizáveis | [ ] |

Anexe ao PR apenas screenshots sanitizados dos estados: vazio, sessão fullscreen, gaveta aberta, launcher, falha/reconnect, as quatro combinações de opacidade e fallback opaco.

## Aceite específico — fundo do terminal

Estado: **pendente de teste do instalador pelo usuário no Windows real**. CI e Chromium não comprovam composição DWM/WebView2.

- Registrar SHA do instalador, build Windows, versão WebView2, perfil, estado do foco e configuração de transparência/acessibilidade do Windows.
- Deixar uma janela com grandes áreas coloridas atrás do OwnTerm. Mover essa janela: o material deve acompanhar o conteúdo externo ao vivo, com desfoque.
- Abrir PowerShell/CMD com células de fundo padrão (sem fundo ANSI explícito). Interface 100% / terminal 55% deve mostrar o conteúdo externo; terminal 100% deve ocultá-lo. Repetir 55/100 e 55/55, sem alterar opacidade de texto ou cursor.
- Testar também 100/0 e 0/0. Manter Appearance aberto e observar o terminal fora do painel: nenhum véu escuro ou blur CSS adicional deve aparecer. Fechar e reabrir, depois reiniciar: 0% deve continuar salvo. O Acrylic ainda pode ter tonalidade nativa.
- Repetir normal, maximizada, restaurada e após reiniciar. Trocar perfil, fonte e aba; verificar buffer e identidade da Session.
- Desativar Acrylic e testar falha nativa/reduced transparency: fallback sólido, preferência preservada e aviso quando a chamada nativa falhar. O Windows pode substituir o material por sua própria política mesmo com HRESULT de sucesso.
- Anexar capturas sanitizadas e preencher resultados acima. Só encerrar o aceite visual quando essa matriz for executada.
