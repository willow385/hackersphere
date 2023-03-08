import fs from "fs";

export default interface TlsCertKeyPair {
  key: string,
  cert: string
};

export function loadTlsDetails(path: string, certFile: string, keyFile: string): TlsCertKeyPair {
  const cert = fs.readFileSync(`${path}/${certFile}`, "utf-8");
  const key = fs.readFileSync(`${path}/${keyFile}`, "utf-8");
  return { cert, key };
}
