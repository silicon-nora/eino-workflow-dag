import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { repositorySlug } from "./release-metadata.js";

const projectRoot = resolve(import.meta.dirname, "..");

const requiredProvenanceItems = [
  "Confirm the copyright owner for both source application repositories",
  "Obtain written approval for an Apache-2.0 public release",
  "Confirm that employee and contractor contribution agreements cover the extracted revisions",
  "Review visual assets, fixtures, and example data for confidential or third-party material",
  "Confirm that publishing the source application names, paths, and commit identifiers recorded above is authorized",
  "Include the bundled Cytoscape.js MIT notice",
  "Verify that the exact npm name was unregistered on 2026-09-05; repeat immediately before publishing because a lookup does not reserve the name",
  "Record the approving party and approval date in the release record",
];

function fail(messages) {
  throw new Error(`Release readiness check failed:\n${messages.join("\n")}`);
}

export function validateReleaseReadiness(manifest, provenance) {
  const failures = [];
  const checklistEntries = [
    ...provenance.matchAll(/^- \[([ xX])\] (.+(?:\n {2}.+)*)/gm),
  ].map((match) => ({
    item: match[2].replace(/\n\s+/g, " "),
    complete: match[1].toLowerCase() === "x",
  }));
  const checklist = new Set(checklistEntries.map(({ item }) => item));
  for (const item of requiredProvenanceItems) {
    if (!checklist.has(item)) failures.push(`Missing provenance item: ${item}`);
  }
  failures.push(
    ...checklistEntries
      .filter(({ complete }) => !complete)
      .map(({ item }) => `Incomplete provenance item: ${item}`),
  );

  const approvingParty = provenance.match(/^Approving party: (.+)$/m)?.[1]?.trim();
  if (!approvingParty || approvingParty === "Pending") {
    failures.push("PROVENANCE.md must record the approving party");
  }

  const approvalDate = provenance.match(/^Approval date: (.+)$/m)?.[1]?.trim();
  if (!approvalDate || approvalDate === "Pending") {
    failures.push("PROVENANCE.md must record the approval date");
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(approvalDate)) {
    failures.push("PROVENANCE.md approval date must use YYYY-MM-DD");
  } else {
    const [year, month, day] = approvalDate.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      failures.push(`PROVENANCE.md approval date is invalid: ${approvalDate}`);
    }
  }

  const slug = repositorySlug(manifest.repository);
  if (!slug) {
    failures.push("package.json must contain a supported public GitHub repository URL");
  } else {
    const expectedHomepage = `https://github.com/${slug}#readme`;
    const expectedBugs = `https://github.com/${slug}/issues`;
    if (manifest.homepage !== expectedHomepage) {
      failures.push(`package.json homepage must be ${expectedHomepage}`);
    }
    const bugs = typeof manifest.bugs === "string" ? manifest.bugs : manifest.bugs?.url;
    if (bugs !== expectedBugs) {
      failures.push(`package.json bugs URL must be ${expectedBugs}`);
    }
  }

  if (manifest.private === true) {
    failures.push("package.json must not be private");
  }
  if (manifest.publishConfig?.access !== "public") {
    failures.push("package.json publishConfig.access must be public");
  }
  if (manifest.license !== "Apache-2.0") {
    failures.push("package.json license must be Apache-2.0");
  }

  if (failures.length) fail(failures);
  return { approvingParty, approvalDate, repository: slug };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    const manifest = JSON.parse(
      readFileSync(resolve(projectRoot, "package.json"), "utf8"),
    );
    const provenance = readFileSync(resolve(projectRoot, "PROVENANCE.md"), "utf8");
    const result = validateReleaseReadiness(manifest, provenance);
    console.log(
      `OK: release authorized by ${result.approvingParty} on ${result.approvalDate} for ${result.repository}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
