# OwnTerm

OwnTerm centraliza shells locais e configurações SSH em um aplicativo desktop local-first. Este glossário define a linguagem do produto; decisões de implementação vivem em `docs/`.

## Configuração

**Host**:
Uma configuração persistida para iniciar uma conexão SSH a um destino. Um Host não contém um segredo nem representa uma conexão ativa.
_Avoid_: servidor, conexão, sessão

**Host Group**:
Uma classificação persistida de primeiro nível que agrupa Hosts. Um Host pode pertencer a no máximo um Host Group.
_Avoid_: pasta, árvore, categoria

**Credential Reference**:
Um identificador persistido que aponta para um segredo mantido pelo cofre do sistema. Não é o segredo nem um valor utilizável fora do cofre.
_Avoid_: senha salva, credencial no banco

**Known Host**:
O registro persistido da identidade criptográfica confiada para um destino SSH e sua porta. Ele é propriedade do OwnTerm e não sincroniza com arquivos OpenSSH do usuário no MVP.
_Avoid_: fingerprint aceita, known_hosts do OpenSSH

**Shell Profile**:
Uma opção detectada para iniciar um shell local, com identidade, comando e disponibilidade. PowerShell e CMD são perfis obrigatórios; WSL só existe quando detectado.
_Avoid_: terminal, aba

## Entrega

**PR Gate**:
Uma validação automatizada obrigatória para integrar uma Pull Request na sua branch de destino. Um PR Gate produz um resultado verificável, mas não é um artefato distribuível.
_Avoid_: CI opcional, teste informativo

**Integration Evidence**:
O instalador validado gerado para o commit já integrado em `develop` e retido para triagem. Não é uma Release nem implica que o binário tenha assinatura.
_Avoid_: release, publicação

**Release**:
Uma distribuição versionada deliberadamente disponibilizada a usuários. Gerar ou reter uma Integration Evidence não cria uma Release.
_Avoid_: artefato de CI, build verde

## Runtime

**App Shell**:
A composição visível do OwnTerm que organiza Hosts, abas de Session, superfície de terminal e estado operacional. Não é a moldura nativa da janela nem uma Session.
_Avoid_: frontend, layout, janela

**Session**:
Uma execução ativa, local ou SSH, associada a um terminal e mantida somente em runtime. Encerrar uma Session não exclui seu Host ou Shell Profile.
_Avoid_: host conectado, terminal salvo

**Session Descriptor**:
Uma visão sem handles internos usada pela interface para identificar e apresentar uma Session.
_Avoid_: sessão completa, conexão persistida

**Trust Confirmation**:
A decisão explícita do usuário de confiar na identidade apresentada por um destino SSH ainda desconhecido. Uma identidade alterada não é uma nova confirmação e deve ser bloqueada.
_Avoid_: aceitar sempre, ignorar fingerprint

**Workspace Export**:
Um arquivo JSON versionado que transporta configurações permitidas do OwnTerm. Nunca transporta senhas, passphrases, conteúdo de chaves ou fingerprints confiadas.
_Avoid_: backup de credenciais, clonagem completa

**Terminal Appearance Profile**:
Uma configuração visual local e global para as Sessions: fonte, esquema de cores, opacidade da janela, opacidade do fundo do terminal e Acrylic. Não é um **Shell Profile** e não define comando algum.
_Avoid_: shell profile, conexão, tema de Host

**Terminal Color Scheme**:
Uma paleta reutilizável de fundo, foreground, cursor, seleção e 16 cores ANSI, escolhida por um Terminal Appearance Profile.
_Avoid_: perfil de shell, credencial

**Appearance Preference**:
Uma preferência visual local que controla a opacidade da janela do OwnTerm ou do fundo das Sessions. Ela pertence à instalação em uso e não acompanha um Workspace Export.
_Avoid_: tema, configuração de Host, transparência de credencial
