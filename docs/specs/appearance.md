# Spec — Appearance e opacidade

## Objetivo

Permitir que cada instalação ajuste o efeito visual do OwnTerm sem comprometer legibilidade, operação keyboard-first ou portabilidade do Workspace.

## Vocabulário e escopo

- **Interface Opacity** controla somente titlebar, gaveta, menus, diálogos e feedback via CSS.
- **Terminal Background Opacity** controla somente o fundo do canvas xterm de todas as Sessions.
- As duas são `Appearance Preference` locais; não são tema, Host ou configuração de Session.
- O diálogo **Appearance** é aberto pelo ícone de ajustes da activity bar e permanece disponível enquanto uma Session está ativa.

## Valores e aplicação

| Preferência | Faixa | Padrão | Aplicação |
| --- | ---: | ---: | --- |
| Interface Opacity | 0–100% | 92% | Superfícies de chrome do frontend |
| Terminal Background Opacity | 55–100% | 82% | Fundo de todas as Sessions abertas e futuras |

- Sliders exibem o percentual atual, têm labels acessíveis e aplicam mudanças imediatamente.
- `Reset defaults` restaura 92% e 82% sem reiniciar o aplicativo.
- Valores ausentes ou inválidos retornam aos padrões; valores fora das faixas nunca são aplicados.
- Com Acrylic ativo, o fundo padrão translúcido do terminal revela o desktop e outras janelas atrás do OwnTerm com o material nativo. Foreground, cursor e seleção mantêm tokens de contraste independentes. Fundos ANSI explícitos continuam pertencendo às aplicações de terminal.

## Plataforma e fallback

- Windows 10 e Windows 11 são as plataformas formais desta entrega.
- No Windows 11 build 22621+, o adapter solicita Desktop Acrylic por `DwmSetWindowAttribute` com `DWMSBT_TRANSIENTWINDOW` e verifica seu HRESULT. Versões anteriores mantêm o adapter Acrylic legado. A tonalidade do material pertence ao Windows; sliders não prometem controlar tint ou luminosidade nativa.
- A janela Windows nasce com `decorations: false` e `transparent: true`; nenhuma chamada tardia altera o estilo nativo após a configuração do backdrop.
- O carregamento de Appearance após a montagem prepara o material e devolve preferências e resultado juntos. Um estado sincronizado reutiliza o resultado em leituras e saves; somente mudanças de `useAcrylic` reconfiguram ou limpam o material. `prepare_window_chrome` informa apenas a necessidade de controles próprios, sem modificar o material. Resize e maximize não iniciam outro ciclo.
- Cor e alfa das superfícies web pertencem ao CSS e ao xterm, sobre o Acrylic nativo. Interface Opacity nunca usa `opacity` em ancestral do terminal nem alpha nativo parcial para compor toda a WebView. O WebView mantém fundo nativo transparente.
- Se o backdrop não puder ser configurado, a janela recebe uma superfície opaca, a preferência continua persistida e Appearance mostra um aviso não bloqueante.
- Linux e outras plataformas mantêm fallback sólido até haver um adapter validado; o Terminal Background Opacity continua seguro dentro do App Shell quando suportado pelo frontend.

## Persistência e portabilidade

- Persistir localmente as chaves legadas `appearance.windowOpacity` (Interface Opacity) e `appearance.terminalBackgroundOpacity` como percentuais inteiros.
- Expor contrato tipado de leitura/gravação pelo IPC Tauri, incluindo a capacidade atual de Interface Opacity.
- Appearance Preferences não são incluídas no Workspace Export/Import e não podem sobrescrever valores locais durante uma importação.

## Critérios de aceite

- [ ] Appearance abre pela activity bar e funciona por teclado sem perder foco da Session.
- [ ] Cada slider respeita sua faixa, mostra percentual e aplica ao vivo a Sessions existentes e futuras.
- [ ] Interface 100% / terminal 55% revela conteúdo externo com Acrylic; terminal 100% fica sólido. Texto/cursor permanecem opacos e a instância da Session é preservada.
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
