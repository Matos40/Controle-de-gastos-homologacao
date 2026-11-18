# Contrato online V34.5

O artefato de Hosting serve o dashboard oficial com adaptadores para o projeto de homologação. As coleções V34.5 são exclusivas de dados sintéticos:

- `raytechV345Accounts` registra o plano e o bloqueio por UID.
- `raytechV345Roles` é provisionada por operador IAM. Escrita pelo cliente é negada.
- `raytechV345Audit` vincula cada alteração de perfil ao operador e à conta afetada.
- `raytechV345Usage` mantém contadores por minuto, dia e mês UTC.
- `raytechV345Finance/{uid}/banks/v2-main` mantém uma revisão e recibos imutáveis de sincronização.

`firestore-additive.rules.txt` contém regras candidatas. O emulador valida o bloco isolado. Antes de aplicar as regras, revise o conjunto combinado para detectar permissões sobrepostas. O Firebase avalia todos os matches aplicáveis. Consulte o [procedimento de publicação](../README.md#publicação-em-homologação).
