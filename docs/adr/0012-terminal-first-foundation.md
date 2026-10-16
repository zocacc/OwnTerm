# Reconstrução terminal-first com gate visual nativo

Reconstruir o frontend em vez de continuar adaptando a apresentação de gerenciador: o App Shell possui apenas barra superior e terminal. Preservar backend, contratos de sessões/SSH, segurança e dados; Hosts e configurações retornam como overlays centrais, não como sidebar ou gaveta.

A primeira entrega substitui o App/CSS antigos e disponibiliza sessões locais automáticas, abas, controles e ajustes mínimos de composição. A migração dos recursos de gestão, destino inicial configurável, command palette e busca fica bloqueada até o usuário aceitar o instalador no Windows real. É uma redução temporária da superfície disponível, não exclusão de recursos ou dados.

Desktop Acrylic permanece a escolha de material. O adapter estende o frame à área cliente e acompanha mudanças DWM no thread proprietário do HWND, sem reaplicar material em resize. Sucesso da API significa configuração aceita; não comprova blur visível. O gate nativo evita reconstruir todos os recursos sobre uma fundação visual ainda não validada.
