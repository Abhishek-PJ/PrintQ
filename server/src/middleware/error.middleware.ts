import { NextFunction, Request, Response } from "express";

export const notFound = (_req: Request, res: Response): void => {
  res.status(404).json({ message: "Route not found" });
};

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  res.status(500).json({ message: err.message || "Internal server error" });
};
