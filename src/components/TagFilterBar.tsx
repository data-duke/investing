import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface TagFilterBarProps {
  allTags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  onClearAll: () => void;
  filteredCount: number;
  totalCount: number;
}

export const TagFilterBar = ({
  allTags,
  selectedTags,
  onTagToggle,
  onClearAll,
  filteredCount,
  totalCount,
}: TagFilterBarProps) => {
  if (allTags.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-muted-foreground">Filter by tag:</span>
        {allTags.map((tag) => (
          <Badge
            key={tag}
            variant={selectedTags.includes(tag) ? "default" : "outline"}
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => onTagToggle(tag)}
          >
            {tag}
          </Badge>
        ))}
        {selectedTags.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onClearAll}
            className="h-7 px-3 text-xs font-medium"
          >
            <X className="h-3 w-3 mr-1" />
            Reset ({selectedTags.length})
          </Button>
        )}
      </div>
      {selectedTags.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing {filteredCount} of {totalCount} investments with tag(s): {selectedTags.join(", ")}
        </div>
      )}
    </div>
  );
};
