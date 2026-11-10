# Task 2 review package
Commits: none
diff --git a/web/src/components/ui/button.tsx b/web/src/components/ui/button.tsx
index 09351f3..b6a40f2 100644
--- a/web/src/components/ui/button.tsx
+++ b/web/src/components/ui/button.tsx
@@ -48,17 +48,18 @@ function Button({
   ...props
 }: React.ComponentProps<"button"> &
   VariantProps<typeof buttonVariants> & {
     asChild?: boolean;
   }) {
   const Comp = asChild ? Slot : "button";
 
   return (
     <Comp
       data-slot="button"
+      data-variant={variant ?? "default"}
       className={cn(buttonVariants({ variant, size, className }))}
       {...props}
     />
   );
 }
 
 export { Button, buttonVariants };
