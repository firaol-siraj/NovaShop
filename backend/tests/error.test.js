import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import errorMiddleware from "../src/middlewares/errorMiddleware.js";

describe("Error Middleware Unit Tests", () => {
  let req;
  let res;
  let next;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  /* ==========================================================================
     1. Development Mode Tests
     ========================================================================== */
  describe("Development Environment (NODE_ENV = development)", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("should return full error details including stack trace and custom status code", () => {
      const err = new Error("Database validation failed");
      err.statusCode = 400;
      err.status = "fail";

      errorMiddleware(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: "fail",
        error: err,
        message: "Database validation failed",
        stack: err.stack,
      });
    });

    it("should default statusCode to 500 and status to 'error' if not provided", () => {
      const err = new Error("Unexpected dev error");

      errorMiddleware(err, req, res, next);

      expect(err.statusCode).toBe(500);
      expect(err.status).toBe("error");
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "error",
          message: "Unexpected dev error",
        })
      );
    });
  });

  /* ==========================================================================
     2. Production Mode Tests
     ========================================================================== */
  describe("Production Environment (NODE_ENV = production)", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("should return clean error response without stack trace for operational errors", () => {
      const err = new Error("Resource not found");
      err.statusCode = 404;
      err.status = "fail";
      err.isOperational = true;

      errorMiddleware(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: "fail",
        message: "Resource not found",
      });
      // Verify sensitive details are not exposed
      expect(res.json.mock.calls[0][0].stack).toBeUndefined();
    });

    it("should log error to console and return generic 500 message for non-operational errors", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const err = new Error("Internal third-party service crash");
      err.isOperational = false; // standard uncaught JS error

      errorMiddleware(err, req, res, next);

      expect(consoleSpy).toHaveBeenCalledWith("UNHANDLED ERROR 💥:", err);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: "error",
        message: "Something went wrong on the server",
      });
    });
  });
});