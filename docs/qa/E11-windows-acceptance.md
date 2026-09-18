# E11 — Evidência de aceitação Windows 11

Execute esta matriz no artefato Windows gerado pelo CI, sem registrar hosts, comandos, saída de terminal, senhas ou chaves nos screenshots.

## Pré-condições

- Build Windows do PR verde e artefato NSIS disponível.
- PowerShell e CMD detectados; WSL, se instalado, aparece como opcional.
- Uma conexão SSH de teste sem segredo persistente, preparada para trust e credencial efêmera.

## Matriz

| Cenário | Passos | Evidência esperada | Resultado |
| --- | --- | --- | --- |
| Inicial | Abrir app novo | Gaveta fechada, workspace vazio, ações Shell/Connections acessíveis | [ ] |
| Shell local | Abrir PowerShell e CMD pelo launcher | Uma aba por sessão; I/O e Ctrl+Tab preservam buffer | [ ] |
| Gaveta/launcher | Abrir, fechar e repetir | Nenhum remount, perda de seleção, output ou resize da aba inativa | [ ] |
| SSH | Quick Connect, trust, credencial e falha | Foco no diálogo, segredo não exposto e Reconnect acessível | [ ] |
| Janela | Normal, 800x600, maximizada, restaurada | Tabs, launcher, Settings e controles nativos não sobrepõem | [ ] |
| Material | Acrylic, fallback opaco e transparência reduzida | Terminal legível; fallback não usa blur; foco visível | [ ] |
| DPI | 100%, 150% e 200% | Texto, controles e gaveta permanecem utilizáveis | [ ] |

Anexe ao PR apenas screenshots sanitizados dos estados: vazio, sessão local, gaveta, launcher, falha/reconnect e fallback opaco.
