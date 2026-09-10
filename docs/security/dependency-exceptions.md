# Exceções de auditoria de dependências

Exceções são temporárias, específicas e rastreáveis. Uma exceção não transforma a dependência em segura: preserva o gate para riscos fora dela enquanto a remediação é tratada explicitamente.

## RUSTSEC-2023-0071 — `rsa` timing side channel

- **Escopo:** `rsa 0.10.0-rc.18`, transitivo de `russh 0.63.2` e `ssh-key`, usado pelo adapter SSH.
- **Severidade:** 5.9 (média); a advisory não possui upgrade corretivo.
- **Decisão temporária:** o job executa `cargo audit --ignore RUSTSEC-2023-0071`; todas as demais vulnerabilidades continuam bloqueando a integração.
- **Rastreio:** I20; revisar até 2026-10-08 ou antes de atualizar `russh`/`ssh-key`.
- **Saída:** atualizar a cadeia com correção ou retirar suporte RSA com mudança de contrato e testes de compatibilidade.
