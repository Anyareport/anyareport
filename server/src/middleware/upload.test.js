import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createServer } from "node:http";
import multer from "multer";
import upload, { uploadErrorHandler } from "./upload.js";

function invokeUploadErrorHandler(error) {
  const response = {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let forwardedError;
  const next = (nextError) => {
    forwardedError = nextError;
  };

  const result = uploadErrorHandler(error, {}, response, next);
  return { response, forwardedError, result };
}

test("maps upload size limit errors to a clear 413 response", () => {
  const { response, forwardedError } = invokeUploadErrorHandler(
    new multer.MulterError("LIMIT_FILE_SIZE")
  );

  assert.equal(response.statusCode, 413);
  assert.deepEqual(response.body, {
    code: "UPLOAD_FILE_TOO_LARGE",
    error: "Each image must be 5 MB or smaller.",
  });
  assert.equal(forwardedError, undefined);
});

test("maps file type errors to a clear 415 response", () => {
  const error = new Error("Only image files are allowed");
  error.code = "INVALID_FILE_TYPE";
  const { response, forwardedError } = invokeUploadErrorHandler(error);

  assert.equal(response.statusCode, 415);
  assert.deepEqual(response.body, {
    code: "UPLOAD_INVALID_FILE_TYPE",
    error: "Only image files are allowed.",
  });
  assert.equal(forwardedError, undefined);
});

test("maps too many upload fields to a clear 400 response", () => {
  const { response, forwardedError } = invokeUploadErrorHandler(
    new multer.MulterError("LIMIT_UNEXPECTED_FILE", "photos")
  );

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, {
    code: "UPLOAD_UNEXPECTED_FILE",
    error: "Unexpected upload field or too many images. You can upload up to 3 images.",
  });
  assert.equal(forwardedError, undefined);
});

test("forwards unrelated errors to the generic error handler", () => {
  const error = new Error("Unexpected failure");
  const { response, forwardedError } = invokeUploadErrorHandler(error);

  assert.equal(response.statusCode, null);
  assert.equal(forwardedError, error);
});

test("upload middleware returns client-facing errors for invalid and oversized files", async (t) => {
  const app = express();
  app.post("/upload", upload.array("photos", 3), (_req, res) => res.sendStatus(204));
  app.use(uploadErrorHandler);

  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/upload`;

  const invalidTypeForm = new FormData();
  invalidTypeForm.append("photos", new Blob(["not an image"], { type: "text/plain" }), "notes.txt");
  const invalidTypeResponse = await fetch(url, { method: "POST", body: invalidTypeForm });
  assert.equal(invalidTypeResponse.status, 415);
  assert.equal(
    (await invalidTypeResponse.json()).error,
    "Only image files are allowed."
  );

  const oversizedForm = new FormData();
  oversizedForm.append(
    "photos",
    new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/jpeg" }),
    "large.jpg"
  );
  const oversizedResponse = await fetch(url, { method: "POST", body: oversizedForm });
  assert.equal(oversizedResponse.status, 413);
  assert.equal(
    (await oversizedResponse.json()).error,
    "Each image must be 5 MB or smaller."
  );
});
