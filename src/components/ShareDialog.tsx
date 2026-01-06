import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Link, Check } from "lucide-react";
import { SHARE_EXPIRATION_OPTIONS } from "@/lib/constants";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTags: string[];
  onSuccess?: () => void;
}

export const ShareDialog = ({
  open,
  onOpenChange,
  availableTags,
  onSuccess,
}: ShareDialogProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [shareAll, setShareAll] = useState(false);
  const [name, setName] = useState("");
  const [expirationHours, setExpirationHours] = useState("24");
  const [showValues, setShowValues] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    // Deselect "share all" when picking specific tags
    if (!selectedTags.includes(tag)) {
      setShareAll(false);
    }
  };

  const handleShareAllToggle = (checked: boolean) => {
    setShareAll(checked);
    if (checked) {
      setSelectedTags([]);
    }
  };

  const handleCreate = async () => {
    // Allow creation if share all is selected OR specific tags are selected
    if (!shareAll && selectedTags.length === 0 && availableTags.length > 0) {
      toast({
        title: t("share.noTagsSelected"),
        description: t("share.selectAtLeastOneTag"),
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + parseInt(expirationHours));

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // If sharing all or no tags available, use special marker
      const tagsToShare = shareAll || availableTags.length === 0 
        ? ["__ALL__"] 
        : selectedTags;

      const { data, error } = await supabase
        .from("shared_views")
        .insert({
          user_id: user.id,
          tags: tagsToShare,
          name: name.trim() || null,
          expires_at: expiresAt.toISOString(),
          show_values: showValues,
        })
        .select("token")
        .single();

      if (error) throw error;

      const url = `${window.location.origin}/share/${data.token}`;
      setGeneratedUrl(url);

      toast({
        title: t("share.linkCreated"),
        description: t("share.linkCreatedDesc"),
      });

      onSuccess?.();
    } catch (error) {
      console.error("Error creating share:", error);
      toast({
        title: t("common.error"),
        description: t("share.errorCreating"),
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedUrl) return;

    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    toast({
      title: t("share.copied"),
      description: t("share.linkCopied"),
    });
  };

  const handleClose = () => {
    setSelectedTags([]);
    setShareAll(false);
    setName("");
    setExpirationHours("24");
    setShowValues(true);
    setGeneratedUrl(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            {t("share.title")}
          </DialogTitle>
          <DialogDescription>{t("share.description")}</DialogDescription>
        </DialogHeader>

        {!generatedUrl ? (
          <div className="space-y-4">
            {/* Share All toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label className="font-medium">{t("share.shareAll")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("share.shareAllDesc")}
                </p>
              </div>
              <Switch checked={shareAll} onCheckedChange={handleShareAllToggle} />
            </div>

            {/* Tag selection - only show if not sharing all and tags exist */}
            {!shareAll && availableTags.length > 0 && (
              <div className="space-y-2">
                <Label>{t("share.selectTags")}</Label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant={selectedTags.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="share-name">{t("share.name")}</Label>
              <Input
                id="share-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("share.namePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("share.expiration")}</Label>
              <Select value={expirationHours} onValueChange={setExpirationHours}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHARE_EXPIRATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t("share.showValues")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("share.showValuesDesc")}
                </p>
              </div>
              <Switch checked={showValues} onCheckedChange={setShowValues} />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-md">
              <Label className="text-xs text-muted-foreground">
                {t("share.yourLink")}
              </Label>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  value={generatedUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("share.linkExpiresIn", { hours: expirationHours })}
            </p>
          </div>
        )}

        <DialogFooter>
          {!generatedUrl ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isCreating || (!shareAll && selectedTags.length === 0 && availableTags.length > 0)}
              >
                {isCreating ? t("share.creating") : t("share.createLink")}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>{t("common.done")}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
