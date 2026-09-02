# IPC Tauri com comandos e eventos tipados

Status: accepted

OwnTerm usa commands para ações e eventos versionados por Session para saída e transições assíncronas. O limite impede um canal genérico de misturar controle, dados de terminal e segredos, preservando evolução e testabilidade.
