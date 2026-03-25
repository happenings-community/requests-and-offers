# Component & Integration Test Patterns

Uses `@testing-library/svelte` (installed) + Vitest. Tests live in `ui/tests/unit/`.

## Component Test Pattern

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import { describe, it, expect, vi } from "vitest";
import ServiceTypeForm from "$lib/components/ServiceTypeForm.svelte";

describe("ServiceTypeForm", () => {
  const mockOnSubmit = vi.fn();

  it("renders all fields", () => {
    render(ServiceTypeForm, { props: { onSubmit: mockOnSubmit, loading: false } });
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create/i })).toBeInTheDocument();
  });

  it("validates required fields on submit", async () => {
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
    await fireEvent.click(screen.getByRole("button", { name: /create/i }));
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: "Test Service",
        description: "Test description",
      });
    });
  });
});
```

## Integration Test Pattern (page-level)

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import { describe, it, expect, vi } from "vitest";
import ServiceTypesPage from "$routes/service-types/+page.svelte";

describe("ServiceTypes page", () => {
  it("handles creation workflow end-to-end", async () => {
    render(ServiceTypesPage);
    expect(screen.getByText(/no service types found/i)).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: /create service type/i }));
    await fireEvent.input(screen.getByLabelText(/name/i), { target: { value: "Web Development" } });
    await fireEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByText("Web Development")).toBeInTheDocument();
    });
  });

  it("shows error on network failure", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));
    render(ServiceTypesPage);
    await fireEvent.click(screen.getByRole("button", { name: /create service type/i }));
    await fireEvent.input(screen.getByLabelText(/name/i), { target: { value: "Test Service" } });
    await fireEvent.click(screen.getByRole("button", { name: /create/i }));
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
});
```

## Key Rules

- Mock store dependencies with `vi.mock()` BEFORE importing the component
- Use `waitFor()` for async state changes after user interactions
- Prefer `getByRole` and `getByLabelText` over `getByTestId` for accessibility-aligned queries
- `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toBeVisible`) are globally available
