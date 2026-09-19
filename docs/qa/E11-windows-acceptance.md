# E11 — Evidência de aceitação Windows 11

Execute esta matriz no artefato Windows gerado pelo CI, sem registrar hosts, comandos, saída de terminal, senhas ou chaves nos screenshots.

## Pré-condições

- Build Windows do PR verde e artefato NSIS disponível.
- PowerShell e CMD detectados; WSL, se instalado, aparece como opcional.
- Uma conexão SSH de teste sem segredo persistente, preparada para trust e credencial efêmera.

## Matriz

| Cenário | Passos | Evidência esperada | Resultado |
| --- | --- | --- | --- |
| Inicial | Abrir app novo | Gaveta fechada; nenhum rail, label ou acionador Connections fora da titlebar | [ ] |
| Shell local | Abrir PowerShell e CMD pelo launcher | Uma aba por sessão; I/O e Ctrl+Tab preservam buffer | [ ] |
| Gaveta/launcher | Abrir e fechar dez vezes com sessão SSH ativa | Overlay não reserva largura; nenhum remount, reconnect, perda de output ou resize persistente | [ ] |
| SSH | Quick Connect, trust, credencial e falha | Foco no diálogo, segredo não exposto e Reconnect acessível | [ ] |
| Janela | Normal, 800x600, maximizada, restaurada | Terminal preenche toda área abaixo da titlebar, sem moldura; controles não sobrepõem | [ ] |
| Opacidades | Janela/terminal: 100/55, 55/100, 55/55 e 100/100; reiniciar entre extremos | Cada slider preserva o outro; xterm segue legível e independente do chrome | [ ] |
| Material | Acrylic, fallback opaco e transparência reduzida | Terminal legível; fallback não usa blur; foco visível | [ ] |
| DPI | 100%, 150% e 200% | Texto, controles e gaveta permanecem utilizáveis | [ ] |

Anexe ao PR apenas screenshots sanitizados dos estados: vazio, sessão fullscreen, gaveta aberta, launcher, falha/reconnect, as quatro combinações de opacidade e fallback opaco.
