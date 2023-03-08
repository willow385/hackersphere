import fs from "fs";
import https from "https";
import http, { IncomingMessage, ServerResponse } from "http";
import { GlobalConstants } from "./GlobalConstants";
import TlsCertKeyPair from "./TlsCertificates";

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
  tlsDetails: TlsCertKeyPair,
  geminiStaticDir: string = GlobalConstants.StaticDirectory
) {
  const httpServer = https.createServer(tlsDetails, (req: IncomingMessage, res: ServerResponse) => {
    console.log(":: Handling HTTPS request ::");
    const resource = req.url!.endsWith("/") ? "/index.html" : `${req.url}`;
    if (resource.includes("..")) {
      res.writeHead(403);
      res.end("403: Tf you trying to look in a parent directory for?");
    } else if (!resource.endsWith(".html")) {
      res.writeHead(404);
      res.end("404: HTTPS requests must end with .html");
    } else {
      const gmiResource = `${geminiStaticDir}${resource}`
        .replaceAll(".html", ".gmi");
      fs.readFile(
        gmiResource,
        (err: NodeJS.ErrnoException | null, data: Buffer) => {
          console.log(`Requested: ${resource}`);
          if (err) {
            res.writeHead(404);
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
              res.writeHead(500);
              res.end(`500: ${conversionResult.reason}`);
            } else {
              console.log(`:: Request succeeded at ${new Date()} ::`);
              res.writeHead(200);
              res.end(conversionResult.htmlText);
            }
          }
        }
      ); 
    }
  });
  return {
    http: (uri: string) => ({
      listen: (port: number) => {
        console.log(`Starting HTTP server on https://${uri}:${port}`)
        return httpServer.listen(port, "0.0.0.0");
      }
    })
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
  const mirrorNoticePath = "/home/willowf/hackersphere/src/mirror-notice.html";
  const mirrorNotice = fs.readFileSync(mirrorNoticePath, "utf-8")
    .replaceAll(
      "@@REQUESTED_URL@@",
      `${GlobalConstants.BaseUri}${requestedResource.replaceAll(".html", ".gmi")}`
    );
  let result = `<!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="utf-8">
  <title>${escape(`~/${requestedResource}`.replaceAll("//", "/"))}</title>
  <style>
    body {
      font-family: monospace;
    }
    a {
      color: #4979F2;
    }
  </style>
  </head>
  <body>
  ${mirrorNotice}\n`;
  let codeMode = false;
  let listMode = false;
  for (const line of lines) {
    if (line.startsWith("```")) {
      codeMode = !codeMode;
      if (codeMode) {
        result += "<pre>\n";
        continue;
      } else {
        result += "</pre>\n";
        continue;
      }
    }
    if (codeMode) {
      result += line + "\n";
      continue;
    }
    if (listMode && !line.startsWith("* ")) {
      result += "</ul>\n";
      listMode = false;
    }
    if (line.startsWith("=> ")) {
      const [ _, uri, label ] = line.split(' ');
      try {
        console.log("Rewriting link as HTML anchor tag: " + uri);
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
