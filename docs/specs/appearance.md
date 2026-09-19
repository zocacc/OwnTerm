# Spec — Appearance e opacidade

## Objetivo

Permitir que cada instalação ajuste o efeito visual do OwnTerm sem comprometer legibilidade, operação keyboard-first ou portabilidade do Workspace.

## Vocabulário e escopo

- **Window Opacity** controla a opacidade da janela nativa inteira.
- **Terminal Background Opacity** controla somente o fundo do canvas xterm de todas as Sessions.
- As duas são `Appearance Preference` locais; não são tema, Host ou configuração de Session.
- O diálogo **Appearance** é aberto pelo ícone de ajustes da activity bar e permanece disponível enquanto uma Session está ativa.

## Valores e aplicação

| Preferência | Faixa | Padrão | Aplicação |
| --- | ---: | ---: | --- |
| Window Opacity | 70–100% | 92% | Janela nativa inteira |
| Terminal Background Opacity | 55–100% | 82% | Fundo de todas as Sessions abertas e futuras |

- Sliders exibem o percentual atual, têm labels acessíveis e aplicam mudanças imediatamente.
- `Reset defaults` restaura 92% e 82% sem reiniciar o aplicativo.
- Valores ausentes ou inválidos retornam aos padrões; valores fora das faixas nunca são aplicados.
- O fundo translúcido do terminal revela somente as camadas visuais do OwnTerm. Foreground, cursor e seleção mantêm tokens de contraste independentes.

## Plataforma e fallback

- Windows 10 e Windows 11 são as plataformas formais desta entrega.
- O mecanismo nativo de Window Opacity deve ser validado pelo spike I27 antes do contrato final de implementação.
- No Windows, o adapter usa o `HWND` da janela, adiciona `WS_EX_LAYERED` e aplica `SetLayeredWindowAttributes` com `LWA_ALPHA`; ao voltar a 100%, restaura o estilo estendido original.
- Se a capacidade não existir ou falhar, a janela fica sólida (100%), a preferência escolhida continua persistida e Appearance mostra um aviso não bloqueante.
- Linux e outras plataformas mantêm fallback sólido até haver um adapter validado; o Terminal Background Opacity continua seguro dentro do App Shell quando suportado pelo frontend.

## Persistência e portabilidade

- Persistir localmente as chaves `appearance.windowOpacity` e `appearance.terminalBackgroundOpacity` como percentuais inteiros.
- Expor contrato tipado de leitura/gravação pelo IPC Tauri, incluindo a capacidade atual de Window Opacity.
- Appearance Preferences não são incluídas no Workspace Export/Import e não podem sobrescrever valores locais durante uma importação.

## Critérios de aceite

- [ ] Appearance abre pela activity bar e funciona por teclado sem perder foco da Session.
- [ ] Cada slider respeita sua faixa, mostra percentual e aplica ao vivo a Sessions existentes e futuras.
- [ ] Reset restaura os padrões; preferências sobrevivem ao reinício.
- [ ] Falha/indisponibilidade nativa deixa a janela sólida, preserva a preferência e informa o usuário.
- [ ] Texto, cursor, seleção e estados operacionais continuam distinguíveis em toda a faixa suportada.
- [ ] Exportar/importar Workspace não altera Appearance Preferences.

## Testes

- Testes de domínio/storage para padrões, limites, valores inválidos e chaves locais.
- Testes IPC para leitura, gravação, capacidade e fallback.
- Testes React para abertura, teclado, ARIA, aplicação ao vivo, reset e aviso.
- Testes de TerminalSurface para atualizar Sessions abertas e novas.
- Verificação manual em Windows 10 e 11, incluindo composição disponível e fallback sólido.
