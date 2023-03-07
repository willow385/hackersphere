import fs from "fs";
import http from "http";

interface GmiError {
  error: 1,
  reason: "malformed GMI text" | "no such file or directory",
  /** The file that the client asked for */
  requestedResource: string,
  /** The gmi file that we tried to find */
  requestedGmi: string
};

interface HtmlText {
  error: 0,
  htmlText: string,
  requestedResource: string,
  requestedGmi: string
};

export default function geminiHttpMirror(
  geminiStaticDir="/home/runner/hackersphere/gemini-static"
) {
  const httpServer = http.createServer((req: any, res: any) => {
    console.log(":: Handling HTTP request ::");
    const resource = req.url.endsWith("/") ? "/index.html" : `${req.url}`;
    if (resource.includes("..")) {
      res.writeHead(403, { "Content-Type": "text/html" });
      res.end("403: Tf you trying to look in a parent directory for?");
    } else if (!resource.endsWith(".html")) {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end("404: HTTP requests must end with .html");
    } else {
      const gmiResource = `${geminiStaticDir}${resource}`
        .replaceAll(".html", ".gmi");
      fs.readFile(
        gmiResource,
        (err: any, data: any) => {
          console.log(`Requested: ${resource}`);
          if (err) {
            res.writeHead(404, { "Content-Type": "text/html" });
            res.end("404: File not found");
          } else {
            console.log(`Read: ${gmiResource}`);
            const conversionResult = convertGmiToHtml(
              data!.toString("utf-8"), resource, gmiResource
            );
            if (conversionResult.error) {
              console.log("Error: " + JSON.stringify(
                conversionResult, null, 2
              ));
              res.writeHead(500, { "Content-Type": "text/html" });
              res.end(`500: ${conversionResult.reason}`);
            } else {
              console.log(`:: Request succeeded at Unix time ${Date.now() / 1000} ::`);
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

function convertGmiToHtml(
  gmiFileContents: string,
  requestedResource: string,
  requestedGmi: string
): HtmlText | GmiError {
  console.log(`Processing GMI file: ${requestedResource} => ${requestedGmi}`);
  const lines = gmiFileContents.split("\n");
  const escape = (s: string) =>
    s.replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("* ", "")
      .replaceAll("#", "");
  let result = `<!DOCTYPE html>\n<html>\n<head>\n<title>${
    escape(`~/${requestedResource}`.replaceAll("//", "/"))
  }\n</title>\n</head>\n<body>\n`;
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
    if (codeMode) continue;
    if (listMode && !line.startsWith("* ")) {
      result += "</ul>\n";
      listMode = false;
    }
    if (line.startsWith("=> ")) {
      const [ _, uri, label ] = line.split(' ');
      try {
        console.log("Rewriting link: " + uri);
        result += `<a href="${uri}">${escape(label ?? uri)}</a>\n`;
      } catch {
        return {
          error: 1,
          reason: "malformed GMI text",
          requestedResource, requestedGmi
        };
      }
    } else if (line.startsWith("* ")) {
      if (!listMode) {
        result += "<ul>\n";
        listMode = true;
      }
      result += `<li>${escape(line)}</li>\n`;
    } else if (line.startsWith("#")) {
      const level = line.split(' ')[0].length;
      result += `<h${level}>${escape(line)}</h${level}>\n`;
    } else {
      result += `<p>${escape(line)}</p>\n`;
    }
  }
  if (listMode) {
    result += "</ul>\n";
    listMode = false;
  }
  if (codeMode) {
    // unterminated monospace block
    return {
      error: 1,
      reason: "malformed GMI text",
      requestedResource, requestedGmi
    };
  } else {
    result += "</body>\n</html>\n";
    return {
      error: 0,
      htmlText: result,
      requestedResource, requestedGmi
    };
  }
}
