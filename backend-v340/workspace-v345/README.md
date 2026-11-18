# Raytech CG V34.5

O workspace integra o dashboard V33.4.7 (`fee3d5d25bcbed204a776298869e5e8d21191b16`) na branch exclusiva da V34.5. Use exclusivamente dados sintéticos em todos os três modos. O principal aceita sincronização Premium após revisão do vínculo e confirmação do backup. O V2 de testes e o legado têm armazenamento local independente. O prefixo V34.5 combina a origem do navegador e o UID do Firebase. O leitor oferece amostras fixas, com seleção e confirmação no modal. O Smart Admin lê consumo UTC e aplica plano, bloqueio e cotas com registro transacional.

## Laboratório

Node 22, Java 21 e a CLI do Firebase são necessários. Na pasta `backend-v340/workspace-v345`:

```sh
npm ci
npm run build
npm run prepare:emulators
firebase emulators:start --project demo-raytech-v340 --config emulators.json --only auth,firestore
```

Em outro terminal na mesma pasta, execute `npm run lab` e abra `http://127.0.0.1:15003`. Crie contas de teste no emulador Auth. No Firestore emulado, os documentos `raytechV345Accounts/{uid}` têm os campos `uid`, `name`, `plan` (`free` ou `premium`) e `blocked` (booleano). Perfis Free são criados automaticamente no primeiro login. Para testar Smart Admin, semeie um perfil local e um documento `raytechV345Roles/{uid}` com `active: true` e `role: "owner"` ou `"admin"`. Use e-mails fictícios.

O build empacota as fontes Orbitron e Plus Jakarta Sans com licenças OFL, estilos, ícones, gráficos e SheetJS localmente. O laboratório limita tráfego aos endereços loopback da aplicação e dos emuladores. Uma sessão carregada permite trabalhar offline; abrir a aplicação do zero requer que o servidor estático esteja acessível.

## Publicação em homologação

O único destino do build online é `raytech-cg-homologacao`, com Hosting estático no plano Spark. O cliente exige HTTPS no domínio oficial de homologação e confere o ID do app Web na configuração fornecida pelo Hosting. O provedor Google está habilitado nesse projeto.

1. Revise o artefato e a [Issue #8](https://github.com/Matos40/Controle-de-gastos-homologacao/issues/8).
2. Compare `online/firestore-additive.rules.txt` com as regras atuais. Insira o bloco dentro do match do banco e valide o arquivo combinado no emulador, incluindo as coleções preexistentes. Para gerar a cópia local combinada, use `npm run prepare:emulators -- /caminho/para/regras-ativas.txt`. Faça a revisão e aplicação das regras como operação separada do Hosting.
3. Prepare as contas de teste e as atribuições Owner/Admin pelos controles IAM já autorizados. O próprio cliente só cria perfis Free.
4. Na publicação autorizada, use `firebase deploy --config hosting.json --project raytech-cg-homologacao --only hosting`. A configuração contém somente Hosting.
5. Verifique com contas de teste login Google, bloqueio, revisão, sincronização explícita, isolamento e saída. Para reverter o Hosting, selecione a versão anterior no histórico de releases do site de homologação.

O fluxo não depende de Cloud Functions, IA real, pagamentos ou Blaze.
