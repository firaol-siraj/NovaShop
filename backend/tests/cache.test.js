import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import redis from "../src/config/redis.js";
import { cacheMiddleware } from "../src/middlewares/cacheMiddleware.js";

describe("Cache Middleware Unit Tests", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();

    // Attach spies directly to the imported redis client methods
    jest.spyOn(redis, "get").mockImplementation(() => Promise.resolve(null));
    jest.spyOn(redis, "setex").mockImplementation(() => Promise.resolve("OK"));

    req = {
      originalUrl: "/api/v1/products",
      url: "/api/v1/products",
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      statusCode: 200,
    };

    next = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /* ==========================================================================
     1. Cache Hit Scenario
     ========================================================================== */
  it("should return cached data with HTTP 200 on cache hit and avoid calling next()", async () => {
    const cachedPayload = { success: true, data: [{ id: 1, name: "Product A" }] };
    jest.spyOn(redis, "get").mockResolvedValueOnce(JSON.stringify(cachedPayload));

    const middleware = cacheMiddleware("products", 300);
    await middleware(req, res, next);

    expect(redis.get).toHaveBeenCalledWith("products:/api/v1/products");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(cachedPayload);
    expect(next).not.toHaveBeenCalled();
  });

  /* ==========================================================================
     2. Cache Miss + 2xx Response Scenario
     ========================================================================== */
  it("should cache response payload in Redis when request is a cache miss and status is 2xx", async () => {
    jest.spyOn(redis, "get").mockResolvedValueOnce(null);

    const middleware = cacheMiddleware("products", 600);
    await middleware(req, res, next);

    expect(redis.get).toHaveBeenCalledWith("products:/api/v1/products");
    expect(next).toHaveBeenCalled();

    const mockResponseBody = { success: true, data: "New Fresh Data" };
    res.json(mockResponseBody);

    expect(redis.setex).toHaveBeenCalledWith(
      "products:/api/v1/products",
      600,
      JSON.stringify(mockResponseBody)
    );
  });

  /* ==========================================================================
     3. Cache Miss + Non-2xx Response Scenario
     ========================================================================== */
  it("should NOT cache response in Redis if response status is non-2xx (e.g. 400)", async () => {
    jest.spyOn(redis, "get").mockResolvedValueOnce(null);
    res.statusCode = 400;

    const middleware = cacheMiddleware("products");
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();

    const errorBody = { success: false, message: "Bad Request" };
    res.json(errorBody);

    expect(redis.setex).not.toHaveBeenCalled();
  });

  /* ==========================================================================
     4. Fallback Key Resolution Scenario
     ========================================================================== */
  it("should fallback to req.url if req.originalUrl is undefined", async () => {
    delete req.originalUrl;
    req.url = "/api/v1/fallback-route";
    jest.spyOn(redis, "get").mockResolvedValueOnce(null);

    const middleware = cacheMiddleware("categories");
    await middleware(req, res, next);

    expect(redis.get).toHaveBeenCalledWith("categories:/api/v1/fallback-route");
  });

  /* ==========================================================================
     5. Redis Failure Exception Scenario
     ========================================================================== */
  it("should log error and proceed to next() if Redis encounters an error", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(redis, "get").mockRejectedValueOnce(new Error("Redis connection dropped"));

    const middleware = cacheMiddleware("products");
    await middleware(req, res, next);

    expect(consoleSpy).toHaveBeenCalledWith("Redis Cache Error:", expect.any(Error));
    expect(next).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});