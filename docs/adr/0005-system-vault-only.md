# Segredos somente no cofre do sistema

Status: accepted

Senhas e passphrases são persistidas exclusivamente pelo cofre do sistema e o banco guarda Credential References opacas. Não há fallback em texto puro quando o cofre falhar, pois uma configuração incompleta é preferível a uma persistência insegura.
