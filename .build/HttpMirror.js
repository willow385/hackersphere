"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var HttpMirror_exports = {};
__export(HttpMirror_exports, {
  default: () => geminiHttpMirror
});
module.exports = __toCommonJS(HttpMirror_exports);
var import_fs = __toESM(require("fs"));
var import_http = __toESM(require("http"));
;
;
function geminiHttpMirror(geminiStaticDir = "/home/runner/hackersphere/gemini-static") {
  const httpServer = import_http.default.createServer((req, res) => {
    console.log(":: Handling HTTP request ::");
    const resource = req.url.endsWith("/") ? "/index.html" : `${req.url}`;
    if (resource.includes("..")) {
      res.writeHead(403, { "Content-Type": "text/html" });
      res.end("403: Tf you trying to look in a parent directory for?");
    } else if (!resource.endsWith(".html")) {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end("404: HTTP requests must end with .html");
    } else {
      const gmiResource = `${geminiStaticDir}${resource}`.replaceAll(".html", ".gmi");
      import_fs.default.readFile(
        gmiResource,
        (err, data) => {
          console.log(`Requested: ${resource}`);
          if (err) {
            res.writeHead(404, { "Content-Type": "text/html" });
            res.end("404: File not found");
          } else {
            console.log(`Read: ${gmiResource}`);
            const conversionResult = convertGmiToHtml(
              data.toString("utf-8"),
              resource,
              gmiResource
            );
            if (conversionResult.error) {
              console.log("Error: " + JSON.stringify(
                conversionResult,
                null,
                2
              ));
              res.writeHead(500, { "Content-Type": "text/html" });
              res.end(`500: ${conversionResult.reason}`);
            } else {
              console.log(`:: Request succeeded at Unix time ${Date.now() / 1e3} ::`);
              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(conversionResult.htmlText);
            }
          }
        }
      );
    }
  });
  return {
    http: () => {
      console.log("Starting HTTP server");
      return httpServer;
    }
  };
}
function convertGmiToHtml(gmiFileContents, requestedResource, requestedGmi) {
  console.log(`Processing GMI file: ${requestedResource} => ${requestedGmi}`);
  const lines = gmiFileContents.split("\n");
  const escape = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("* ", "").replaceAll("#", "");
  let result = `<!DOCTYPE html>
<html>
<head>
<title>${escape(`~/${requestedResource}`.replaceAll("//", "/"))}
</title>
</head>
<body>
`;
  let codeMode = false;
  let listMode = false;
  for (const line of lines) {
    if (line.startsWith("```")) {
      codeMode = !codeMode;
      if (codeMode) {
        result += "<code>\n";
      } else {
        result += "</code><br>\n";
      }
    }
    if (codeMode)
      continue;
    if (listMode && !line.startsWith("* ")) {
      result += "</ul>\n";
      listMode = false;
    }
    if (line.startsWith("=> ")) {
      const [_, uri, label] = line.split(" ");
      try {
        console.log("Rewriting link: " + uri);
        result += `<a href="${uri}">${escape(label ?? uri)}</a>
`;
      } catch {
        return {
          error: 1,
          reason: "malformed GMI text",
          requestedResource,
          requestedGmi
        };
      }
    } else if (line.startsWith("* ")) {
      if (!listMode) {
        result += "<ul>\n";
        listMode = true;
      }
      result += `<li>${escape(line)}</li>
`;
    } else if (line.startsWith("#")) {
      const level = line.split(" ")[0].length;
      result += `<h${level}>${escape(line)}</h${level}>
`;
    } else {
      result += `<p>${escape(line)}</p>
`;
    }
  }
  if (listMode) {
    result += "</ul>\n";
    listMode = false;
  }
  if (codeMode) {
    return {
      error: 1,
      reason: "malformed GMI text",
      requestedResource,
      requestedGmi
    };
  } else {
    result += "</body>\n</html>\n";
    return {
      error: 0,
      htmlText: result,
      requestedResource,
      requestedGmi
    };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {});
//# sourceMappingURL=HttpMirror.js.map
