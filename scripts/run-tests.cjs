/* global __dirname */

const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const rootDir = path.resolve(__dirname, '..');
const testsDir = path.join(rootDir, 'tests');

Module._extensions['.ts'] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  module._compile(output.outputText, filename);
};

Module._extensions['.tsx'] = Module._extensions['.ts'];

function findTestFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return findTestFiles(entryPath);
      }

      return entry.name.endsWith('.test.ts') ? [entryPath] : [];
    })
    .sort();
}

const testFiles = findTestFiles(testsDir);

if (testFiles.length === 0) {
  throw new Error('No test files found.');
}

testFiles.forEach((testFile) => {
  require(testFile);
});
