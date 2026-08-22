# SonarQube local — análise estática do backend

Instância local de **SonarQube Community Build** para radiografar dívida técnica,
security hotspots, complexidade cognitiva e duplicação nos microserviços do
Vibester.

Roda **inteiramente na máquina do dev**. Nenhum dado sai daqui, nada é enviado
para nuvem e nenhum workflow do GitHub Actions é afetado.

## O que é analisado

| Serviço | Linguagem | Cobertura |
|---|---|---|
| auth-service | TypeScript | sim (lcov) |
| establishment-service | TypeScript | sim (lcov) |
| event-service | TypeScript | sim (lcov) |
| feed-service | TypeScript | sim (lcov) |
| notification-service | TypeScript | sim (lcov) |
| post-service | TypeScript | sim (lcov) |
| scrapping-service | TypeScript | sim (lcov) |
| user-service | TypeScript | sim (lcov) |
| payment-service | Go | não — nenhum `*_test.go` no repo |

---

## Pré-requisitos

- Docker (Desktop no Windows, com backend WSL2) e Docker Compose v2
- Node.js 20+ (só para rodar o `scan.mjs`, que não tem dependências)
- ~3 GB de RAM livres para o container do SonarQube

Não é preciso instalar o `sonar-scanner` nativo. Ele exigiria Java 17+, e a
máquina de desenvolvimento padrão do time tem Java 8 — por isso o scanner roda
pela imagem `sonarsource/sonar-scanner-cli`.

---

## 1. Subir a stack

```bash
docker compose -f apps/services/sonar/docker-compose.yml up -d
```

A primeira subida leva 1 a 3 minutos (migrações do banco + boot do Elasticsearch
embutido). Acompanhe com:

```bash
docker compose -f apps/services/sonar/docker-compose.yml logs -f sonarqube
```

Está pronto quando a API responder `UP`:

```bash
curl http://localhost:9001/api/system/status
```

Dashboard: http://localhost:9001

### Por que 9001 e não 9000

A 9000 é a porta padrão do SonarQube, mas costuma já estar ocupada por outra
instância na máquina. O default aqui é **9001**, configurável:

```bash
SONAR_PORT=9005 docker compose -f apps/services/sonar/docker-compose.yml up -d
```

A porta *interna* do container continua sendo a 9000, e o scanner fala com ele
pela rede do Compose (`http://sonarqube:9000`) — mudar `SONAR_PORT` não afeta o
scan.

### O Postgres do Sonar não expõe porta

Proposital. A 5432 do host já é do `auth_db`. O banco do Sonar só precisa
conversar com o SonarQube pela rede interna do Compose.

---

## 2. `vm.max_map_count` (importante no Windows/WSL2)

O Elasticsearch embutido no SonarQube não sobe se o kernel estiver com
`vm.max_map_count` abaixo de `524288`. No Docker Desktop/WSL2 o default é
`262144` — abaixo do necessário. O sintoma é o container morrer entre 10 e 30
segundos depois de subir, com esta mensagem no log:

```
max virtual memory areas vm.max_map_count [262144] is too low,
increase to at least [524288]
```

**Você não precisa fazer nada:** o `docker-compose.yml` tem um init container
`sysctl` privilegiado que ajusta o kernel antes do SonarQube subir, a cada
`docker compose up`.

Se preferir tornar o ajuste permanente e remover o init container, crie
`%USERPROFILE%\.wslconfig` com:

```ini
[wsl2]
kernelCommandLine = sysctl.vm.max_map_count=524288
```

e depois rode `wsl --shutdown`. Isso **derruba o Docker Desktop** e todos os
containers; reabra o Docker Desktop em seguida.

---

## 3. Gerar o token

1. Acesse http://localhost:9001
2. Login inicial: `admin` / `admin` — o SonarQube obriga a trocar a senha no
   primeiro acesso
3. **My Account → Security → Generate Tokens**
4. Tipo **Global Analysis Token** (permite analisar todos os serviços com o
   mesmo token)
5. Copie o valor — ele só aparece uma vez

Grave o token:

```bash
cp apps/services/sonar/.env.example apps/services/sonar/.env
```

Edite o `.env` e preencha `SONAR_TOKEN=`. O arquivo está no `.gitignore`.
**Nunca comite o token.**

Alternativamente, exporte na sessão:

```bash
export SONAR_TOKEN="seu_token"
```

No PowerShell:

```bash
$env:SONAR_TOKEN = "seu_token"
```

---

## 4. Rodar a análise

Um serviço:

```bash
node apps/services/sonar/scan.mjs auth-service
```

Todos de uma vez:

```bash
node apps/services/sonar/scan.mjs all
```

Pular a suíte de testes e só reescanear o código, reaproveitando o `lcov`
existente:

```bash
node apps/services/sonar/scan.mjs auth-service --skip-tests
```

O script, para cada serviço:

1. roda `npm run test:coverage`, gerando `coverage/lcov.info`;
2. normaliza os caminhos do `lcov` (ver "Cobertura em 0%" no troubleshooting);
3. sobe o container do scanner anexado à rede `vibester-sonar`;
4. imprime um resumo e o link do dashboard.

**Testes falhando não abortam o scan.** Quase todos os serviços têm thresholds
de coverage de 70/70/60 no Vitest e vários estão abaixo disso hoje. O objetivo
do Sonar é *medir* esse estado, não bloqueá-lo — o script avisa e segue, desde
que o `lcov` tenha sido escrito.

---

## 5. Persistência

O histórico de análises fica em volumes nomeados (`sonarqube_data`,
`sonarqube_extensions`, `sonarqube_logs`, `sonar_db`) e sobrevive a
`docker compose restart` e a `docker compose down`.

Para apagar tudo e começar do zero:

```bash
docker compose -f apps/services/sonar/docker-compose.yml down -v
```

---

## O que fica de fora da análise, e por quê

Definido no `sonar-project.properties` de cada serviço.

### `src/generated/**` — cliente do Prisma

`event-service`, `notification-service` e `scrapping-service` têm o cliente
gerado do Prisma dentro de `src/`, e ele é *maior que o código real*:

| Serviço | Código real | Gerado |
|---|---|---|
| event-service | 1.988 linhas | 8.001 linhas |
| notification-service | 2.660 linhas | 7.268 linhas |
| scrapping-service | 2.125 linhas | 7.773 linhas |

Sem excluir, as métricas de duplicação e complexidade seriam inteiramente sobre
código que ninguém escreveu.

### `sonar.coverage.exclusions` espelha o `coverage.include` do Vitest

As configs cobrem apenas `src/services/**`, `src/controllers/**` e
`src/routes.ts`. O `notification-service` também cobre `src/kafka/handlers/**` e
`src/clients/**`. Sem espelhar isso, todo o resto de `src/` entraria no cálculo
como 0% e distorceria a métrica.

**Ao mexer no `coverage.include` de um `vitest.config.ts`, ajuste o
`sonar.coverage.exclusions` do mesmo serviço.** Os dois precisam continuar
casados.

---

## Limitações do Community Build

Isto é uma **auditoria sob demanda, não um gate de merge.**

O Community Build não faz análise de branch nem decoração de PR — são recursos
da Developer Edition (paga). Toda análise sobrescreve a anterior no mesmo
projeto, sem noção de "new code". Portanto:

- rode o scan a partir da branch que quer inspecionar, ciente de que o resultado
  substitui o anterior;
- não existe integração com GitHub Actions neste setup, e nenhum arquivo em
  `.github/workflows/` foi tocado.

---

## Troubleshooting

**`Bind for 0.0.0.0:9001 failed: port is already allocated`**

Outra coisa está na porta. Descubra o culpado e suba em outra:

```bash
docker ps --format "{{.Names}} {{.Ports}}"
```

```bash
SONAR_PORT=9005 docker compose -f apps/services/sonar/docker-compose.yml up -d
```

**O container do SonarQube morre poucos segundos depois de subir**

É o `vm.max_map_count`. Confira o valor atual:

```bash
docker run --rm --privileged alpine sysctl vm.max_map_count
```

Precisa ser maior ou igual a 524288. Ver seção 2.

**`rede "vibester-sonar" nao encontrada`**

A stack não está no ar. Rode o `docker compose up -d` da seção 1.

**Cobertura aparece como 0% no dashboard**

O reporter `lcov` do Vitest grava caminhos **absolutos** do host nas linhas
`SF:` (ex.: `C:\Users\...\src\services\x.ts`). Dentro do container do scanner
esses caminhos não existem, e o Sonar reporta 0% sem emitir nenhum erro. O
`scan.mjs` reescreve esses caminhos para relativos antes de escanear — se você
chamar o scanner na mão, precisa fazer o mesmo.

**`coverage/lcov.info` não existe**

Confirme que o `coverage.reporter` do serviço inclui `'lcov'`. Atenção:
`establishment-service` e `post-service` usam um `vitest.coverage.config.ts`
próprio, não o `vitest.config.ts`.
