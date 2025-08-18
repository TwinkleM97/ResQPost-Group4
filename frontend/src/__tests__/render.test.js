import React from "react";
import { render } from "@testing-library/react";

test("render: basic div", () => {
  const { container } = render(<div data-testid="ok" />);
  expect(container.querySelector("[data-testid='ok']")).toBeTruthy();
});
