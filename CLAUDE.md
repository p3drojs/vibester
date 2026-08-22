# Vibester

> Documento de contexto do projeto.
>
> Este arquivo deve servir como a principal fonte de informações sobre o Vibester para qualquer IA que trabalhe neste repositório. Caso alguma informação entre em conflito com o código-fonte, o código é a fonte de verdade.

---

# Visão Geral

O **Vibester** é uma plataforma focada em vida noturna, eventos e entretenimento, combinando funcionalidades de descoberta de estabelecimentos e eventos com elementos de rede social.

O objetivo do projeto é centralizar informações sobre os eventos e locais da cidade, permitindo que os usuários descubram o que está acontecendo em tempo real através de uma única plataforma.

O projeto está sendo desenvolvido visando se tornar uma startup escalável.

---

# Problema

Hoje as informações sobre eventos, festas e estabelecimentos costumam estar distribuídas em diversas redes sociais e aplicativos.

Isso faz com que o usuário tenha dificuldade para descobrir:

- eventos acontecendo na cidade;
- locais movimentados;
- novidades;
- conteúdo produzido pela comunidade.

O Vibester busca resolver esse problema centralizando essas informações.

---

# Público-alvo

Jovens entre **18 e 27 anos** com acesso à internet e interesse em:

- vida noturna;
- bares;
- festas;
- baladas;
- eventos;
- entretenimento;
- experiências sociais.

---

# Objetivo do Produto

O objetivo de longo prazo é construir uma startup capaz de se tornar referência na descoberta de eventos, estabelecimentos e experiências sociais.

Todo o desenvolvimento do Vibester deve considerar que o produto foi concebido para crescer continuamente em número de usuários, volume de dados e quantidade de interações.

---

# Filosofia de Engenharia

O Vibester é desenvolvido seguindo princípios de engenharia voltados para sistemas distribuídos e de alta escala.

Toda decisão técnica deve priorizar:

- escalabilidade horizontal;
- alta disponibilidade;
- baixo acoplamento;
- alta coesão;
- tolerância a falhas;
- simplicidade arquitetural;
- facilidade de manutenção;
- facilidade de evolução;
- observabilidade;
- desempenho.

Sempre que houver mais de uma solução possível, deve-se priorizar aquela que melhor suporta crescimento futuro sem comprometer a simplicidade do sistema.

---

# Desenvolvimento Orientado à Escala

O Vibester é uma plataforma de rede social.

Portanto, **todo código deve ser desenvolvido assumindo alta volumetria de dados e grande quantidade de usuários simultâneos**.

As implementações devem priorizar:

- processamento eficiente;
- consultas performáticas;
- baixo consumo de recursos;
- redução de gargalos;
- operações assíncronas quando apropriado;
- comunicação desacoplada entre serviços;
- facilidade para distribuição de carga.

O projeto nunca deve assumir um pequeno número de usuários como premissa arquitetural.

---

# Arquitetura

O sistema segue uma arquitetura baseada em microserviços.

Atualmente existem os seguintes serviços:

- Auth
- User
- Event
- Establishment
- Feed
- Post
- Notification
- Payment
- Scrapping

Cada microserviço possui responsabilidade única e deve evoluir de forma independente.

---

# Comunicação entre Serviços

A comunicação assíncrona entre microserviços é realizada através do Apache Kafka.

Sempre que possível:

- evitar chamadas síncronas entre serviços;
- preferir comunicação orientada a eventos;
- minimizar dependências diretas;
- manter baixo acoplamento.

---

# Escalabilidade

Todo novo recurso deve ser desenvolvido considerando:

- possibilidade de múltiplas instâncias do mesmo serviço;
- execução em containers;
- balanceamento de carga;
- processamento distribuído;
- crescimento independente dos microserviços.

Nenhuma implementação deve impedir a escalabilidade horizontal do sistema.

---

# Disponibilidade

O Vibester deve permanecer operacional mesmo diante de falhas pontuais.

Sempre que possível:

- evitar pontos únicos de falha;
- isolar responsabilidades;
- limitar impactos entre serviços;
- permitir recuperação independente dos microserviços.

---

# Stack Tecnológica

## Backend

- Node.js
- TypeScript
- Fastify
- Prisma ORM

## Banco de Dados

- PostgreSQL

## Cache

- Redis

## Mensageria

- Apache Kafka

## Mobile

- Flutter

## Infraestrutura

- Docker
- Docker Compose
- VPS Hostinger
- Kubernetes

## CI/CD

GitHub Actions executa automaticamente:

1. Build
2. Testes
3. Deploy para produção

Sempre que houver alterações na branch `main`.

---

# Autenticação

O sistema utiliza autenticação baseada em JWT.

---

# Funcionalidades

Entre as funcionalidades existentes estão:

- cadastro de usuários;
- autenticação;
- criação de postagens;
- feed;
- scraping da movimentação de estabelecimentos;
- notificações;
- comunicação entre microserviços.

---
# Convenções para IA

Ao gerar código para este projeto:

- respeite a arquitetura existente;
- preserve o baixo acoplamento entre serviços;
- nunca centralize regras de negócio em um único serviço;
- reutilize padrões já existentes;
- escreva código limpo e legível;
- prefira soluções performáticas;
- considere que o sistema deverá suportar milhões de registros;
- minimize chamadas desnecessárias ao banco de dados;
- evite consultas N+1;
- prefira processamento assíncrono quando fizer sentido;
- não introduza dependências desnecessárias;
- preserve compatibilidade com a stack existente;
- escreva código preparado para produção.

---

# Análise Estática (SonarQube)

O backend tem uma instância local de **SonarQube Community Build** para auditar
dívida técnica, security hotspots, complexidade cognitiva e duplicação. Roda
inteiramente na máquina do dev, via Docker.

```bash
docker compose -f apps/services/sonar/docker-compose.yml up -d
node apps/services/sonar/scan.mjs all
```

Dashboard em `http://localhost:9001`. Documentação completa (token, sysctl do
WSL2, troubleshooting) em [`apps/services/sonar/README.md`](apps/services/sonar/README.md).

Pontos de atenção:

- É **auditoria sob demanda, não gate de merge**. O Community Build não faz
  análise de branch nem decoração de PR (recurso de Developer Edition), e
  nenhum workflow do GitHub Actions está integrado a ele.
- Cada serviço tem seu `sonar-project.properties`. O `sonar.coverage.exclusions`
  espelha o `coverage.include` do `vitest.config.ts` do serviço — **ao mexer em
  um, ajuste o outro**, senão a métrica de cobertura fica distorcida.
- O cliente gerado do Prisma (`src/generated/**`) é excluído da análise. Em
  `event-service`, `notification-service` e `scrapping-service` ele é maior que
  o código real e dominaria as métricas.

---

# Fonte de Verdade

Este documento fornece contexto para desenvolvimento.

A implementação existente continua sendo a fonte oficial para:

- contratos;
- entidades;
- eventos Kafka;
- DTOs;
- APIs;
- regras de negócio;
- estrutura dos microserviços.
