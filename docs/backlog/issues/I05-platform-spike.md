# I05 — Validar cofre e efeitos de janela

**Status:** planned  
**Dependências:** I01

## Objetivo

Validar o cofre Windows, o fallback visual e a geração de artefato antes do fluxo de segredos e release.

## Escopo

- [ ] Salvar, ler e remover segredo por adapter do cofre no Windows.
- [ ] Validar erro sem fallback em texto puro.
- [ ] Avaliar Mica/efeito de janela e fallback sólido.
- [ ] Gerar artefato Tauri Windows de prova.

## Fora do escopo

Assinatura, publicação e preferências visuais completas.

## Critérios de aceite

- [ ] Evidência confirma comportamento do cofre e fallback seguro.
- [ ] Build Windows produz artefato instalável de prova.

## Testes

- [ ] Adapter fake cobre sucesso, item ausente e falha de plataforma.
