import gemini, {
  Request,
  Response,
  NextFunction
} from "gemini-server";
import { ServerConfiguration } from "./ServerCfg";
import { loadGmi, TemplateProcessingResult } from "./TemplateProcessor";
import { loadTlsDetails } from "./TlsCertificates";


export default async function createGeminiServer(
  cfg: ServerConfiguration,
  /**
   * This should return a string that uniquely identifies each request, for logging.
   * Successive calls should always return unique values.
   */
  generateRequestId: () => string
) {
  const tlsDetails = await loadTlsDetails(cfg.tlsCertDirectory, cfg.certFile, cfg.keyFile);
  const geminiServer = gemini(tlsDetails);

  /** requestId is updated once per request. Before any requests have been processed, it is "default". */
  let requestId = "default";
  const log = (message: string) => console.log(`request ${requestId}: ${message}`);
  const internalServerError = (res: Response, message: string) => {
    res.status(50);
    res.data(`${cfg.serverErrorMessage ?? "Internal server error"}: ${message}`);
  };

  geminiServer.use((_req: Request, _res: Response, next: NextFunction) => {
    requestId = generateRequestId();
    console.log(`~ Handling gemini request ${requestId} ~`);
    next();
  });

  geminiServer.on("*", async (req: Request, res: Response) => {
    log(`Requested resource: ${req.path}`);
    if (["", "/", null].includes(req.path)) {
      log("Empty path requested, serving index file.")
      res.file(`${cfg.staticFilesDirectory}/index.gmi`);
    } else {
      log(`Serving file: ${req.path}`);
      try {
        const subResult = await loadGmi(
          cfg.staticFilesDirectory, req.path!
        ).withSubstitutionRuleFile("subrule.json");
        if (subResult.error) {
          internalServerError(res, subResult.reason);
        } else {
          const mimeType = req.path?.endsWith(".gmi") ? "text/gemini" : "text/plain";
          res.data(subResult.text, mimeType);
          log(`File ${req.path} successfully served`);
        }
      } catch (error) {
        internalServerError(res, error?.message ?? "Unknown error");
      }
    }
    console.log(`~ Completed gemini request ${requestId} ~`);
  });

  return {
    gemini: () => {
      console.log(`Starting Gemini server on gemini://${cfg.baseUri}/`);
      return geminiServer;
    }
  }
}
