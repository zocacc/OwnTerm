# E11 — Evidência de aceitação Windows 11

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
- Repetir normal, maximizada, restaurada e após reiniciar. Trocar perfil, fonte e aba; verificar buffer e identidade da Session.
- Desativar Acrylic e testar falha nativa/reduced transparency: fallback sólido, preferência preservada e aviso quando a chamada nativa falhar. O Windows pode substituir o material por sua própria política mesmo com HRESULT de sucesso.
- Anexar capturas sanitizadas e preencher resultados acima. Só encerrar o aceite visual quando essa matriz for executada.
