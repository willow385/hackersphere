import fs from "fs/promises";

export interface ServerConfiguration {
  /** Path to directory where global static files are kept. */
  staticFilesDirectory: string,
  /** Path to directory where *.pem files for TLS certificate chain and private key are stored. */
  tlsCertDirectory: string,
  /** The name of the *.pem file containing the server's SSL certificate chain. */
  certFile: string,
  /** The name of the *.pem file containing the server's SSL private key. */
  keyFile: string,
  /** The URI of the server. */
  baseUri: string,
  /** Defaults to 443 but can be overridden in the config file. */
  httpsPort?: number,
  /** Defaults to 1965 but can be overridden in the config file. */
  geminiPort?: number

  forbiddenPageMessage?: string,
  serverErrorMessage?: string
};

export async function loadServerConfiguration(filePath: string): Promise<ServerConfiguration> {
  try {
    const fileContents = await fs.readFile(filePath, "utf-8");
    return JSON.parse(fileContents) as ServerConfiguration;
  } catch {
    throw new Error(`Failed to read configuration file ${filePath}`);
  }
}
