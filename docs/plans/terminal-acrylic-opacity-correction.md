# Plano — corrigir transparência e Acrylic do terminal

Estado: correção implementada; teste renderer no CI e validação visual Windows ainda pendentes.

Atualização em `origin/develop` `20dd9b3`: evidência no Windows confirmou que o System Acrylic adiciona uma camada escura mesmo após a correção do xterm. Esta revisão substitui o material por blur neutro e renomeia o controle visual para Interface Opacity; a chave persistida `appearance.windowOpacity` permanece por compatibilidade.

## Escopo e referência

- Pedido: validar por que o terminal permanece sólido e criar um plano de correção.
- Revisão: `git diff 4278cfd165ae1f3b810f070885b43f5337cfbac1...7bfe5ac`.
- Base: snapshot de `origin/develop`; implementação examinada: `7bfe5ac`.
- Contratos: `../specs/terminal-first-fullscreen.md`, `../specs/appearance.md`,
  `../specs/terminal-appearance-profiles.md`; acompanhamento I33 e I34.
- A invocação de implement aplica-se ao diagnóstico/plano solicitado. Não altera
  código de produção nem declara concluída a QA Windows.

## Diagnóstico reproduzido

O pacote instalado é `@xterm/xterm` 6.0.0. Seu `CoreBrowserTerminal.ts:426–428`
cria `.xterm-viewport`. O CSS distribuído (`css/xterm.css:93–103`) dá a esse
elemento fundo preto e posicionamento absoluto cobrindo toda a área do terminal.

O mesmo pacote envolve `.xterm-screen` em `.xterm-scrollable-element` e aplica
o fundo do tema nesse segundo elemento (`src/browser/Viewport.ts:53–76`).
O CSS do OwnTerm (`apps/desktop/src/index.css`, regra `.xterm .xterm-viewport`)
altera apenas a scrollbar e deixa o fundo preto legado intacto.

Logo, o RGBA correto é composto sobre outra superfície opaca. Trocar a opacidade
do terminal muda a cor resultante, mas não revela o backdrop. Isso explica por
que o chrome responde ao slider enquanto a área do terminal continua sólida.

### Evidência experimental

Reprodução isolada em Chromium headless, usando o JS e CSS distribuídos do xterm
instalado, sem mocks. Fundo da página: RGB(240,180,80). Tema do terminal:
`rgba(12,15,21,0.55)`; `allowTransparency: true`; amostra sem texto em (100,100).

| Estado | Fundo computado de viewport | Fundo computado de scrollable | Pixel final |
| --- | --- | --- | --- |
| Original | `rgb(0,0,0)` | `rgba(12,15,21,0.55)` | RGB(7,8,12) |
| Override experimental de viewport | `rgba(0,0,0,0)` | mesmo RGBA | RGB(115,89,48) |

O experimento mudou somente `.xterm .xterm-viewport { background-color: transparent; }`.
O segundo pixel corresponde à mistura esperada sobre o fundo colorido, dentro
do arredondamento de canais do navegador. Evidências temporárias da sessão:
`/tmp/ownterm-opacity-before.png` e `/tmp/ownterm-opacity-after.png`.
Esse experimento comprova o bloqueio DOM/CSS, mas não valida DWM/WebView2 no Windows.

A validação posterior no Windows confirmou um segundo bloqueio: `apply_acrylic` usa o System Acrylic e acrescenta tint e luminosidade sob o WebView. Depois da correção da viewport do xterm, essa camada nativa ainda escurece a composição. A correção final usa `apply_blur` com cor neutra e deixa cor e alfa sob responsabilidade exclusiva do CSS e do xterm.

## Revisão Standards

Nenhuma violação inequívoca de padrão documentado. O runtime agora usa `backdrop` e `backdropConfigured` para não apresentar o retorno do blur como prova de Acrylic efetivamente aplicado. O campo persistido `useAcrylic` permanece somente como compatibilidade de perfil.

## Revisão Spec

1. P1: viewport preta impede o aceite de janela 100% / terminal 55%.
2. P2: `apply_profile_material` descarta o resultado nativo e resize devolve a
   preferência como sucesso. Pode ocultar falha de material; sua ocorrência no
   computador do usuário ainda não foi verificada.
3. P2: testes de string RGBA e mocks não verificam composição visual. A matriz
   Windows permanece pendente; o efeito não pode ser considerado aprovado.

## Ordem de correção

### 1. Regressão com renderer real e correção mínima de CSS — I33

- Criar teste de integração em navegador usando o xterm real e o CSS final da
  aplicação. Confirmar falha antes da correção, com fundo colorido conhecido.
- Tornar transparente somente o fundo da viewport legada no CSS do OwnTerm,
  carregado após o CSS do xterm. Preservar DOM, scroll, seleção e geometria.
- Manter o fundo do tema na camada que o xterm já pinta; não duplicar RGBA em
  wrappers, não aplicar opacity no terminal inteiro e não alterar alpha global.
- Verificar terminal 55% e 100%, alternando Interface Opacity entre 55% e 100%:
  medir pixels vazios e cores computadas, com tolerância de arredondamento.
- Trocar a preferência durante a sessão e verificar novas sessões, scrollback,
  identidade da instância e ausência de fechamento/reabertura da PTY.
- Reparar TerminalSurface.test: o mock atual não possui `options` e faz o efeito
  de atualização retornar antes da atribuição do tema. Usar opções reais no mock
  e a transformação real de tema, além do teste de navegador.

### 2. Contrato e ciclo de material nativo — I33

- Centralizar preparação, carregamento, salvamento e resize em um caminho que
  respeite o perfil persistido, inclusive `useAcrylic: false` no startup.
- Retornar material solicitado, material efetivamente aplicado e aviso de falha.
  Atualizar o estado visual no frontend após saves, sem esperar um resize.
- Propagar falhas do adapter; preferência salva não é prova de aplicação nativa.
- Usar blur neutro como backdrop solicitado e reservar o fallback opaco
  explicitamente identificado e testado quando o backdrop falhar.
- Auditar o reset legado de janela layered: evitar transições nativas em cada
  alteração de slider se não houver estado legado a restaurar. Preservar texto
  e cursor opacos e alpha nativo global em 100%.
- Não prometer resolução nativa com `cargo check` Linux: executar build/checks
  Windows e comparar comportamento no artefato desktop.

### 3. Aceite visual e entrega — I34

- Registrar SHA do build, versão Windows e WebView2, perfil e estado de
  transparência/acessibilidade do sistema. Não coletar comandos ou segredos SSH.
- Executar matriz janela/terminal 100/55, 55/100, 55/55 e 100/100, com backdrop neutro
  ligado/desligado e fallback. Usar fundo externo contrastante identificável.
- Repetir normal, maximizada, restaurada, após reiniciar e após trocar aba/fonte.
- Abrir/fechar drawer dez vezes com SSH ativo; verificar dimensão, buffer e PTY.
- Anexar screenshots sanitizados e preencher a matriz em
  `../qa/E11-windows-acceptance.md`. I34 só termina com essa evidência.
- Rodar testes focados durante as alterações e a suíte completa uma vez ao final;
  typecheck, build frontend, testes Rust e build Windows conforme o escopo.
- Fazer nova revisão Standards/Spec, commit das correções e atualização do PR.

## Critério de encerramento

O fundo externo deve ser visível através de células sem fundo ANSI explícito
quando terminalBackgroundOpacity for 55%, inclusive com Interface Opacity em 100%.
Em 100%, o fundo do terminal deve ficar sólido. Texto, cursor, estado da sessão
e os valores persistidos dos dois controles devem permanecer independentes.
Aplicações que pintam fundos ANSI próprios precisam ser testadas separadamente;
não apagar essas cores nem confundi-las com o fundo padrão do terminal.
