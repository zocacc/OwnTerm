import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import App from "./App";
import type { Backend } from "./services/backend";

it("shows information returned by the backend boundary", async () => {
  const backend: Backend = {
    appInfo: vi
      .fn()
      .mockResolvedValue({ name: "OwnTerm", version: "0.1.0-test" }),
  };

  render(<App backend={backend} />);

  expect(await screen.findByText("OwnTerm 0.1.0-test")).toBeInTheDocument();
});
