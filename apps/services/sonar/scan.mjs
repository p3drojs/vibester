#!/usr/bin/env node
/**
 * Roda a analise do SonarQube para um ou todos os microservicos do Vibester.
 *
 *   node scan.mjs auth-service
 *   node scan.mjs all
 *   node scan.mjs auth-service --skip-tests
 *
 * Pre-requisitos: stack de `docker-compose.yml` no ar e SONAR_TOKEN exportado
 * (ou gravado em `apps/services/sonar/.env`). Ver README.md.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SONAR_DIR = dirname(fileURLToPath(import.meta.url));
const SERVICES_DIR = resolve(SONAR_DIR, "..");
const NETWORK = "vibester-sonar";
const HOST_URL = "http://sonarqube:9000";
const SCANNER_IMAGE = "sonarsource/sonar-scanner-cli:latest";

/**
 * `coverage` = comando npm que gera o lcov. `null` para servicos sem testes.
 * Servicos com `vitest.coverage.config.ts` proprio usam o script que aponta
 * para ele -- por isso o comando nao e identico em todos.
 */
const SERVICES = {
  "auth-service": { lang: "ts", coverage: "test:coverage" },
  "establishment-service": { lang: "ts", coverage: "test:coverage" },
  "event-service": { lang: "ts", coverage: "test:coverage" },
  "feed-service": { lang: "ts", coverage: "test:coverage" },
  "notification-service": { lang: "ts", coverage: "test:coverage" },
  "post-service": { lang: "ts", coverage: "test:coverage" },
  "scrapping-service": { lang: "ts", coverage: "test:coverage" },
  "user-service": { lang: "ts", coverage: "test:coverage" },
  // Go, e hoje sem nenhum arquivo *_test.go -> analisa sem coverage.
  "payment-service": { lang: "go", coverage: null },
};

const RESET = "\u001b[0m";
const log = (msg) => console.log(`\u001b[36m[sonar]${RESET} ${msg}`);
const warn = (msg) => console.log(`\u001b[33m[sonar]${RESET} ${msg}`);
const fail = (msg) => console.log(`\u001b[31m[sonar]${RESET} ${msg}`);

/** Le `.env` local (KEY=VALUE) sem depender do pacote dotenv. */
function loadDotEnv() {
  const envFile = join(SONAR_DIR, ".env");
  if (!existsSync(envFile)) return;
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

/**
 * O reporter lcov do Vitest grava caminhos absolutos do host em `SF:`
 * (ex.: C:\Users\...\src\services\x.ts). Dentro do container do scanner esses
 * caminhos nao existem e o Sonar reporta 0% de cobertura sem nenhum erro.
 * Reescrevemos para caminhos relativos a raiz do servico, que e o que o parser
 * de LCOV do Sonar resolve contra o sonar.projectBaseDir.
 */
function normalizeLcov(serviceDir) {
  const lcovPath = join(serviceDir, "coverage", "lcov.info");
  if (!existsSync(lcovPath)) return false;

  const normalized = readFileSync(lcovPath, "utf8")
    .split(/\r?\n/)
    .map((line) => {
      if (!line.startsWith("SF:")) return line;
      const filePath = line.slice(3).trim();
      const rel = relative(serviceDir, resolve(serviceDir, filePath));
      return `SF:${rel.split("\\").join("/")}`;
    })
    .join("\n");

  writeFileSync(lcovPath, normalized);
  return true;
}

function runCoverage(name, serviceDir, script) {
  log(`${name}: gerando coverage (npm run ${script})`);
  const result = spawnSync("npm", ["run", script], {
    cwd: serviceDir,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    // Quase todos os servicos tem thresholds de 70/70/60 no Vitest. Hoje varios
    // ficam abaixo disso, e o objetivo do Sonar e justamente MEDIR esse estado,
    // nao barra-lo. Seguimos adiante desde que o lcov tenha sido escrito.
    warn(`${name}: coverage saiu com codigo ${result.status} (testes falhando ou threshold nao atingido) -- seguindo com o lcov gerado`);
  }
  return normalizeLcov(serviceDir);
}

function runScanner(name, serviceDir, token) {
  log(`${name}: executando scanner`);
  const result = spawnSync(
    "docker",
    [
      "run", "--rm",
      "--network", NETWORK,
      "-e", `SONAR_HOST_URL=${HOST_URL}`,
      "-e", `SONAR_TOKEN=${token}`,
      "-v", `${serviceDir}:/usr/src`,
      SCANNER_IMAGE,
    ],
    { stdio: "inherit", shell: false },
  );
  return result.status === 0;
}

function assertStackIsUp() {
  try {
    execFileSync("docker", ["network", "inspect", NETWORK], { stdio: "ignore" });
  } catch {
    fail(`rede "${NETWORK}" nao encontrada. Suba a stack primeiro:`);
    fail(`  docker compose -f "${join(SONAR_DIR, "docker-compose.yml")}" up -d`);
    process.exit(1);
  }
}

function main() {
  const args = process.argv.slice(2);
  const skipTests = args.includes("--skip-tests");
  const targets = args.filter((a) => !a.startsWith("--"));

  if (targets.length === 0) {
    console.log("uso: node scan.mjs <servico|all> [--skip-tests]");
    console.log(`servicos: ${Object.keys(SERVICES).join(", ")}`);
    process.exit(1);
  }

  loadDotEnv();
  const token = process.env.SONAR_TOKEN;
  if (!token) {
    fail(`SONAR_TOKEN nao definido. Gere um token em http://localhost:${process.env.SONAR_PORT || "9001"} e exporte a variavel`);
    fail(`ou grave em ${join(SONAR_DIR, ".env")} (arquivo ignorado pelo git).`);
    process.exit(1);
  }

  const selected = targets.includes("all") ? Object.keys(SERVICES) : targets;
  for (const name of selected) {
    if (!SERVICES[name]) {
      fail(`servico desconhecido: ${name}`);
      process.exit(1);
    }
  }

  assertStackIsUp();

  const results = [];
  for (const name of selected) {
    const config = SERVICES[name];
    const serviceDir = join(SERVICES_DIR, name);

    if (!existsSync(join(serviceDir, "sonar-project.properties"))) {
      fail(`${name}: sonar-project.properties ausente -- pulando`);
      results.push([name, "sem config"]);
      continue;
    }

    let hasCoverage = false;
    if (config.coverage && !skipTests) {
      hasCoverage = runCoverage(name, serviceDir, config.coverage);
      if (!hasCoverage) {
        warn(`${name}: coverage/lcov.info nao foi gerado -- analise seguira sem cobertura`);
      }
    } else if (config.coverage) {
      hasCoverage = normalizeLcov(serviceDir);
    }

    const ok = runScanner(name, serviceDir, token);
    results.push([name, ok ? (hasCoverage ? "ok" : "ok (sem coverage)") : "FALHOU"]);
  }

  console.log("");
  log("resumo:");
  for (const [name, status] of results) console.log(`  ${name.padEnd(24)} ${status}`);
  console.log("");
  log(`dashboard: http://localhost:${process.env.SONAR_PORT || "9001"}/projects`);

  if (results.some(([, status]) => status === "FALHOU")) process.exit(1);
}

main();
