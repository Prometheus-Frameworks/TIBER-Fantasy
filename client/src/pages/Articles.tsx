import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, TrendingUp, Users, Target, Clock, ArrowUpRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Link } from "wouter";
import type { Article } from "@shared/schema";

// API response interface
interface ArticlesResponse {
  success: boolean;
  data: Article[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

const categories = [
  "All Articles",
  "Player Analysis", 
  "Position Strategy",
  "Dynasty Strategy",
  "Rookie Analysis",
  "Methodology",
  "Intelligence"
];

export default function Articles() {
  const [selectedCategory, setSelectedCategory] = useState("All Articles");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch articles data
  const { data: articlesData, isLoading, error } = useQuery<ArticlesResponse>({
    queryKey: ['/api/articles', selectedCategory, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== "All Articles") {
        params.append('category', selectedCategory);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      params.append('limit', '50');
      
      const response = await fetch(`/api/articles?${params}`);
      if (!response.ok) throw new Error('Failed to fetch articles');
      return response.json();
    }
  });

  // Fetch categories
  const { data: categoriesData } = useQuery<{ success: boolean; data: string[] }>({
    queryKey: ['/api/articles/categories'],
    queryFn: async () => {
      const response = await fetch('/api/articles/categories');
      if (!response.ok) throw new Error('Failed to fetch categories');
      return response.json();
    }
  });

  const articles = articlesData?.data || [];
  const featuredArticles = articles.filter(article => article.featured);
  const recentArticles = articles.filter(article => !article.featured);
  const categories = ["All Articles", ...(categoriesData?.data || [])];

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      "Player Analysis": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      "Position Strategy": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", 
      "Dynasty Strategy": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      "Rookie Analysis": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      "Methodology": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
      "Intelligence": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
    };
    return colors[category] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  };

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
          <h1 className="text-2xl sm:text-3xl font-bold">Articles & Analysis</h1>
        </div>
        <p className="text-base sm:text-lg text-muted-foreground max-w-3xl">
          In-depth dynasty analysis, strategic frameworks, and community insights. 
          Transform data into actionable intelligence for smarter fantasy decisions.
        </p>
      </div>

      {/* Category Filter */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-wrap gap-1 sm:gap-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="hover:bg-primary hover:text-primary-foreground text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2"
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-8 w-48" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-24 mb-2" />
                    <Skeleton className="h-6 w-full mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Unable to load articles</h3>
          <p className="text-muted-foreground mb-4">Please try again later</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      )}

      {/* Featured Articles */}
      {!isLoading && !error && featuredArticles.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="h-5 w-5 text-orange-600" />
            <h2 className="text-2xl font-bold">Featured Analysis</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {featuredArticles.map((article) => (
              <Link key={article.id} href={`/articles/${article.slug}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <Badge className={getCategoryColor(article.category)}>
                      {article.category}
                    </Badge>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 mr-1" />
                      {article.readTime}
                    </div>
                  </div>
                  <CardTitle className="text-xl leading-tight hover:text-primary transition-colors">
                    {article.title}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {article.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {article.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <span>{new Date(article.publishDate).toLocaleDateString()}</span>
                      <ArrowUpRight className="h-4 w-4 ml-1" />
                    </div>
                  </div>
                </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent Articles */}
      {!isLoading && !error && recentArticles.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Target className="h-5 w-5 text-green-600" />
            <h2 className="text-2xl font-bold">Recent Articles</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {recentArticles.map((article) => (
              <Link key={article.id} href={`/articles/${article.slug}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={getCategoryColor(article.category)} variant="outline">
                      {article.category}
                    </Badge>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 mr-1" />
                      {article.readTime}
                    </div>
                  </div>
                  <CardTitle className="text-lg leading-tight hover:text-primary transition-colors">
                    {article.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-sm mb-4">
                    {article.description}
                  </CardDescription>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {article.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(article.publishDate).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Coming Soon */}
      <section className="mt-12">
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-dashed">
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Community Contributions</h3>
            <p className="text-muted-foreground mb-4 max-w-2xl mx-auto">
              Soon: User-generated content, community analysis, and collaborative research. 
              Help build the knowledge base that democratizes elite fantasy insights.
            </p>
            <Button variant="outline">
              Learn More About Contributing
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}