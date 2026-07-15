import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, readFile } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(artifactDir, "../..");

/** Resolve @workspace/* packages by reading their source directly,
 *  setting resolveDir so relative imports inside them work correctly. */
function workspacePlugin(packages) {
  const TS_EXTS = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"];

  function resolveWithExts(base) {
    for (const ext of TS_EXTS) {
      const full = base + ext;
      if (existsSync(full)) return full;
    }
    if (existsSync(base)) return base;
    return null;
  }

  return {
    name: "workspace-packages",
    setup(build) {
      const filter = new RegExp(
        "^(" + Object.keys(packages).map((k) => k.replace(/\//g, "\\/")).join("|") + ")$"
      );

      // Intercept top-level @workspace/* imports
      build.onResolve({ filter }, (args) => ({
        path: packages[args.path],
        namespace: "workspace-src",
      }));

      // Intercept relative imports that originate from within workspace-src files
      build.onResolve({ filter: /^\./, namespace: "workspace-src" }, (args) => {
        const base = path.resolve(args.resolveDir, args.path);
        const resolved = resolveWithExts(base);
        if (resolved) return { path: resolved, namespace: "workspace-src" };
        return null;
      });

      // Load any workspace-src file as TypeScript with correct resolveDir
      build.onLoad({ filter: /.*/, namespace: "workspace-src" }, async (args) => ({
        contents: await readFile(args.path, "utf8"),
        loader: args.path.endsWith(".tsx") ? "tsx" : "ts",
        resolveDir: path.dirname(args.path),
      }));
    },
  };
}

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
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
      workspacePlugin({
        "@workspace/db": path.resolve(workspaceRoot, "lib/db/src/index.ts"),
        "@workspace/api-zod": path.resolve(workspaceRoot, "lib/api-zod/src/index.ts"),
      }),
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
