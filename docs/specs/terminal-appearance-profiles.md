# Spec — Perfis visuais do terminal

## Objetivo

Permitir que a instalação escolha um perfil visual global para todas as Sessions, sem confundir o perfil visual com o **Shell Profile** usado para iniciar PowerShell, CMD ou WSL.

## Modelo

- **Terminal Appearance Profile**: nome, família/tamanho de fonte, esquema de cores, Interface Opacity, Terminal Background Opacity e backdrop transparente.
- **Terminal Color Scheme**: paleta reutilizável com fundo, foreground, cursor, seleção e as 16 cores ANSI.
- Um perfil fica ativo globalmente; alterações aplicam-se a Sessions abertas e futuras sem reiniciar ou recriar o processo.
- Os esquemas integrados são OwnTerm Default, Dracula, MaterialOcean, Moonlight II e TokyoNight. Eles são somente leitura; `Duplicate scheme` cria a cópia editável.
- `Duplicate profile` é o caminho para criar um perfil visual novo.

## Persistência e migração

O catálogo é local, serializado nas chaves `appearance.terminalProfiles` e `appearance.activeTerminalProfile`. Na primeira leitura sem catálogo, as opacidades legadas geram o perfil `Migrated appearance`; isto preserva as escolhas existentes. Window Opacity e Terminal Background Opacity permanecem campos distintos e são aplicados em camadas diferentes.

## Fontes

No Windows, a interface consulta as famílias instaladas pelo sistema. Em qualquer plataforma o campo continua editável, para permitir família monoespaçada manual quando a enumeração não estiver disponível. Nenhum arquivo de fonte é copiado ou exportado.

## Critérios de aceite

- [x] Selecionar ou duplicar perfil aplica fonte, tamanho, paleta e opacidades ao vivo.
- [x] Esquemas integrados fornecem os quatro presets solicitados e uma paleta padrão.
- [x] Cópias de esquemas permitem editar fundo, foreground, cursor, seleção e as 16 cores ANSI.
- [x] A lista de fontes no Windows vem do sistema; campo manual continua disponível.
- [x] Valores legados tornam-se `Migrated appearance`.
- [ ] Exportação/importação explícita de catálogo com preview por conflito (entrega de portabilidade posterior).
