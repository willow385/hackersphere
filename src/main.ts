import geminiHttpMirror from "./HttpMirror";
import createGeminiServer from "./GeminiServer";
import { GlobalConstants } from "./GlobalConstants";
import { loadTlsDetails } from "./TlsCertificates";

function main() {
  const tlsDetails = loadTlsDetails(GlobalConstants.TlsCertDirectory, "fullchain.pem", "privkey.pem");
  const gmi = createGeminiServer(tlsDetails);
  const mirror = geminiHttpMirror(tlsDetails);
  gmi.gemini().listen(1965);
  mirror.http(GlobalConstants.BaseUri).listen(443);
}

main();
