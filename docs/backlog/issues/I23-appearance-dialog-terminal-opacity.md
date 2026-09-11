# I23 — Entregar Appearance e opacidade do terminal

**Status:** planned
**GitHub:** [#51](https://github.com/zocacc/OwnTerm/issues/51)
**Dependências:** I22

## Objetivo

Entregar o diálogo acessível de Appearance e aplicar Terminal Background Opacity a todas as Sessions.

## Escopo

- [ ] Adicionar ícone de ajustes à activity bar e diálogo Appearance keyboard-first.
- [ ] Renderizar sliders, percentuais, Reset defaults e aviso de Window Opacity indisponível.
- [ ] Atualizar Sessions abertas e futuras sem recriar o processo ou perder foco/saída.
- [ ] Preservar contraste de foreground, cursor, seleção e estados operacionais.

## Fora do escopo

Temas configuráveis, opacidade por aba, opacidade de Hosts/painéis e suporte nativo sem evidência do I21.

## Critérios de aceite

- [ ] O diálogo é acessível por mouse e teclado e não interrompe uma Session ativa.
- [ ] Alterações nos sliders são visíveis imediatamente e persistem após reinício.
- [ ] A faixa completa permanece legível em Windows 10 e 11 com e sem fallback nativo.

## Testes

- [ ] Componentes para abertura, ARIA, aplicação ao vivo, reset e aviso.
- [ ] Teste de TerminalSurface para Sessions existentes e futuras.
- [ ] Smoke manual Windows para contraste, foco e reinicialização.
