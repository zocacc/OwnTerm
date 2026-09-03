# Session manager PTY com streaming limitado

Status: accepted

## Contexto

Sessões locais produzem bytes em ritmo independente da WebView. Encaminhar cada tecla ou cada leitura diretamente pelo IPC aumenta overhead, pode criar fila sem limite e permite que o evento de exit ultrapasse a saída final.

## Decisão

O adapter `ownterm-terminal` mantém PTY, writer, resizer e killer exclusivamente no backend. Cada Session possui uma fila de saída síncrona com 32 slots de 8 KiB; o dispatcher agrupa até 64 KiB por uma janela de 4 ms e é drenado antes de emitir exit. Fechamento explícito desativa eventos, remove o runtime antes de matar o processo e é idempotente.

Na WebView, xterm preserva os chunks como bytes. Entrada digitada é agrupada por 8 ms ou 4 KiB, colagem não é interpretada, resize usa debounce de 60 ms e abas encerradas ficam em um conjunto de tombstones durante a vida da aplicação.

## Consequências

- A fila limitada bloqueia o reader quando a WebView não acompanha, aplicando backpressure sem crescimento irrestrito.
- Saída final precede exit em encerramento natural.
- Eventos atrasados não recriam abas fechadas.
- Há latência intencional máxima de poucos milissegundos para reduzir chamadas IPC.
- A saída não é persistida e desaparece quando a aba é destruída.
