#!/usr/bin/env node
// RustaBase command line tool.
//
//   npx rustabase gen-types --url https://api.example.com --email admin@x.com --password ...
//   npx rustabase gen-types --file schema.json --out src/rustabase-types.ts
//
// Environment fallbacks: RUSTABASE_URL, RUSTABASE_TOKEN, RUSTABASE_EMAIL,
// RUSTABASE_PASSWORD.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { generateTypes } from "./typegen.mjs";

const HELP = `Usage: rustabase gen-types [options]

Reads your tables and writes TypeScript types for them.

Options:
  --url <url>          Server address (or RUSTABASE_URL)
  --token <token>      Superuser token (or RUSTABASE_TOKEN)
  --email <email>      Superuser email (or RUSTABASE_EMAIL)
  --password <pass>    Superuser password (or RUSTABASE_PASSWORD)
  --file <path>        Read the schema from an exported JSON file instead
  --out <path>         Output file (default: src/rustabase-types.ts, "-" for stdout)
  --include-system     Also generate types for built-in tables
  -h, --help           Show this help
`;

export function parseArgs(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "-h" || a === "--help") args.help = true;
        else if (a === "--include-system") args.includeSystem = true;
        else if (a.startsWith("--")) {
            const [k, inline] = a.slice(2).split("=", 2);
            args[k] = inline !== undefined ? inline : argv[++i];
        } else args._.push(a);
    }
    return args;
}

async function call(url, init) {
    const res = await fetch(url, init);
    const text = await res.text();
    if (!res.ok) throw new Error(`${init?.method || "GET"} ${url} failed [${res.status}]: ${text}`);
    return text ? JSON.parse(text) : null;
}

export async function loadSchema(args, env = process.env) {
    if (args.file) {
        const data = JSON.parse(await readFile(args.file, "utf8"));
        return Array.isArray(data) ? data : data.items || data.collections || [];
    }
    const base = String(args.url || env.RUSTABASE_URL || "").replace(/\/+$/, "");
    if (!base) throw new Error("missing --url (or RUSTABASE_URL)");
    let token = args.token || env.RUSTABASE_TOKEN;
    const email = args.email || env.RUSTABASE_EMAIL;
    const password = args.password || env.RUSTABASE_PASSWORD;
    if (!token && email && password) {
        const auth = await call(`${base}/api/collections/_superusers/auth-with-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identity: email, password }),
        });
        token = auth.token;
    }
    if (!token) throw new Error("missing --token, or --email and --password, of a superuser");
    const items = [];
    for (let page = 1; page < 100; page++) {
        const res = await call(`${base}/api/collections?perPage=200&page=${page}`, {
            headers: { Authorization: token },
        });
        items.push(...(res.items || []));
        if (!res.totalPages || page >= res.totalPages) break;
    }
    return items;
}

async function main(argv) {
    const args = parseArgs(argv);
    const cmd = args._[0];
    if (args.help || !cmd) return void process.stdout.write(HELP);
    if (cmd !== "gen-types") throw new Error(`unknown command "${cmd}"\n\n${HELP}`);
    const schema = await loadSchema(args);
    const src = generateTypes(schema, { includeSystem: args.includeSystem });
    const out = args.out || "src/rustabase-types.ts";
    if (out === "-") return void process.stdout.write(src);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, src);
    const n = schema.filter((c) => args.includeSystem || !c.system).length;
    process.stderr.write(`Wrote types for ${n} table(s) to ${out}\n`);
}

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("rustabase");
if (isMain) {
    main(process.argv.slice(2)).catch((err) => {
        process.stderr.write(`rustabase: ${err.message}\n`);
        process.exit(1);
    });
}
