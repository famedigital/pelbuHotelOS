import { deskLogout } from "@/app/actions/desk";

export function DeskHeader({ title }: { title: string }) {
  return (
    <header className="border-b border-espresso/10 bg-espresso text-ivory">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-6 py-4 md:px-8">
        <div>
          <p className="text-xs tracking-[0.25em] text-gold uppercase">Pelbu desk</p>
          <h1 className="text-lg text-white">{title}</h1>
        </div>
        <form action={deskLogout}>
          <button
            type="submit"
            className="inline-flex min-h-10 items-center rounded-sm border border-white/25 px-4 text-sm text-white"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
