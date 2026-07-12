declare module 'node:test' {
  type TestCallback = () => void | Promise<void>;
  type TestFunction = (name: string, callback: TestCallback) => void;

  const test: TestFunction;
  export default test;
}

declare module 'node:assert/strict' {
  type AssertValue = unknown;

  type StrictAssert = {
    deepEqual: (actual: AssertValue, expected: AssertValue, message?: string) => void;
    equal: (actual: AssertValue, expected: AssertValue, message?: string) => void;
    notEqual: (actual: AssertValue, expected: AssertValue, message?: string) => void;
    ok: (value: AssertValue, message?: string) => void;
  };

  const assert: StrictAssert;
  export default assert;
}
