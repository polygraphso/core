import { describe, it, expect } from "vitest";
import { runnerKindFor, buildGradeRequest, buildStatusRequest } from "./hostedRunner";

const cfg = { url: "https://hosted.example.com", token: "secret-tok" };

describe("runnerKindFor", () => {
  it("maps registry_ref → server and skill → skill", () => {
    expect(runnerKindFor("registry_ref")).toBe("server");
    expect(runnerKindFor("skill")).toBe("skill");
  });
});

describe("buildGradeRequest", () => {
  it("POSTs target+kind to /grade with a bearer token and a json body", () => {
    const { url, init } = buildGradeRequest(cfg, { target: "npm/x", kind: "server", label: "x" });
    expect(url).toBe("https://hosted.example.com/grade");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer secret-tok");
    expect(init.headers["content-type"]).toContain("application/json");
    expect(JSON.parse(init.body!)).toEqual({ target: "npm/x", kind: "server", label: "x" });
  });

  it("trims a trailing slash on the runner url so the path isn't doubled", () => {
    const { url } = buildGradeRequest({ url: "https://h/", token: "t" }, { target: "a", kind: "skill" });
    expect(url).toBe("https://h/grade");
  });

  it("omits label from the body when not provided", () => {
    const { init } = buildGradeRequest(cfg, { target: "a", kind: "skill" });
    expect(JSON.parse(init.body!)).toEqual({ target: "a", kind: "skill" });
  });
});

describe("buildStatusRequest", () => {
  it("GETs /grade/:id with the bearer token", () => {
    const { url, init } = buildStatusRequest(cfg, "job-123");
    expect(url).toBe("https://hosted.example.com/grade/job-123");
    expect(init.method).toBe("GET");
    expect(init.headers.authorization).toBe("Bearer secret-tok");
  });

  it("url-encodes the job id", () => {
    const { url } = buildStatusRequest(cfg, "a/b");
    expect(url).toBe("https://hosted.example.com/grade/a%2Fb");
  });
});
