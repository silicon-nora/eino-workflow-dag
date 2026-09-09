import assert from "node:assert/strict";
import {
  createQuickstartDocument,
  extractReadmeQuickstart,
} from "../scripts/readme-quickstart.js";

const markdown = `
<!-- quickstart:html:start -->
\`\`\`html
<div id="workflow"></div>
\`\`\`
<!-- quickstart:html:end -->
<!-- quickstart:javascript:start -->
\`\`\`js
console.log("ready");
\`\`\`
<!-- quickstart:javascript:end -->
`;

assert.deepEqual(extractReadmeQuickstart(markdown), {
  html: '<div id="workflow"></div>',
  javascript: 'console.log("ready");',
});
assert.match(createQuickstartDocument("<main>ready</main>"), /<main>ready<\/main>/);
assert.match(createQuickstartDocument("<main>ready</main>"), /src="\/src\/main\.js"/);
assert.throws(
  () => extractReadmeQuickstart("# Missing blocks"),
  /missing its html block/,
);
assert.throws(() => extractReadmeQuickstart(null), /must be a string/);

console.log("OK: README quick-start extraction tests passed");
