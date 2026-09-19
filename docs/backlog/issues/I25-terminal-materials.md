# I25 — Consolidar Acrylic, tokens e fallback visual

- **Status:** in progress
- **GitHub:** [#61](https://github.com/zocacc/OwnTerm/issues/61)
- **Dependências:** I21, I22, I24
**Epic:** [E11 — Shell terminal-first](../epics/E11-terminal-first-shell.md)

## Objetivo

Aplicar uma hierarquia visual contínua e legível ao novo shell, usando Acrylic de forma progressiva e mantendo um fallback opaco equivalente.

## Escopo

- [x] Revisar tokens de title bar, drawer, backdrop, terminal, menu, feedback e diálogos.
- [x] Tornar o terminal mais sólido que chrome/gaveta sem usar cartão aninhado.
- [x] Aplicar blur/material somente após confirmação do backend de janela.
- [x] Manter fallback opaco como padrão seguro.
- [x] Validar `prefers-reduced-transparency`, forced colors e reduced motion.
- [x] Remover tokens/classes órfãos de activity rail, session info e status bar.
- [x] Garantir contraste de texto, foco, seleção e estados operacionais.
- [ ] Ajustar tabs, drawer e menus para `800×600` e escalas de DPI suportadas.
- [ ] Atualizar mockup/evidência visual versionada se o repositório continuar usando esses assets como referência.

## Fora do escopo

Editor de tema, color schemes configuráveis, background image, controle de blur/opacidade e temas de terceiros.

## Critérios de aceite

- [x] Acrylic e fallback preservam a mesma hierarquia e medidas.
- [x] Fundo externo não compromete legibilidade do terminal.
- [x] Forced colors mantém foco e ações distinguíveis.
- [x] Reduced transparency remove dependência de blur/translucidez.
- [x] Nenhum bloco opaco desnecessário interrompe a superfície do terminal.
- [x] Não restam estilos utilizados somente pelo layout removido.

## Testes

- [ ] Testes de classes/tokens essenciais onde trouxerem valor de regressão.
- [ ] Inspeção manual em Acrylic ativo e fallback forçado.
- [ ] Verificação de contraste e foco nos estados conectado, espera e falha.
- [ ] Screenshots em janela normal, mínima e maximizada.

## Entrega observável

Shell visualmente próximo à densidade do Windows Terminal, com transparência sutil e terminal legível em qualquer fallback suportado.
