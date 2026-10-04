import { execFileSync } from "node:child_process";
import { existsSync, cpSync } from "node:fs";
import { resolve } from "node:path";

const staging = resolve(".interview-release-web");
if (existsSync(staging))
  throw new Error(
    ".interview-release-web already exists; review the staging checkout before rebuilding.",
  );
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run through npm run prepare:web");
execFileSync(
  "git",
  [
    "clone",
    "--depth",
    "1",
    "--no-checkout",
    "https://github.com/shivansh-verma13/MERN-gpt.git",
    staging,
  ],
  { stdio: "inherit" },
);
execFileSync(
  "git",
  [
    "fetch",
    "--depth",
    "1",
    "origin",
    process.env.WEB_REF ?? "upgrade/interview-lab",
  ],
  { cwd: staging, stdio: "inherit" },
);
execFileSync("git", ["checkout", "--detach", "FETCH_HEAD"], {
  cwd: staging,
  stdio: "inherit",
});
console.log(
  "Building frontend revision " +
    execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: staging,
      encoding: "utf8",
    }).trim(),
);
for (const args of [["ci", "--include=dev"], ["run", "build"]])
  execFileSync(process.execPath, [npm, ...args], {
    cwd: staging,
    stdio: "inherit",
  });
cpSync(resolve(staging, "dist"), resolve("web"), { recursive: true });
console.log(
  "Frontend copied to web. Set WEB_DIST=./web and review the checkout revision before deployment.",
);
