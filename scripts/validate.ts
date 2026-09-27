// Checks every data file. Run with: npm run validate
// Prints each problem with the file it's in, and exits with an error if there are any, which
// makes the build and CI stop.

import { loadDataset } from './lib/data.ts';
import { validateDataset } from './lib/validate-data.ts';

const dataset = loadDataset();
const problems = validateDataset(dataset);

const counts = [
  `${dataset.sources.length} sources`,
  `${dataset.polities.length} polities`,
  `${dataset.assertions.reduce((n, f) => n + (Array.isArray(f.value) ? f.value.length : 0), 0)} assertions`,
  `${dataset.events.length} events`,
  `${dataset.figures.reduce((n, f) => n + (Array.isArray(f.value) ? f.value.length : 0), 0)} figures`,
  `${dataset.shapes.length} shapes`,
  `${dataset.imports.length} import folders`,
].join(', ');

if (problems.length === 0) {
  console.log(`Data is valid: ${counts}.`);
} else {
  const byFile = new Map<string, string[]>();
  for (const { file, message } of problems) byFile.set(file, [...(byFile.get(file) ?? []), message]);
  for (const [file, messages] of byFile) {
    console.error(`\n${file}`);
    for (const message of messages) console.error(`  - ${message}`);
  }
  console.error(`\n${problems.length} problem(s) in ${byFile.size} file(s). Checked: ${counts}.`);
  process.exit(1);
}
