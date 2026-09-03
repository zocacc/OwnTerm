# Ports de plataforma pertencem à application

Status: accepted

Os casos de uso definem ports para terminal, cofre e diretórios em \`ownterm-application\`; \`ownterm-terminal\` e \`ownterm-platform\` são adapters nativos compostos no desktop Tauri. A escolha evita uma HAL pública ou registry dinâmico, mantém React e domínio livres de detalhes de SO e permite validar Windows e Linux por compilação e testes de contrato.
