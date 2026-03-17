import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import { URL } from "url";

/**
 * Downloads a file from a URL to a local temp path.
 * Returns the absolute local file path.
 */
export const downloadFile = (url: string, destDir: string, fileName: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const destPath = path.join(destDir, fileName);
    const file = fs.createWriteStream(destPath);

    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === "https:" ? https : http;

    const request = client.get(url, (response) => {
      // Follow redirects (e.g. S3 presigned URLs can redirect)
      if (response.statusCode === 301 || response.statusCode === 302) {
        const location = response.headers.location;
        if (!location) {
          reject(new Error("Redirect with no Location header"));
          return;
        }
        file.close();
        fs.unlink(destPath, () => undefined);
        resolve(downloadFile(location, destDir, fileName));
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${response.statusCode ?? "unknown"}`));
        return;
      }

      response.pipe(file);
      file.on("finish", () => {
        file.close(() => resolve(destPath));
      });
    });

    request.on("error", (err) => {
      fs.unlink(destPath, () => undefined);
      reject(err);
    });

    file.on("error", (err) => {
      fs.unlink(destPath, () => undefined);
      reject(err);
    });
  });
};
