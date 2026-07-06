export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-ff-dark-blue via-[#3a63ab] to-ff-light-blue px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-2xl backdrop-blur">
            🐾
          </div>
          <h1 className="text-2xl font-bold text-white">FurFinds HQ</h1>
          <p className="mt-1 text-sm text-ff-pale-blue">Making pet-friendly mean something.</p>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-ff-pale-blue">{footer}</div>}
      </div>
    </div>
  );
}
