# Spec — App Shell terminal-first reconstruído

Substitui a composição com gaveta. Implementação em duas entregas: [plano](../plans/frontend-terminal-first-rebuild.md), ADR 0012. A segunda entrega aguarda aceite visual Windows.

## Estrutura

App Shell possui uma barra superior de 40px e TerminalView flexível ocupando integralmente o restante da janela. Nenhum sidebar, drawer, dashboard, tela inicial, card, margem, padding externo ou background próprio envolve o terminal. Overlays são condicionais e não alteram geometria nem identidade das Sessions.

TitleBar contém nome discreto, abas reais em uma única linha com rolagem horizontal, +, seletor de destino, região vazia de drag, configurações e controles Windows. Cada Session mantém seu xterm e processo ao ficar inativa; ativação ajusta dimensões/foco. Nenhuma feature reconecta por mudança puramente visual.

## Fundação atual

Ao abrir, instalar assinaturas de eventos antes de iniciar uma Session local. Preferir PowerShell, depois CMD e primeiro perfil detectado; nenhuma sessão duplicada em StrictMode. + abre perfil padrão; menu escolhe CMD/PowerShell/WSL disponível.
Fechar Session ativa ou janela com Sessions ativas exige confirmação. Cancelar não encerra processos; última aba fecha janela; erro de encerramento mantém aba e mostra erro.
Ajustes mínimos de Appearance não eliminam perfis existentes. Configurações avançadas e gestão de Hosts retornam em overlays centrais após o gate, sem nova tela permanente.

## Composição e resize

Containers principais e WebView são transparentes com backdrop configurado. Única superfície sólida estrutural permitida é o fallback identificado quando Acrylic está desabilitado, ainda não configurado ou falhou.
Interface Opacity e Terminal Background Opacity aceitam 0–100% independentemente. Padrões novos/reset são 92/0 e Acrylic ativo; valores persistidos não mudam. Sem alpha global da janela ou opacity em ancestral do terminal.
ResizeObserver ajusta xterm/PTY; resize, maximizar/restaurar, troca de aba e alteração visual não recriam o processo nem reconfiguram Acrylic.
Desktop Acrylic permanece nativo. A chamada aceita não prova o resultado visual; o Windows pode substituir material por política.

## Aceite

1. Shell real disponível automaticamente, sem launcher intermediário.
2. Barra 40px; terminal usa exatamente altura restante em 800×600, 1120×720 e resize.
3. 13 abas não criam segunda linha, sidebar, recorte de controles ou remount dos xterms.
4. Interface 100/terminal 0 e 0/0 revelam fundo externo; terminal 100 o oculta, com texto opaco.
5. Appearance aberto não escurece a área externa ao painel.
6. Minimize, maximize/restore, drag, resize, PTY e fechamento funcionam no instalador Windows.
7. Só iniciar a segunda entrega após a matriz de fundação E11 ser aceita pelo usuário.
