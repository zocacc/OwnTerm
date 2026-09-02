# I11 — Harden e empacotar o MVP

**Status:** planned
**Dependências:** I07, I08, I09, I10

## Objetivo

Fechar qualidade, acessibilidade, observabilidade e instalação Windows do MVP integrado.

## Escopo

- [ ] Revisar estados vazio/carregando/erro/confirmação e atalhos documentados.
- [ ] Validar contraste, foco de diálogos e fallback visual sólido.
- [ ] Consolidar testes E2E mockados e smokes Windows com PTY/SSH local.
- [ ] Gerar artefato instalável Windows no CI.

## Fora do escopo

Assinatura, publicação, suporte oficial multi-plataforma e telemetria.

## Critérios de aceite

- [ ] Fluxos críticos funcionam juntos em build Windows 11.
- [ ] Logs, banco, exportação e estado persistido não contêm segredos.
- [ ] CI produz instalador e evidencia smoke dos caminhos críticos.

## Testes

- [ ] E2E de primeira execução, Host/Quick Connect, trust SSH e import/export.
- [ ] Smoke Windows de instalação, shell local e SSH de fixture.
