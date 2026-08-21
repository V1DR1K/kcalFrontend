import test from "node:test";
import assert from "node:assert/strict";
import { compressMealPhoto } from "../src/services/image.js";

test("comprime la foto de comida y libera la URL temporal", async () => {
  const originalImage = globalThis.Image;
  const originalDocument = globalThis.document;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const draws = [];
  const revoked = [];

  class MockImage {
    naturalWidth = 2400;
    naturalHeight = 1200;

    set src(value) {
      this.source = value;
      queueMicrotask(() => this.onload());
    }
  }

  globalThis.Image = MockImage;
  URL.createObjectURL = () => "blob:meal";
  URL.revokeObjectURL = (source) => revoked.push(source);
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: (...args) => draws.push(args) }),
      toBlob: (callback) => callback(new Blob(["compressed"], { type: "image/jpeg" })),
    }),
  };

  try {
    const result = await compressMealPhoto(new Blob(["original"], { type: "image/png" }));
    assert.equal(result.name, "comida.jpg");
    assert.equal(result.type, "image/jpeg");
    assert.equal(result.size, 10);
    assert.deepEqual(draws[0].slice(1), [0, 0, 1280, 640]);
    assert.deepEqual(revoked, ["blob:meal"]);
  } finally {
    globalThis.Image = originalImage;
    globalThis.document = originalDocument;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});
