import { execFileSync } from "node:child_process";
import { existsSync, cpSync } from "node:fs";
import { resolve } from "node:path";

const staging = resolve(".release-web");
if (existsSync(staging))
  throw new Error(
    ".release-web already exists; review the staging checkout before rebuilding.",
  );
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run through npm run prepare:web");
execFileSync(
  "git",
  [
    "clone",
    "--depth",
    "1",
    "--branch",
    process.env.WEB_REF ?? "upgrade/briefcase-v2",
    "https://github.com/shivansh-verma13/MERN-gpt.git",
    staging,
  ],
  { stdio: "inherit" },
);
for (const args of [["ci"], ["run", "build"]])
  execFileSync(process.execPath, [npm, ...args], {
    cwd: staging,
    stdio: "inherit",
  });
cpSync(resolve(staging, "dist"), resolve("web"), { recursive: true });
console.log(
  "Frontend copied to web. Set WEB_DIST=./web and review the checkout revision before deployment.",
);
