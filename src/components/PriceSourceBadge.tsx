import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PriceSourceBadgeProps {
  source?: string;
  stale?: boolean;
  ageMinutes?: number;
  className?: string;
}

const PROVIDER_LABEL: Record<string, string> = {
  fmp: "FMP",
  stooq: "Stooq",
  yahoo: "Yahoo",
  alphavantage: "AV",
  alpha_vantage: "AV",
  cache: "Cache",
  snapshot: "Saved",
};

const PROVIDER_FULL: Record<string, string> = {
  fmp: "Financial Modeling Prep",
  stooq: "Stooq",
  yahoo: "Yahoo Finance",
  alphavantage: "Alpha Vantage",
  alpha_vantage: "Alpha Vantage",
  cache: "Cached price",
  snapshot: "Last saved snapshot",
};

const formatAge = (minutes?: number) => {
  if (!minutes || minutes < 1) return "just now";
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

export const PriceSourceBadge = ({ source, stale, ageMinutes, className }: PriceSourceBadgeProps) => {
  if (!source) return null;

  // Normalize: "Stooq (cached)", "Stooq", "stooq" all → "stooq"
  const key = source.split(/[\s(]/)[0].toLowerCase();
  const short = PROVIDER_LABEL[key] ?? source;
  const full = PROVIDER_FULL[key] ?? source;

  const label = stale ? "Stale" : short;
  const tooltip = stale
    ? `Cached from ${full} · ${formatAge(ageMinutes)} · live providers unavailable`
    : `Live price from ${full}`;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={stale ? "outline" : "secondary"}
            className={cn(
              "h-4 px-1.5 text-[9px] font-medium leading-none",
              stale && "border-amber-500/50 text-amber-600 dark:text-amber-400",
              className,
            )}
          >
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
