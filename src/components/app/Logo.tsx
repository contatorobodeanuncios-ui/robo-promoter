import { Bot } from "lucide-react";

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="relative grid place-items-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-[var(--shadow-glow)]"
        style={{ width: size, height: size }}
      >
        <Bot className="text-white" style={{ width: size * 0.6, height: size * 0.6 }} />
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-success animate-pulse" />
      </div>
      <span className="font-semibold tracking-tight text-lg whitespace-nowrap">
        Robô de <span className="text-gradient">Lucro</span>
      </span>
    </div>
  );
}
