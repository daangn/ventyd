import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    standard: "src/standard.ts",
    valibot: "src/valibot.ts",
    typebox: "src/typebox.ts",
    "typebox0": "src/typebox0.ts",
    zod: "src/zod.ts",
    arktype: "src/arktype.ts",
    "adapter/prisma": "src/adapter/prisma.ts",
  },
  dts: true,
  clean: true,
  format: ["esm", "cjs"],
});
