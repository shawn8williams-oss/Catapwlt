import { ActiveView } from '../types/game';

interface TopBarProps {
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  onOpenCommandRef: () => void;
  unlockedCluesCount: number;
  solvedCount: number;
  totalCases: number;
}

export function TopBar({
  activeView,
  onNavigate,
  onOpenCommandRef,
  unlockedCluesCount,
  solvedCount,
  totalCases,
}: TopBarProps) {
  const navItems: { id: ActiveView; label: string }[] = [
    { id: 'briefing', label: 'Briefing' },
    { id: 'workspace', label: 'Workspace' },
    {
      id: 'casefile',
      label: unlockedCluesCount > 0 ? `Case File (${unlockedCluesCount})` : 'Case File',
    },
    {
      id: 'scenarios',
      label: `Scenarios (${solvedCount}/${totalCases})`,
    },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[#232D3F] bg-[#0B0F17]/95 backdrop-blur-sm print:hidden">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-8 px-4 sm:px-6">
        {/* Zone 1: Single-element brand wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('briefing')}
          className="font-display text-lg font-bold tracking-tight text-[#F1F5F9] transition-colors hover:text-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
        >
          FAULT//LINE
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav aria-label="Primary navigation" className="flex items-center gap-5 sm:gap-7 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'text-amber-400'
                    : 'text-[#94A3B8] hover:text-[#E8EEF6]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-[2px] bg-amber-400"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary utility CTA */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenCommandRef}
            className="rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-[#0B0F17] transition-colors hover:bg-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Command Guide
          </button>
        </div>
      </div>
    </header>
  );
}
