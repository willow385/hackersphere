import fs from "fs";
import https from "https";
import { IncomingMessage, ServerResponse } from "http";
import { loadTlsDetails } from "./TlsCertificates";
import { ServerConfiguration } from "./ServerCfg";
import applyTemplateSubstitution, { loadGmi } from "./TemplateProcessor";

interface GmiError {
  error: 1,
  reason: "malformed GMI text" | "no such file or directory",
  /** The file that the client asked for */
  requestedResource: string
};

interface HtmlText {
  error: 0,
  htmlText: string,
  requestedResource: string
};

export default async function geminiHttpMirror(
  cfg: ServerConfiguration,
  /**
   * This should return a string that uniquely identifies each request, for logging.
   * Successive calls should always return unique values.
   */
  generateRequestId: () => string
) {
  const tlsDetails = await loadTlsDetails(cfg.tlsCertDirectory, cfg.certFile, cfg.keyFile);
  async function handleRequest(req: IncomingMessage, res: ServerResponse) {
    const requestId = generateRequestId();
    console.log(`~ Handling https request ${requestId} ~`);
    console.log(`${requestId}: requested url: ${req.url}`);
    const resource = (req?.url === "/" ? "/index.gmi" : req.url) ?? "/index.gmi";
    const internalServerError = (res: ServerResponse, message: string) => {
      res.writeHead(500);
      res.end(`${cfg.serverErrorMessage ?? "Internal server error"}: ${message}`);
    };
    try {
      if (resource.includes("..") || (!resource.endsWith(".gmi") && !resource.endsWith(".png"))) {
        const message = applyTemplateSubstitution(`403: ${cfg.forbiddenPageMessage ?? "Forbidden"}`, {
          "@@PAGE-URI@@": resource
        });
        if (message.error) {
          res.writeHead(500);
          res.end(`${cfg.serverErrorMessage ?? "500 Internal server error"}: ${message.reason}`);
        } else {
          res.writeHead(403);
          res.end(message.text);
        }
      } else {
        const substitutionResult = await loadGmi(
          cfg.staticFilesDirectory, resource
        ).withSubstitutionRuleFile("subrule.json");
        if (substitutionResult.error) {
          res.writeHead(500);
          res.end(
            `${cfg.serverErrorMessage ?? "500 Internal server error"}: ${substitutionResult.reason}`
          );
        } else {
          if (resource.endsWith(".gmi")) {
            const html = convertGmiToHtml(substitutionResult.text, resource, cfg);
            if (html.error) {
              res.writeHead(500);
              res.end(
                `${cfg.serverErrorMessage ?? "500 Internal server error"}: ${html.reason}`
              );
            } else {
              res.writeHead(200);
              res.end(html.htmlText);
            }
          } else if (resource.endsWith(".png")) {
            res.writeHead(200, {
              "Content-Type": "image/png"
            });
            fs.promises.readFile(`${cfg.staticFilesDirectory}${resource}`)
              .then((buffer: Buffer) => res.end(buffer));
          } else {
            res.writeHead(200, {
              "content-Type": "text/plain"
            });
            res.end(substitutionResult.text);
          }
        }
      }
    } catch (error) {
      internalServerError(res, error?.message ?? "Unknown error");
    }
    console.log(`~ Completed https request ${requestId} ~`);
  }

  const httpsServer = https.createServer(tlsDetails, handleRequest);

  return {
    https: (uri: string) => ({
      listen: (port: number) => {
        console.log(`Starting HTTPS server on https://${uri}:${port}`)
        return httpsServer.listen(port, "0.0.0.0");
      }
    })
  };
}

function convertGmiToHtml(
  gmiFileContents: string,
  requestedResource: string,
  cfg: ServerConfiguration
): HtmlText | GmiError {
  console.log(`Processing GMI file: ${requestedResource}`);
  const lines = gmiFileContents.split("\n");
  const escape = (s: string) =>
    s.replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  const escapeAngleBracketsOnly = (s: string) =>
    s.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const mirrorNoticePath = "/home/willowf/hackersphere/src/mirror-notice.html";
  const mirrorNotice = fs.readFileSync(mirrorNoticePath, "utf-8")
    .replaceAll(
      "@@REQUESTED-URL@@",
      `${cfg.baseUri}${requestedResource}`
    );
  let result = `<!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="utf-8">
  <title>${escape(`${requestedResource.startsWith("/~") ?
      requestedResource.slice(1)
      : `~${requestedResource}`
    }`)}</title>
  <style>
    body {
      font-family: sans-serif;
    }
    figure {
      border: 1px solid black;
      width: fit-content;
    }
    figcaption {
      border: 8px solid #4a4a4a;
      background-color:#4a4a4a;
      color:#eeeeee;
    }
    pre {
      border: 8px solid white;
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
  let i = 0;
  for (const line of lines) {
    if (line.startsWith("```")) {
      codeMode = !codeMode;
      if (codeMode) {
        result += "<figure>\n"
          + `<figcaption>${line.slice(3)}</figcaption>\n`
          + "<pre>\n";
        continue;
      } else {
        result += "</pre>\n</figure>\n";
        continue;
      }
    }
    if (codeMode) {
      result += escapeAngleBracketsOnly(line) + "\n";
      continue;
    }
    if (listMode && !line.startsWith("* ")) {
      result += "</ul>\n";
      listMode = false;
    }
    if (line.startsWith("=> ")) {
      const linkParts = line.split(' ');
      try {
        const uri = linkParts[1];
        const labelParts = linkParts.slice(2);
        const labelPartsJoined = labelParts.join(" ");
        const label = labelParts.length > 0 && /\S/.test(labelPartsJoined) ?
          labelPartsJoined : uri;
        result += `<a href="${uri}">${escape(label)}</a><br>\n`;
      } catch {
        return {
          error: 1,
          reason: "malformed GMI text",
          requestedResource
        };
      }
    } else if (line.startsWith("* ")) {
      if (!listMode) {
        result += "<ul>\n";
        listMode = true;
      }
      result += `<li>${escape(line).slice(2)}</li>\n`;
    } else if (line.startsWith("#")) {
      const countOctothorpes = (str: string): number =>
        (str.match(/^#+/) || [''])[0].length;
      const level = countOctothorpes(line);
      let prettifiedLine = `${line}`;
      while (prettifiedLine.startsWith("#") || prettifiedLine.startsWith(" ")) {
        prettifiedLine = prettifiedLine.slice(1);
      }
      result += `<h${level} id="section-${i}">${
        escape(prettifiedLine)
      } <a href="#section-${i}">#</a></h${level}>\n`;
      i++;
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
      requestedResource
    };
  } else {
    result += "</body>\n</html>\n";
    return {
      error: 0,
      htmlText: result,
      requestedResource
    };
  }
}
