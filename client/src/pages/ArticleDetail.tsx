import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Clock, User, Eye, Calendar, Share2 } from "lucide-react";
import { Link } from "wouter";
import type { Article } from "@shared/schema";

interface ArticleResponse {
  success: boolean;
  data: Article;
}

export default function ArticleDetail() {
  const [, params] = useRoute("/articles/:slug");
  const slug = params?.slug;

  const { data: articleData, isLoading, error } = useQuery<ArticleResponse>({
    queryKey: ['/api/articles', slug],
    queryFn: async () => {
      const response = await fetch(`/api/articles/${slug}`);
      if (!response.ok) throw new Error('Failed to fetch article');
      return response.json();
    },
    enabled: !!slug
  });

  const article = articleData?.data;

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      "Player Analysis": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      "Position Strategy": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      "Dynasty Strategy": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      "Rookie Analysis": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      "Methodology": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
      "Intelligence": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200"
    };
    return colors[category] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-6 w-24 mb-4" />
          <Skeleton className="h-12 w-full mb-4" />
          <div className="flex gap-4 mb-8">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Article Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The article you're looking for could not be found.
            </p>
            <Link href="/articles">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Articles
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Navigation */}
        <div className="mb-6">
          <Link href="/articles">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Articles
            </Button>
          </Link>
        </div>

        {/* Article Header */}
        <article className="prose prose-lg dark:prose-invert max-w-none">
          <div className="not-prose mb-8">
            <Badge className={getCategoryColor(article.category)} variant="secondary">
              {article.category}
            </Badge>
            
            <h1 className="text-4xl font-bold tracking-tight mt-4 mb-4 leading-tight">
              {article.title}
            </h1>
            
            <p className="text-xl text-muted-foreground mb-6 leading-relaxed">
              {article.description}
            </p>

            {/* Article Meta */}
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span className="font-medium">{article.author}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{article.publishDate ? new Date(article.publishDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'Unknown date'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{article.readTime}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    <span>{article.viewCount} views</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Share2 className="h-4 w-4" />
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-auto p-0 font-normal text-muted-foreground hover:text-foreground"
                      onClick={() => navigator.clipboard.writeText(window.location.href)}
                    >
                      Share
                    </Button>
                  </div>
                </div>
                
                {/* Tags */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {article.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Article Content */}
          <div 
            className="article-content"
            dangerouslySetInnerHTML={{
              __html: article.content
                .replace(/^# /gm, '## ')  // Convert H1 to H2 since we have page title
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // Bold
                .replace(/\*(.*?)\*/g, '<em>$1</em>')  // Italic
                .replace(/\n\n/g, '</p><p>')  // Paragraphs
                .replace(/^(.+)$/gm, '<p>$1</p>')  // Wrap lines in paragraphs
                .replace(/<p>## (.*?)<\/p>/g, '<h2>$1</h2>')  // Headers
                .replace(/<p>### (.*?)<\/p>/g, '<h3>$1</h3>')  // H3
                .replace(/<p>#### (.*?)<\/p>/g, '<h4>$1</h4>')  // H4
                .replace(/<p>\*\* (.*?):<\/p>/g, '<h4>$1:</h4>')  // Bold titles
                .replace(/<p>- (.*?)<\/p>/g, '<li>$1</li>')  // List items
                .replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>')  // Wrap lists
                .replace(/<p><\/p>/g, '')  // Remove empty paragraphs
            }}
          />

          {/* Author Bio */}
          {article.authorBio && (
            <div className="not-prose mt-12 p-6 bg-muted/50 rounded-lg">
              <h3 className="font-semibold mb-2">About {article.author}</h3>
              <p className="text-muted-foreground text-sm">{article.authorBio}</p>
            </div>
          )}
        </article>

        {/* Related Articles CTA */}
        <div className="mt-12 text-center">
          <Link href="/articles">
            <Button variant="outline" size="lg">
              Read More Articles
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}