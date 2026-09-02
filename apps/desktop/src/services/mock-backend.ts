import type { Backend } from "./backend";

export const mockBackend: Backend = {
  appInfo: async () => ({ name: "OwnTerm", version: "0.1.0" }),
};
