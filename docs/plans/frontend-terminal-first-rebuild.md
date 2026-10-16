# Reconstrução do frontend — gate 1

Branch: `fix/windows-neutral-backdrop`. Base anterior: `7b9be8e`.
Estado: primeira entrega implementada; aceite visual nativo pendente. Não iniciar a segunda entrega nem integrar esta base parcial antes do aceite.

## Entrega 1

App Shell tem somente barra de 40px e terminal integral. Sem sidebar, gaveta, tela inicial, card ou fundo de aplicação no caminho transparente.
Abertura automática de uma Session local após instalar as cinco assinaturas de eventos; PowerShell, depois CMD, depois primeiro Shell Profile disponível.
Abas reais mantêm seus xterms/processos/buffers, com overflow horizontal. + abre shell padrão; seta escolhe shell disponível, incluindo WSL detectado.
Controles Windows independentes de Acrylic. Fechar sessão ativa exige confirmação; última aba fecha janela; fechamento nativo da janela compartilha confirmação.
Ajustes mínimos de Interface Opacity, Terminal Background Opacity e Acrylic preservam todos os perfis/cores existentes. Gravações são serializadas. Padrões novos/reset: 92/0, Acrylic ativo. Texto/cursor não ficam translúcidos.
Adapter Windows estende frame DWM, verifica HRESULT e acompanha WM_DWMCOMPOSITIONCHANGED com callback no thread da janela, liberado ao destruí-la. Sem reconfiguração em resize, troca de abas ou sliders.
DTO de Appearance adiciona `backdropRevision`; eventos `native-backdrop-changed` incluem a mesma revisão monotônica. Snapshot de estado/revisão é coerente e publicado antes da resposta, para impedir que mensagens atrasadas revertam a composição.
Falha conhecida usa fallback sólido explicitamente identificado. Políticas do Windows podem alterar resultado visual mesmo com API aceita.

## Gate e orçamento de evidência

- Agente: testes App/IPC para inicialização única, eventos antecipados, fechamento, gravações e notificações nativas; domínio/storage para padrões e preservação.
- Chromium: App/xterm/CSS reais sobre fundo externo contrastante; alfa 0/55/100, preview aberto sem véu, glyphs opacos, 13 abas, resize e buffer preservado. Não prova DWM.
- CI: workspace Rust completo, compilação Windows, instalação/abertura NSIS, segurança e smoke ConPTY. Não prova DWM.
- Usuário: instalador do SHA exato no Windows 10/11, conforme a seção Fundação da matriz E11. Não avançar se a janela continuar cinza com material habilitado e fundo xterm 0%.

## Entrega 2 — bloqueada pelo gate

Preservar toda gestão de Hosts/grupos, favoritos/recentes, Quick Connect, credenciais, import/export e perfis visuais, reconstruindo a apresentação em modais centrais.
Destino inicial local configurável ou Host salvo; + continua abrindo o shell local padrão. Falha/cancelamento do SSH inicial abre shell local uma única vez, mantém aba de falha quando criada e oferece reconectar.
Palette global em Ctrl+Shift+P pesquisa destinos/ações; menu da seta contém shells e Hosts favoritos/recentes. Busca textual simples da Session em Ctrl+Shift+F, sem regex inicialmente. Sem reordenação de abas por arraste.
Preservar confiança explícita, bloqueio de identidade alterada e cofre; nenhuma aceitação automática.
Estender IPC com preferências locais de inicialização, sem exportá-las no Workspace.
Componentes legados de gestão podem permanecer sem rota até serem substituídos. Nenhuma feature flag ou segunda interface executável.
