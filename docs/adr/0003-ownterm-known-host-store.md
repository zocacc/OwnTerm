# Store próprio para identidades SSH confiadas

Status: accepted

Fingerprints SSH ficam no SQLite do OwnTerm, isoladas de `~/.ssh/known_hosts`. O MVP não altera arquivos OpenSSH do usuário para evitar efeitos colaterais e conflitos de ferramentas; interoperabilidade adicional pode ser avaliada depois.
