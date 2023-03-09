"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var import_gemini_server = __toESM(require("gemini-server"));
var import_fs = __toESM(require("fs"));
var import_HttpMirror = __toESM(require("./HttpMirror"));
function createGeminiServer(geminiStaticDir = "/home/runner/hackersphere/gemini-static", certFile = "cert.pem", keyFile = "key.pem") {
  const cert = import_fs.default.readFileSync(certFile);
  const key = import_fs.default.readFileSync(keyFile);
  const geminiServer = (0, import_gemini_server.default)({ cert, key });
  geminiServer.use((req, _res, next) => {
    console.log(`Handling request ${req.path}`);
    next();
  });
  geminiServer.on("*", (req, res) => {
    console.log("Request: " + req.url);
    const path = `${geminiStaticDir}${req.url}`;
    const requestedData = import_fs.default.readFileSync(path, "utf-8");
    res.data(requestedData, "text/gemini");
  });
  return {
    gemini: () => {
      console.log("Starting Gemini server");
      return geminiServer;
    }
  };
}
function main() {
  const gmi = createGeminiServer();
  const mirror = (0, import_HttpMirror.default)();
  gmi.gemini().listen(443);
  mirror.http().listen(80);
}
main();
//# sourceMappingURL=index.js.map
