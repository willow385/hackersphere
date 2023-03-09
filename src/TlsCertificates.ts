import fs from "fs/promises";

export default interface TlsCertKeyPair {
  key: string,
  cert: string
};

export async function loadTlsDetails(
  /** Path to the directory where certFile and keyFile are kept. */
  dirPath: string,
  /** The name of the *.pem file containing the server's SSL certificate chain. */
  certFile: string,
  /** The name of the *.pem file containing the server's SSL private key. */
  keyFile: string
): Promise<TlsCertKeyPair> {
  const cert = await fs.readFile(`${dirPath}/${certFile}`, "utf-8");
  const key = await fs.readFile(`${dirPath}/${keyFile}`, "utf-8");
  return { cert, key };
}
