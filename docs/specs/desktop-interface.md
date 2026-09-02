# Spec — Interface desktop

## Objetivo

Fornecer uma interface dark-first, compacta e keyboard-first que exponha Hosts, abas e estado operacional sem esconder falhas ou riscos de segurança.

## Escopo

- AppShell com title bar, activity bar, sidebar de Hosts, tab bar, workspace de terminal e status bar.
- Tokens semânticos para background, superfícies, texto, borda, primária, sucesso, alerta e erro.
- Transparência moderada em painel/title bar com fallback sólido quando window effects não estiverem disponíveis.
- Estados vazio, carregando, erro, confirmação destrutiva, conexão, confiança SSH e credencial necessária.
- Atalhos documentados para foco em busca, Quick Connect, abrir shell e alternar abas.

## Fora do escopo

- Temas configuráveis, atalhos configuráveis, animações complexas, Figma como gate e reprodução visual de produtos de terceiros.

## Regras de apresentação

- Verde representa somente conexão/sucesso; vermelho somente falha ou ação destrutiva.
- O terminal preserva contraste e é mais sólido que painéis adjacentes.
- Componentes usam tokens; cores literais exigem justificativa de acessibilidade.
- A interface apresenta Session Descriptors e eventos; não mantém handles, segredos ou saída persistida.

## Critérios de aceite

- [ ] Layout é utilizável em janela Windows comum sem sobreposição de abas, sidebar e status.
- [ ] Estados de conexão e erro são distinguíveis por texto e não apenas por cor.
- [ ] Fluxos essenciais podem ser iniciados pelo teclado.
- [ ] Fallback visual continua legível sem Mica/Acrylic.
- [ ] Formulários e diálogos têm foco previsível e confirmação explícita para exclusões.

## Testes

- Componentes para estados, foco de diálogo, atalhos e renderização por status.
- Teste visual/manual no Windows para contraste, densidade e fallback de window effects.
- E2E mockado para primeira execução, Quick Connect e confirmação de exclusão.
