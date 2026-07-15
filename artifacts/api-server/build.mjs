import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, mkdir } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(artifactDir, "../..");

/**
 * Pre-bundle a workspace package to a single ESM JS file so the main build
 * can import it without needing to resolve TypeScript files through pnpm symlinks.
 * All npm packages are kept external so the main build resolves them normally.
 */
async function prebuildWorkspacePkg(entryPoint, outFile, pkgDir) {
  await esbuild({
    entryPoints: [entryPoint],
    absWorkingDir: pkgDir,
    platform: "node",
    bundle: true,
    format: "esm",
    outfile: outFile,
    external: ["*.node"],
    logLevel: "warning",
  });
}

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  const prebuildDir = path.resolve(artifactDir, ".workspace-prebuild");

  await rm(distDir, { recursive: true, force: true });
  await rm(prebuildDir, { recursive: true, force: true });
  await mkdir(prebuildDir, { recursive: true });

  // Step 1: pre-build workspace packages to plain JS files
  console.log("Pre-building @workspace/db ...");
  const dbBundle = path.resolve(prebuildDir, "db.mjs");
  await prebuildWorkspacePkg(
    path.resolve(workspaceRoot, "lib/db/src/index.ts"),
    dbBundle,
    path.resolve(workspaceRoot, "lib/db")
  );

  console.log("Pre-building @workspace/api-zod ...");
  const apiZodBundle = path.resolve(prebuildDir, "api-zod.mjs");
  await prebuildWorkspacePkg(
    path.resolve(workspaceRoot, "lib/api-zod/src/index.ts"),
    apiZodBundle,
    path.resolve(workspaceRoot, "lib/api-zod")
  );

  // Step 2: main build — alias workspace packages to their pre-built JS files
  console.log("Building API server ...");
  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    absWorkingDir: workspaceRoot,
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    alias: {
      "@workspace/db": dbBundle,
      "@workspace/api-zod": apiZodBundle,
    },
    // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
    // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
    // Examples of unbundleable packages:
    // - uses native modules and loads them dynamically (e.g. sharp)
    // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] }),
    ],
    // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
