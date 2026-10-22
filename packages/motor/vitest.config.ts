import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "motor", environment: "node" },
});
