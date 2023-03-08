import gemini, {
  Request,
  Response,
  NextFunction
} from "gemini-server";
import fs from "fs";
import { GlobalConstants } from "./GlobalConstants";
import TlsCertKeyPair from "./TlsCertificates";

export default function createGeminiServer(
  tlsDetails: TlsCertKeyPair,
  geminiStaticDir=GlobalConstants.StaticDirectory
) {
  const geminiServer = gemini(tlsDetails);
  geminiServer.use((
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    console.log(":: Handling Gemini request ::");
    next();
  });

  geminiServer.on("*", (req: Request, res: Response, next: NextFunction) => {
    console.log(`Request: ${req.path ?? "/"}`);
    if (req.path?.includes("..")) {
      res.error(50, "please don't include ../ in a requested URL");
    } else if (req.path?.endsWith(".gmi")) {
      const data = fs.readFileSync(`${geminiStaticDir}${req.path}`, "utf-8");
      res.data(data, "text/gemini");
    } else if (req.path === "/") {
      const data = fs.readFileSync(`${geminiStaticDir}/index.gmi`);
      res.data(data, "text/gemini");
    } else {
      res.error(40, "Please only request *gmi files!");
    }
    console.log(`:: Gemini request completed at ${new Date()} ::`);
    next();
  });

  return {
    gemini: () => {
      console.log(`Starting Gemini server on gemini://${GlobalConstants.BaseUri}/`);
      return geminiServer;
    }
  }
}
