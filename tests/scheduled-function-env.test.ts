import { describe, expect, it } from "vitest";
import {
  applyBakedEnvironment,
  renderScheduledFunctionEnvModule,
} from "../scheduled-function-env";

describe("renderScheduledFunctionEnvModule", () => {
  it("writes only the scheduled function values", () => {
    const source = renderScheduledFunctionEnvModule({
      DATABASE_URL: "postgres://baked/db",
      TOKEN_ENCRYPTION_KEY: "baked-key",
      STRIPE_SECRET_KEY: "must-not-appear",
    });

    expect(source).toContain('"DATABASE_URL": "postgres://baked/db"');
    expect(source).toContain('"TOKEN_ENCRYPTION_KEY": "baked-key"');
    expect(source).not.toContain("must-not-appear");
  });
});

describe("applyBakedEnvironment", () => {
  const baked = {
    DATABASE_URL: "postgres://baked/db",
    TOKEN_ENCRYPTION_KEY: "baked-key",
  };

  it("fills values missing from the runtime environment", () => {
    const environment = {};

    applyBakedEnvironment(baked, environment);

    expect(environment).toEqual(baked);
  });

  it("leaves a value unset when nothing was baked, so callers can fail loud", () => {
    const environment = {};

    applyBakedEnvironment({ DATABASE_URL: "" }, environment);

    expect(environment).toEqual({});
  });

  it("lets a runtime value win over the baked one", () => {
    const environment = { DATABASE_URL: "postgres://runtime/db" };

    applyBakedEnvironment(baked, environment);

    expect(environment).toEqual({
      DATABASE_URL: "postgres://runtime/db",
      TOKEN_ENCRYPTION_KEY: "baked-key",
    });
  });
});
