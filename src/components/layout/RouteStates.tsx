import { StatePanel, StateSkeletonGrid } from '@/components/states/StatePrimitives';

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
    <StatePanel
      description="Preparing the terminal route surface."
      label="Route loading state"
      title={title}
      tone="loading"
    >
      <StateSkeletonGrid label="Route skeleton loading" />
    </StatePanel>
  );
}

export function RouteErrorState({ message, onNavigate, title }: RouteErrorStateProps) {
  return (
    <StatePanel
      action={
        onNavigate === undefined ? undefined : (
          <button
            className="border border-[#bd6f53] bg-white px-3 py-2 text-sm font-semibold text-[#563023]"
            onClick={onNavigate}
            type="button"
          >
            Back to dashboard
          </button>
        )
      }
      description={message}
      label="Route error state"
      title={title}
      tone="error"
    />
  );
}
