# Timestamps de domínio em Unix milliseconds

Status: accepted

Entidades persistidas usam o value object `Timestamp`, representado por `i64` em Unix milliseconds. O core não depende de uma biblioteca de data enquanto não houver cálculo ou apresentação temporal; conversão para datas legíveis pertence às bordas, evitando timezone implícito no domínio e no SQLite.
