# I11 — Harden e empacotar o MVP

**Status:** in progress
**Dependências:** I07, I08, I09, I10

## Objetivo

Fechar qualidade, acessibilidade, observabilidade e instalação Windows do MVP integrado.

## Escopo

- [x] Revisar estados vazio/carregando/erro/confirmação e atalhos documentados.
- [x] Validar contraste, foco de diálogos e fallback visual sólido.
- [x] Consolidar testes E2E mockados e smokes Windows com PTY/SSH local.
- [x] Gerar artefato instalável Windows no CI.

## Fora do escopo

Assinatura, publicação, suporte oficial multi-plataforma e telemetria.

## Critérios de aceite

- [ ] Fluxos críticos funcionam juntos em build Windows 11.
- [ ] Logs, banco, exportação e estado persistido não contêm segredos.
- [ ] CI produz instalador e evidencia smoke dos caminhos críticos.

## Testes

- [x] E2E de primeira execução, Host/Quick Connect, trust SSH e import/export.
- [x] Smoke Windows de instalação, shell local e SSH de fixture.
