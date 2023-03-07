import gemini, {
  Request,
  Response,
  NextFunction
} from "gemini-server";
import fs from "fs";

function main() {
  const cert = fs.readFileSync("cert.pem");
  const key = fs.readFileSync("key.pem");
  const app = gemini({ cert, key });
  app.use((
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    console.log(`Handling request ${req.path}`);
    next();
  });

  app.on("/", (_req: Request, res: Response) => {
    console.log("Index page requested");
    res.file("index.gmi");
  });

  return app;
}

main().listen(() => console.log("~> Listening <~"));
