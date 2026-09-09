const blockDefinitions = {
  html: { language: "html", marker: "html" },
  javascript: { language: "js", marker: "javascript" },
};

function escapePattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractBlock(markdown, name, definition) {
  const marker = escapePattern(definition.marker);
  const language = escapePattern(definition.language);
  const pattern = new RegExp(
    `<!-- quickstart:${marker}:start -->\\s*\`\`\`${language}\\n([\\s\\S]*?)\\n\`\`\`\\s*<!-- quickstart:${marker}:end -->`,
  );
  const match = markdown.match(pattern);
  if (!match) {
    throw new Error(`README quick start is missing its ${name} block`);
  }
  return match[1];
}

export function extractReadmeQuickstart(markdown) {
  if (typeof markdown !== "string") {
    throw new TypeError("README source must be a string");
  }
  return Object.fromEntries(
    Object.entries(blockDefinitions).map(([name, definition]) => [
      name,
      extractBlock(markdown, name, definition),
    ]),
  );
}

export function createQuickstartDocument(html) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Eino Workflow DAG quick start</title>
    <link rel="icon" href="data:," />
  </head>
  <body>
    ${html}
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`;
}
