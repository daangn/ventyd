interface Page {
  info: { path: string };
  title?: string;
  description?: string;
  getText: (type: "raw" | "processed") => Promise<string>;
}

export async function getLLMText(page: Page): Promise<string> {
  const processed = await page.getText("processed");

  return `---
title: "${page.title ?? ""}"
description: "${page.description ?? ""}"
---

${processed}`;
}
