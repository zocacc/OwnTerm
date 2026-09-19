# I29 — Entregar Appearance e opacidade do terminal

**Status:** in progress
**GitHub:** [#51](https://github.com/zocacc/OwnTerm/issues/51)
**Dependências:** I28

## Objetivo

Entregar o diálogo acessível de Appearance e aplicar Terminal Background Opacity a todas as Sessions.

## Escopo

- [x] Adicionar ícone de ajustes à activity bar e diálogo Appearance keyboard-first.
- [x] Renderizar sliders, percentuais, Reset defaults e aviso de Window Opacity indisponível.
- [x] Atualizar Sessions abertas e futuras sem recriar o processo ou perder foco/saída.
- [x] Preservar contraste de foreground, cursor, seleção e estados operacionais.

## Fora do escopo

Temas configuráveis, opacidade por aba, opacidade de Hosts/painéis e suporte nativo sem evidência do I27.

## Critérios de aceite

- [x] O diálogo é acessível por mouse e teclado e não interrompe uma Session ativa.
- [x] Alterações nos sliders são visíveis imediatamente e persistem após reinício.
- [ ] A faixa completa permanece legível em Windows 10 e 11 com e sem fallback nativo.

## Testes

- [x] Componentes para abertura, ARIA, aplicação ao vivo, reset e aviso.
- [x] Teste de TerminalSurface para Sessions existentes e futuras.
- [ ] Smoke manual Windows para contraste, foco e reinicialização.

> A verificação manual de contraste, foco e reinicialização em Windows permanece pendente.
