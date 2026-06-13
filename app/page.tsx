import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FormFile } from "./lib/form";
import { Shell } from "./components/Shell";

async function load(): Promise<FormFile | null> {
  try {
    const p = join(process.cwd(), "public/form.json");
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return null;
  }
}

export default async function Home() {
  const form = await load();
  if (!form) {
    return (
      <div className="min-h-screen grid place-items-center text-white/60 font-display tracking-widest uppercase text-sm text-center px-6">
        <div>
          No form data. Run{" "}
          <code className="font-mono ml-2 mr-2 px-2 py-1 bg-white/5 rounded">
            node scripts/fetch-form.mjs
          </code>{" "}
          to bake the season file.
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen flex flex-col">
      <Shell form={form} />
    </div>
  );
}
