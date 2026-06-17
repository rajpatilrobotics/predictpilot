interface RouteLoadingStateProps {
  title?: string;
}

interface RouteErrorStateProps {
  message: string;
  onNavigate?: () => void;
  title: string;
}

export function RouteLoadingState({ title = 'Loading route' }: RouteLoadingStateProps) {
  return (
    <section
      aria-label="Route loading state"
      className="border border-[#d9dfdc] bg-[#f8fbfa] p-6 text-sm text-[#445750]"
      role="status"
    >
      <p className="font-semibold text-[#17211d]">{title}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <span className="h-14 bg-[#e8eeee]" />
        <span className="h-14 bg-[#e8eeee]" />
        <span className="h-14 bg-[#e8eeee]" />
      </div>
    </section>
  );
}

export function RouteErrorState({ message, onNavigate, title }: RouteErrorStateProps) {
  return (
    <section
      aria-label="Route error state"
      className="border border-[#d6a38f] bg-[#fff8f4] p-6 text-sm text-[#563023]"
      role="alert"
    >
      <h2 className="text-xl font-semibold text-[#3c1f16]">{title}</h2>
      <p className="mt-2 max-w-2xl leading-6">{message}</p>
      {onNavigate === undefined ? null : (
        <button
          className="mt-4 border border-[#bd6f53] bg-white px-3 py-2 text-sm font-semibold text-[#563023]"
          onClick={onNavigate}
          type="button"
        >
          Back to dashboard
        </button>
      )}
    </section>
  );
}
