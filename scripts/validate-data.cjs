/* global __dirname */

const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

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

const rootDir = path.resolve(__dirname, '..');
const { validateDataIntegrity } = require(path.join(rootDir, 'utils', 'validateDataIntegrity.ts'));
const result = validateDataIntegrity();

if (!result.isValid) {
  console.error(result.errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Data integrity check passed.');
}
