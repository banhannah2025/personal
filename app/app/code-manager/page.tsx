import Link from "next/link";

export default function CodeManagerRedirectPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-3xl border border-dashed border-border/70 bg-card/80 p-8 text-center shadow-lg shadow-black/5">
      <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Admin notice</p>
      <h1 className="text-3xl font-semibold tracking-tight">Code Manager moved</h1>
      <p className="text-muted-foreground">
        The repository workbench now lives inside the Admin dashboard alongside the GPT-5 knowledge
        assistant. Please use the Admin link in the navigation to access it.
      </p>
      <Link
        href="/app/admin"
        className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
      >
        Open Admin dashboard
      </Link>
    </div>
  );
}
