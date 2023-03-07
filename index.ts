import gemini, {
  Request,
  Response,
  NextFunction
} from "gemini-server";
import fs from "fs";
import geminiHttpMirror from "./HttpMirror";

function createGeminiServer(
  geminiStaticDir="/home/runner/hackersphere/gemini-static",
  certFile="cert.pem",
  keyFile="key.pem"
) {
  const cert = fs.readFileSync(certFile);
  const key = fs.readFileSync(keyFile);
  const geminiServer = gemini({ cert, key });
  geminiServer.use((
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    console.log(`Handling request ${req.path}`);
    next();
  });

  geminiServer.on("*", (req: Request, res: Response) => {
    console.log("Request: " + req.url);
    const path = `${geminiStaticDir}${req.url}`;
    const requestedData = fs.readFileSync(path, "utf-8");
    res.data(requestedData, "text/gemini");
  });

  return {
    gemini: () => {
      console.log("Starting Gemini server");
      return geminiServer;
    }
  }
}

function main() {
  const gmi = createGeminiServer();
  const mirror = geminiHttpMirror();
  gmi.gemini().listen(443);
  mirror.http().listen(80);
}

main();
