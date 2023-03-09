import gemini, {
  Request,
  Response,
  NextFunction
} from "gemini-server";
import { ServerConfiguration } from "./ServerCfg";
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

  geminiServer.use((_req: Request, _res: Response, next: NextFunction) => {
    requestId = generateRequestId();
    console.log(`~ Handling gemini request ${requestId} ~`);
    next();
    console.log(`~ Completed gemini request ${requestId} ~`);
  });

  geminiServer.use("/", (req: Request, res: Response, next: NextFunction) => {
    log(`Requested resource: ${req.path}`);
    if (["", "/", null].includes(req.path)) {
      log("Empty path requested, serving index file.")
      res.file(`${cfg.staticFilesDirectory}/index.gmi`);
    }
    next();
  });

  geminiServer.on("/", gemini.serveStatic(cfg.staticFilesDirectory));

  return {
    gemini: () => {
      console.log(`Starting Gemini server on gemini://${cfg.baseUri}/`);
      return geminiServer;
    }
  }
}
