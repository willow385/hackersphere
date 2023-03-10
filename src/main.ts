import geminiHttpMirror from "./HttpMirror";
import createGeminiServer from "./GeminiServer";
import { loadServerConfiguration } from "./ServerCfg";

async function main() {
  const serverCfg = await loadServerConfiguration("cfg/server.json");
  let requestIndex: number = 0;
  const startupUnixTimestamp: number = Math.floor(Date.now() / 1000);
  const gmi = await createGeminiServer(serverCfg, () => {
    const result = `gemini::${startupUnixTimestamp}::${requestIndex}`;
    requestIndex++;
    return result;
  });
  const mirror = await geminiHttpMirror(serverCfg, () => {
    const result = `https::${startupUnixTimestamp}::${requestIndex}`;
    requestIndex++;
    return result;
  });
  const gemini = gmi.gemini().listen(serverCfg.geminiPort ?? 1965);
  const https = mirror.https(serverCfg.baseUri).listen(serverCfg.httpsPort ?? 443);
  ["SIGTERM", "SIGINT", "SIGQUIT"].forEach(signal => process.on(signal, () => {
    console.log(`${signal} received.`);
    gemini.close(() => {
      console.log("Gemini server closed gracefully.");
      https.close(() => {
        console.log("HTTPS server closed gracefully.");
        process.exit();
      });
    });
  }));
}

main()
  .then(() => console.log("Server started successfully."))
  .catch((error: Error) => console.error(error));

