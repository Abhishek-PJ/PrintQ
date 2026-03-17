export interface PrintRule {
  fromPage: number;
  toPage: number;
  colorMode: "bw" | "color";
  sided: "single" | "double";
}

export interface PrintOptions {
  printRules: PrintRule[];
  copies: number;
  paperSize: "A4" | "A3";
  binding: "none" | "spiral" | "staple";
}

/** Payload sent by the server when a print job is dispatched */
export interface PrintJob {
  orderId: string;
  fileUrl: string;
  fileName: string;
  printOptions: PrintOptions;
  token: string;
}

/** Progress event sent from agent → server → admin */
export type PrintStep =
  | "queued"
  | "downloading"
  | "converting"
  | "splitting"
  | "printing"
  | "done"
  | "error";

export interface PrintProgress {
  orderId: string;
  step: PrintStep;
  /** 1-based rule index when step === "printing" */
  current?: number;
  /** total rule count */
  total?: number;
  message?: string;
}

export interface PrinterCapabilities {
  name: string;
  /** Whether the printer supports color printing */
  color: boolean;
  /** Whether the printer supports duplex (double-sided) */
  duplex: boolean;
  /** Reported paper sizes (e.g. ["A4", "A3"]) */
  paperSizes: string[];
}
