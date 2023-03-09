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
    if (resource.includes("..") || !resource.endsWith(".gmi")) {
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
      }
    }
    console.log(`~ Completed gemini request ${requestId} ~`);
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
      .replaceAll(">", "&gt;")
      .replaceAll("* ", "")
      .replaceAll("#", "");
  const mirrorNoticePath = "/home/willowf/hackersphere/src/mirror-notice.html";
  const mirrorNotice = fs.readFileSync(mirrorNoticePath, "utf-8")
    .replaceAll(
      "@@REQUESTED_URL@@",
      `${cfg.baseUri}${requestedResource}`
    );
  let result = `<!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="utf-8">
  <title>${escape(`${
    requestedResource.startsWith("/~") ?
      requestedResource.slice(1)
      : `~${requestedResource}`
  }`)}</title>
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
      const linkParts = line.split(' ');
      try {
        const uri = linkParts[1];
        const labelParts = linkParts.slice(2);
        const label = labelParts.length > 0 ? labelParts.join(" ") : uri;
        console.log("Rewriting link as HTML anchor tag: " + uri);
        console.log("with label: " + label);
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
