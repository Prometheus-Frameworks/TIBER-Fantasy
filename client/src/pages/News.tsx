import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, TrendingUp, TrendingDown, Clock, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface NewsArticle {
  title: string;
  source: string;
  published_at: string;
  url?: string;
  text: string;
}

interface NewsResponse {
  articles: NewsArticle[];
}

// Fantasy impact analyzer using lexicon-style logic
function analyzeFantasyImpact(title: string, text: string): {
  impact: 'high' | 'medium' | 'low';
  signals: string[];
  summary: string;
} {
  const content = `${title} ${text}`.toLowerCase();
  
  const highImpactSignals = [
    { phrase: 'injury', weight: 3, summary: 'Player health concerns' },
    { phrase: 'trade', weight: 3, summary: 'Team/target share changes' },
    { phrase: 'suspended', weight: 3, summary: 'Availability questions' },
    { phrase: 'starting', weight: 2, summary: 'Depth chart movement' },
    { phrase: 'limited', weight: 2, summary: 'Practice participation' },
    { phrase: 'pup list', weight: 3, summary: 'Extended absence likely' },
    { phrase: 'activated', weight: 2, summary: 'Return timeline clarified' }
  ];
  
  const mediumImpactSignals = [
    { phrase: 'practice', weight: 1, summary: 'Training camp updates' },
    { phrase: 'extension', weight: 1, summary: 'Contract security' },
    { phrase: 'compete', weight: 1, summary: 'Position battles' },
    { phrase: 'coach', weight: 1, summary: 'Coaching perspective' }
  ];

  const foundSignals: string[] = [];
  let totalWeight = 0;

  [...highImpactSignals, ...mediumImpactSignals].forEach(signal => {
    if (content.includes(signal.phrase)) {
      foundSignals.push(signal.summary);
      totalWeight += signal.weight;
    }
  });

  let impact: 'high' | 'medium' | 'low' = 'low';
  let summary = 'General NFL news';

  if (totalWeight >= 3) {
    impact = 'high';
    summary = foundSignals[0] || 'Significant fantasy implications';
  } else if (totalWeight >= 1) {
    impact = 'medium';  
    summary = foundSignals[0] || 'Minor fantasy relevance';
  }

  return { impact, signals: foundSignals.slice(0, 2), summary };
}

function NewsCard({ article }: { article: NewsArticle }) {
  const analysis = analyzeFantasyImpact(article.title, article.text);
  
  const impactColors = {
    high: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    medium: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800', 
    low: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700'
  };
  
  const badgeColors = {
    high: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200',
    medium: 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200',
    low: 'bg-gray-100 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400'
  };

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${impactColors[analysis.impact]}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-lg font-semibold leading-tight line-clamp-2">
            {article.title}
          </CardTitle>
          {analysis.impact === 'high' && <TrendingUp className="w-5 h-5 text-red-600 flex-shrink-0 mt-1" />}
          {analysis.impact === 'medium' && <TrendingDown className="w-5 h-5 text-orange-600 flex-shrink-0 mt-1" />}
        </div>
        
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(article.published_at), { addSuffix: true })}
          </span>
          <Badge variant="outline" className="text-xs">
            {article.source}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {article.text.slice(0, 150)}...
          </p>
          
          <div className="flex items-center justify-between">
            <Badge className={`text-xs ${badgeColors[analysis.impact]}`}>
              Fantasy Impact: {analysis.impact.charAt(0).toUpperCase() + analysis.impact.slice(1)}
            </Badge>
            
            {article.url && (
              <a 
                href={article.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Read more <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          
          {analysis.summary !== 'General NFL news' && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                <Users className="w-3 h-3 inline mr-1" />
                {analysis.summary}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function NewsLoadingSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-3/4" />
        <div className="flex gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex justify-between pt-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function News() {
  const { data: news, isLoading, error } = useQuery<NewsResponse>({
    queryKey: ['/rag/api/recent'],
    queryFn: async () => {
      const response = await fetch('/rag/api/recent?days=3&limit=20');
      if (!response.ok) {
        throw new Error('Failed to fetch news');
      }
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">News + Updates</h1>
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <CardContent className="pt-6">
            <p className="text-red-600 dark:text-red-400">
              Unable to load news updates. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const articles = news?.articles || [];
  const highImpactCount = articles.filter(article => 
    analyzeFantasyImpact(article.title, article.text).impact === 'high'
  ).length;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">News + Updates</h1>
        <p className="text-muted-foreground mb-4">
          Recent NFL news analyzed for fantasy football relevance
        </p>
        
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>High Fantasy Impact ({highImpactCount})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span>Medium Impact</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
            <span>Low Impact</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <>
            {Array.from({ length: 9 }).map((_, i) => (
              <NewsLoadingSkeleton key={i} />
            ))}
          </>
        ) : (
          articles.map((article, index) => (
            <NewsCard key={`${article.title}-${index}`} article={article} />
          ))
        )}
      </div>

      {!isLoading && articles.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              No recent news available. Check back later for updates.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}