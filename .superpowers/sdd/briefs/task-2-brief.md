### Task 2: Button variant attribute for Neo-Glass opt-out

**Files:**
- Modify: `web/src/components/ui/button.tsx`
- Consumes: Task 1 CSS selectors that use `[data-variant=…]`
- Produces: `data-variant` on every Button for CSS filtering of ghost/link

**Interfaces:**
- Consumes: `buttonVariants` / `VariantProps`
- Produces: `data-variant={variant ?? "default"}` on the rendered element

- [ ] **Step 1: Set `data-variant` on Button**

In `web/src/components/ui/button.tsx`, update the render to:

```tsx
  return (
    <Comp
      data-slot="button"
      data-variant={variant ?? "default"}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
```

- [ ] **Step 2: Sanity check**

Confirm ghost buttons in Day toolbar stay flat (no extruded shadow). Primary "Check in all" / StayHub "Settle & Check-out" show raised shadow and sink on click.

- [ ] **Step 3: Commit only if user asked**

Do not commit unless the user explicitly requests a commit.
