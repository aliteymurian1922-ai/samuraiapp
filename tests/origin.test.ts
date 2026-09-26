import { describe, expect, it } from "vitest";
import { isTrustedRequestOrigin } from "@/lib/security/origin";

describe("isTrustedRequestOrigin", () => {
  it("accepts the same host", () => {
    expect(isTrustedRequestOrigin("https://samurai.example.com", "samurai.example.com")).toBe(true);
  });

  it("preserves port matching for local development", () => {
    expect(isTrustedRequestOrigin("http://localhost:3000", "localhost:3000")).toBe(true);
    expect(isTrustedRequestOrigin("http://localhost:3001", "localhost:3000")).toBe(false);
  });

  it("rejects a different origin", () => {
    expect(isTrustedRequestOrigin("https://evil.example", "samurai.example.com")).toBe(false);
  });

  it("rejects missing or malformed origin data", () => {
    expect(isTrustedRequestOrigin(null, "samurai.example.com")).toBe(false);
    expect(isTrustedRequestOrigin("not-a-url", "samurai.example.com")).toBe(false);
  });
});
