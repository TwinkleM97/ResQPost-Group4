import React from "react";
import { render, screen } from "@testing-library/react";

test("render: basic div", () => {
  render(<div data-testid="ok" />);
  expect(screen.getByTestId("ok")).toBeTruthy();
});
