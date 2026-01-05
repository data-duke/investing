import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Copy, Eye, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SharedView {
  id: string;
  token: string;
  name: string | null;
  tags: string[];
  expires_at: string;
  created_at: string;
  view_count: number;
  is_active: boolean;
}

interface ManageSharesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ManageSharesDialog = ({
  open,
  onOpenChange,
}: ManageSharesDialogProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [shares, setShares] = useState<SharedView[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchShares = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shared_views")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching shares:", error);
      toast({
        title: t("common.error"),
        description: t("share.errorFetching"),
        variant: "destructive",
      });
    } else {
      setShares(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchShares();
    }
  }, [open]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from("shared_views").delete().eq("id", id);

    if (error) {
      toast({
        title: t("common.error"),
        description: t("share.errorDeleting"),
        variant: "destructive",
      });
    } else {
      setShares((prev) => prev.filter((s) => s.id !== id));
      toast({
        title: t("share.deleted"),
        description: t("share.linkDeleted"),
      });
    }
    setDeleting(null);
  };

  const handleCopy = async (token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    await navigator.clipboard.writeText(url);
    toast({
      title: t("share.copied"),
      description: t("share.linkCopied"),
    });
  };

  const handleOpen = (token: string) => {
    window.open(`${window.location.origin}/share/${token}`, "_blank");
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("share.manageTitle")}</DialogTitle>
          <DialogDescription>{t("share.manageDescription")}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : shares.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            {t("share.noShares")}
          </div>
        ) : (
          <div className="space-y-4">
            {shares.map((share) => (
              <div
                key={share.id}
                className={`p-4 border rounded-lg ${
                  isExpired(share.expires_at)
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium truncate">
                        {share.name || t("share.untitled")}
                      </span>
                      {isExpired(share.expires_at) && (
                        <Badge variant="destructive" className="text-xs">
                          {t("share.expired")}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                      {share.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {share.view_count} {t("share.views")}
                      </span>
                      <span>
                        {isExpired(share.expires_at)
                          ? t("share.expiredAgo", {
                              time: formatDistanceToNow(
                                new Date(share.expires_at)
                              ),
                            })
                          : t("share.expiresIn", {
                              time: formatDistanceToNow(
                                new Date(share.expires_at)
                              ),
                            })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleOpen(share.token)}
                      title={t("share.openLink")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleCopy(share.token)}
                      title={t("share.copyLink")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(share.id)}
                      disabled={deleting === share.id}
                      className="text-destructive hover:text-destructive"
                      title={t("share.deleteLink")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
