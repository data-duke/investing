import { useEffect, useState } from "react";
import { useStockNews, NewsArticle } from "@/hooks/useStockNews";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StockNewsSectionProps {
  symbol: string;
}

export const StockNewsSection = ({ symbol }: StockNewsSectionProps) => {
  const { fetchNews, loading } = useStockNews();
  const [articles, setArticles] = useState<NewsArticle[]>([]);

  useEffect(() => {
    const loadNews = async () => {
      const news = await fetchNews(symbol);
      setArticles(news);
    };
    loadNews();
  }, [symbol]);

  if (loading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading news...
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Newspaper className="h-8 w-8 mx-auto mb-2 opacity-50" />
        No recent news available for {symbol}
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        <Newspaper className="h-4 w-4" />
        Latest News for {symbol}
      </h4>
      {articles.map((article, index) => (
        <Card key={index} className="hover:bg-muted/50 transition-colors">
          <CardContent className="p-4">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium hover:text-primary flex items-center gap-1"
                >
                  {article.title}
                  <ExternalLink className="h-3 w-3" />
                </a>
                <div className="text-xs text-muted-foreground mt-1">
                  {article.source} · {new Date(article.publishedAt).toLocaleDateString()}
                </div>
                <p className="text-sm mt-2 text-muted-foreground line-clamp-2">
                  {article.summary}
                </p>
              </div>
              {article.sentiment && (
                <Badge
                  variant={
                    article.sentiment === 'positive' ? 'default' :
                    article.sentiment === 'negative' ? 'destructive' : 'secondary'
                  }
                >
                  {article.sentiment}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
