# Testing: Components & Integration

## Component Testing with Testing Library

```ts
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import { describe, it, expect, vi } from "vitest";
import ServiceTypeForm from "../components/ServiceTypeForm.svelte";

describe("ServiceTypeForm", () => {
  const mockOnSubmit = vi.fn();

  it("renders fields", () => {
    render(ServiceTypeForm, { props: { onSubmit: mockOnSubmit, loading: false } });
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create/i })).toBeInTheDocument();
  });

  it("validates required fields", async () => {
    render(ServiceTypeForm, { props: { onSubmit: mockOnSubmit, loading: false } });
    await fireEvent.click(screen.getByRole("button", { name: /create/i }));
    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("submits valid data", async () => {
    render(ServiceTypeForm, { props: { onSubmit: mockOnSubmit, loading: false } });
    await fireEvent.input(screen.getByLabelText(/name/i), { target: { value: "Test Service" } });
    await fireEvent.input(screen.getByLabelText(/description/i), { target: { value: "Test description" } });
    await fireEvent.input(screen.getByLabelText(/tags/i), { target: { value: "test, service" } });
    await fireEvent.click(screen.getByRole("button", { name: /create/i }));
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: "Test Service",
        description: "Test description",
        tags: ["test", "service"],
      });
    });
  });
});
```

## Integration Testing

```ts
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import { describe, it, expect } from "vitest";
import ServiceTypesPage from "../routes/service-types/+page.svelte";

describe("ServiceTypes Integration", () => {
  it("handles creation workflow", async () => {
    render(ServiceTypesPage);
    expect(screen.getByText(/no service types found/i)).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: /create service type/i }));
    await fireEvent.input(screen.getByLabelText(/name/i), { target: { value: "Web Development" } });
    await fireEvent.click(screen.getByRole("button", { name: /create/i }));
    await waitFor(() => {
      expect(screen.getByText("Web Development")).toBeInTheDocument();
    });
  });

  it("handles error states", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));
    render(ServiceTypesPage);
    await fireEvent.click(screen.getByRole("button", { name: /create service type/i }));
    await fireEvent.input(screen.getByLabelText(/name/i), { target: { value: "Test Service" } });
    await fireEvent.click(screen.getByRole("button", { name: /create/i }));
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  });
});
```
