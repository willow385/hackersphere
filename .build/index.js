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
function main() {
  const cert = import_fs.default.readFileSync("cert.pem");
  const key = import_fs.default.readFileSync("key.pem");
  const app = (0, import_gemini_server.default)({ cert, key });
  app.use((req, _res, next) => {
    console.log(`Handling request ${req.path}`);
    next();
  });
  app.on("/", (_req, res) => {
    console.log("Index page requested");
    res.file("index.gmi");
  });
  return app;
}
main().listen(() => console.log("~> Listening <~"));
//# sourceMappingURL=index.js.map
