import { execFile, spawnSync } from "child_process";
import os from "os";
import { PrinterCapabilities } from "../types";

export interface PrintOptions {
  printer?: string;
  colorMode: "bw" | "color";
  sided: "single" | "double";
  copies: number;
  paperSize: "A4" | "A3";
}

// ─── Windows (SumatraPDF) ─────────────────────────────────────────────────────

const sumatraPrintSettings = (opts: PrintOptions): string => {
  const parts: string[] = [];
  parts.push(opts.colorMode === "bw" ? "monochrome" : "color");
  parts.push(opts.sided === "double" ? "duplexlong" : "simplex");
  parts.push(`${opts.copies}x`);
  parts.push(`paper=${opts.paperSize}`);
  return parts.join(",");
};

const printWindows = (filePath: string, opts: PrintOptions): Promise<void> => {
  return new Promise((resolve, reject) => {
    const sumatraExe =
      process.env.SUMATRA_PATH ||
      "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe";

    // execFile passes each arg directly to CreateProcess — spaces in
    // printer names and file paths are handled correctly with no extra quoting.
    const args: string[] = opts.printer
      ? [
          "-print-to",
          opts.printer,
          "-print-settings",
          sumatraPrintSettings(opts),
          "-silent",
          filePath,
        ]
      : [
          "-print-to-default",
          "-print-settings",
          sumatraPrintSettings(opts),
          "-silent",
          filePath,
        ];

    execFile(sumatraExe, args, { timeout: 120_000 }, (err, _stdout, stderr) => {
      if (err) {
        const cmd = `${sumatraExe} ${args.join(" ")}`;
        reject(new Error(`SumatraPDF print failed: ${stderr || err.message} (cmd: ${cmd})`));
      } else {
        resolve();
      }
    });
  });
};

// ─── Linux / macOS (lp) ───────────────────────────────────────────────────────

const printUnix = (filePath: string, opts: PrintOptions): Promise<void> => {
  return new Promise((resolve, reject) => {
    const args: string[] = [];
    if (opts.printer) args.push("-d", opts.printer);
    args.push("-n", String(opts.copies));
    args.push("-o", opts.sided === "double" ? "sides=two-sided-long-edge" : "sides=one-sided");
    args.push("-o", opts.colorMode === "bw" ? "ColorModel=Gray" : "ColorModel=RGB");
    args.push("-o", `media=${opts.paperSize}`);
    args.push(filePath);

    execFile("lp", args, { timeout: 120_000 }, (err, _stdout, stderr) => {
      if (err) {
        reject(new Error(`lp print failed: ${stderr || err.message}`));
      } else {
        resolve();
      }
    });
  });
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const printFile = (filePath: string, opts: PrintOptions): Promise<void> =>
  os.platform() === "win32" ? printWindows(filePath, opts) : printUnix(filePath, opts);

/** Lists printer names available on the system */
export const listPrinters = (): string[] => {
  try {
    if (os.platform() === "win32") {
      const result = spawnSync("wmic", ["printer", "get", "name"], {
        encoding: "utf8",
        timeout: 5_000,
      });
      if (result.status !== 0) return [];
      return result.stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && l !== "Name");
    } else {
      const result = spawnSync("lpstat", ["-a"], { encoding: "utf8", timeout: 5_000 });
      if (result.status !== 0) return [];
      return result.stdout
        .split(/\r?\n/)
        .map((l) => l.split(" ")[0].trim())
        .filter(Boolean);
    }
  } catch {
    return [];
  }
};

/**
 * Detects color and duplex capabilities for all installed printers.
 *
 * Windows: queries WMI Win32_Printer via PowerShell.
 * Linux/macOS: uses `lpoptions -p <name> -l` per printer.
 *
 * Returns a map of printerName → PrinterCapabilities.
 * Capability detection is best-effort; failures return an empty map.
 */
export const detectAllPrinterCapabilities = (): Record<string, PrinterCapabilities> => {
  const caps: Record<string, PrinterCapabilities> = {};
  try {
    if (os.platform() === "win32") {
      // PowerShell WMI query — works on Windows 7/8/10/11
      const ps = spawnSync(
        "powershell",
        [
          "-NoProfile", "-NonInteractive", "-Command",
          "Get-WmiObject Win32_Printer | Select-Object Name,ColorSupported,Duplex | ConvertTo-Json -Compress -Depth 2",
        ],
        { encoding: "utf8", timeout: 8_000 }
      );
      if (ps.status === 0 && ps.stdout.trim()) {
        let parsed: unknown;
        try { parsed = JSON.parse(ps.stdout.trim()); } catch { parsed = null; }
        if (parsed) {
          const items = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of items as Array<{ Name?: string; ColorSupported?: boolean; Duplex?: boolean }>) {
            const name = item.Name?.trim();
            if (!name) continue;
            caps[name] = {
              name,
              color:      item.ColorSupported === true,
              duplex:     item.Duplex === true,
              paperSizes: ["A4"],
            };
          }
        }
      }
    } else {
      // Linux / macOS — query per-printer options
      for (const printer of listPrinters()) {
        const result = spawnSync("lpoptions", ["-p", printer, "-l"], {
          encoding: "utf8",
          timeout: 3_000,
        });
        const out = result.stdout || "";
        caps[printer] = {
          name:       printer,
          color:      /ColorModel.*RGB|color/i.test(out),
          duplex:     /Duplex/i.test(out),
          paperSizes: ["A4"],
        };
      }
    }
  } catch {
    // Non-critical — caller falls back to conservative defaults
  }
  return caps;
};

