// Packages the built app (dist/) into an ad-hoc signed macOS app and a .dmg in out/, for this
// Mac's architecture. Run `bun run package` here, or `bun run package:desktop` from the repo root.
import { FuseV1Options, FuseVersion, flipFuses } from "@electron/fuses";
import { packager } from "@electron/packager";
import { existsSync, realpathSync } from "node:fs";
import { cp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

const root = join(import.meta.dir, "..");
const out = join(root, "out");
const stage = join(out, "stage");

if (process.platform !== "darwin") {
  throw new Error("Vita OS packages only for macOS for now.");
}

type Manifest = {
  name: string;
  productName: string;
  version: string;
  main: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

const readManifest = async (dir: string): Promise<Manifest> =>
  JSON.parse(await readFile(join(dir, "package.json"), "utf8"));

const desktop = await readManifest(root);
const electronVersion = (await readManifest(packageDir(root, "electron")!))
  .version;
// Main bundles everything except @libsql/client, which loads its native binding at runtime.
const runtimeDependency = "@libsql/client";

await run(["bunx", "turbo", "run", "build", "--filter=@vita-os/desktop"]);
await rm(out, { recursive: true, force: true });

// The app folder holds only what the built app loads, so the packager never reads bun's
// symlinked node_modules.
await mkdir(stage, { recursive: true });
await cp(join(root, "dist"), join(stage, "dist"), { recursive: true });
await writeFile(
  join(stage, "package.json"),
  JSON.stringify(
    {
      name: desktop.name,
      // The user-data folder is named after it: ~/Library/Application Support/Vita OS.
      productName: desktop.productName,
      version: desktop.version,
      type: "module",
      main: desktop.main,
    },
    null,
    2,
  ),
);
await copyRuntimeDependencies(
  packageDir(root, runtimeDependency)!,
  join(stage, "node_modules"),
);

const [appDir] = await packager({
  dir: stage,
  out,
  name: desktop.productName,
  appBundleId: "com.vita-os.desktop",
  appCategoryType: "public.app-category.productivity",
  // Rendered from assets/icon.svg; see the README.
  icon: join(root, "assets/icon.icns"),
  platform: "darwin",
  arch: process.arch,
  electronVersion,
  // The stage has no devDependencies to prune, and its node_modules are already real folders.
  prune: false,
  asar: { unpack: "**/*.node" },
});
if (!appDir) throw new Error("The packager produced no app.");
const app = join(appDir, `${desktop.productName}.app`);

// Nothing but the app's own archive runs in its binary: no Node from ELECTRON_RUN_AS_NODE or
// NODE_OPTIONS, no code outside app.asar, and app.asar as packaged. The node inspector stays,
// because Playwright drives the packaged app through it (apps/e2e/tests/desktop).
await flipFuses(app, {
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
});

// Ad-hoc signed as one bundle, so an unquarantined copy opens and a quarantined one gets
// macOS's "Open Anyway" instead of "damaged".
await run(["codesign", "--force", "--deep", "--sign", "-", app]);
await run(["codesign", "--verify", "--deep", "--strict", app]);

const dmgFolder = join(out, "dmg");
await mkdir(dmgFolder);
await cp(app, join(dmgFolder, basename(app)), {
  recursive: true,
  verbatimSymlinks: true,
});
await symlink("/Applications", join(dmgFolder, "Applications"));
const dmg = join(
  out,
  `${desktop.productName}-${desktop.version}-${process.arch}.dmg`,
);
await run([
  "hdiutil",
  "create",
  "-volname",
  desktop.productName,
  "-srcfolder",
  dmgFolder,
  "-format",
  "UDZO",
  "-ov",
  dmg,
]);
await rm(dmgFolder, { recursive: true });

console.info(`Packaged ${app}\nDisk image ${dmg}`);

/**
 * Copies `from` and everything it depends on into a flat `node_modules`, following bun's
 * symlinks. Optional dependencies that aren't installed (other platforms' libsql bindings)
 * are skipped. Two versions of one package would need nesting, so that fails instead.
 */
async function copyRuntimeDependencies(from: string, nodeModules: string) {
  const copied = new Map<string, string>();
  const pending = [from];
  for (let dir = pending.pop(); dir; dir = pending.pop()) {
    const manifest = await readManifest(dir);
    const seen = copied.get(manifest.name);
    if (seen === manifest.version) continue;
    if (seen !== undefined) {
      throw new Error(
        `${manifest.name} is needed at ${seen} and ${manifest.version}; packaging can't nest versions yet.`,
      );
    }
    copied.set(manifest.name, manifest.version);
    await cp(dir, join(nodeModules, manifest.name), {
      recursive: true,
      dereference: true,
    });
    for (const name of Object.keys(manifest.dependencies ?? {})) {
      const found = packageDir(dir, name);
      if (!found) throw new Error(`${manifest.name} needs ${name}, not found.`);
      pending.push(found);
    }
    for (const name of Object.keys(manifest.optionalDependencies ?? {})) {
      const found = packageDir(dir, name);
      if (found) pending.push(found);
    }
  }
}

/** Where `name` resolves from `dir`, as Node looks it up: each ancestor's node_modules. */
function packageDir(dir: string, name: string): string | undefined {
  for (let at = realpathSync(dir); ; at = dirname(at)) {
    if (basename(at) !== "node_modules") {
      const candidate = join(at, "node_modules", name);
      if (existsSync(join(candidate, "package.json")))
        return realpathSync(candidate);
    }
    if (dirname(at) === at) return undefined;
  }
}

async function run(command: string[]) {
  const child = Bun.spawn(command, {
    cwd: root,
    stdio: ["inherit", "inherit", "inherit"],
  });
  const code = await child.exited;
  if (code !== 0) throw new Error(`${command.join(" ")} exited with ${code}`);
}
