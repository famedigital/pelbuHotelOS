"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-xl font-semibold">Pelbu — unexpected error</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            The app hit an error. Staff can open the desk calendar from a fresh
            tab while this recovers.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <a
            href="/erp/calendar"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Open desk calendar
          </a>
        </div>
      </body>
    </html>
  );
}
