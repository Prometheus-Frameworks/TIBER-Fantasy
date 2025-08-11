import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, TrendingUp, Users, Target, Clock, ArrowUpRight } from "lucide-react";

interface Article {
  id: string;
  title: string;
  description: string;
  category: string;
  readTime: string;
  publishDate: string;
  tags: string[];
  featured?: boolean;
}

// Sample articles - replace with real content
const featuredArticles: Article[] = [
  {
    id: "travis-hunter-breakdown",
    title: "Travis Hunter: The Two-Way Dynasty Phenomenon", 
    description: "Deep dive into Hunter's unprecedented skill set and how his dual-threat capability creates unique dynasty value beyond traditional WR metrics.",
    category: "Player Analysis",
    readTime: "8 min",
    publishDate: "2025-08-11",
    tags: ["rookies", "wr", "colorado", "two-way"],
    featured: true
  },
  {
    id: "rb-committee-navigation", 
    title: "Navigating RB Committees in 2025",
    description: "Strategic framework for evaluating and targeting running backs in committee situations, featuring analysis of Denver, Tennessee, and Cleveland backfields.",
    category: "Position Strategy",
    readTime: "12 min", 
    publishDate: "2025-08-10",
    tags: ["rb", "strategy", "committees", "adp"],
    featured: true
  }
];

const recentArticles: Article[] = [
  {
    id: "preseason-intel-week1",
    title: "Week 1 Preseason Intel Roundup",
    description: "Key observations from trusted community sources including depth chart shifts, usage patterns, and dynasty implications.",
    category: "Intelligence",
    readTime: "5 min",
    publishDate: "2025-08-11", 
    tags: ["preseason", "intel", "depth-charts"]
  },
  {
    id: "target-competition-framework",
    title: "Target Competition Analysis Framework",
    description: "Comprehensive methodology for evaluating WR target competition and projecting usage in complex offensive systems.",
    category: "Methodology",
    readTime: "15 min",
    publishDate: "2025-08-09",
    tags: ["wr", "targets", "methodology", "projection"]
  },
  {
    id: "dynasty-decline-detection",
    title: "Early Detection of Dynasty Player Decline",
    description: "Advanced metrics and signals for identifying when aging assets should be moved before value craters.",
    category: "Dynasty Strategy", 
    readTime: "10 min",
    publishDate: "2025-08-08",
    tags: ["dynasty", "aging", "sell-timing", "analytics"]
  },
  {
    id: "rookie-te-evaluation",
    title: "2025 Rookie TE Evaluation System",
    description: "Four-component framework for projecting rookie tight end success including situation, usage, and development timeline.",
    category: "Rookie Analysis",
    readTime: "12 min",
    publishDate: "2025-08-07",
    tags: ["rookies", "te", "evaluation", "development"]
  }
];

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
              variant="outline" 
              size="sm"
              className="hover:bg-primary hover:text-primary-foreground text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2"
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Featured Articles */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="h-5 w-5 text-orange-600" />
          <h2 className="text-2xl font-bold">Featured Analysis</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {featuredArticles.map((article) => (
            <Card key={article.id} className="hover:shadow-lg transition-shadow cursor-pointer">
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
                    <span>{article.publishDate}</span>
                    <ArrowUpRight className="h-4 w-4 ml-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Recent Articles */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <Target className="h-5 w-5 text-green-600" />
          <h2 className="text-2xl font-bold">Recent Articles</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {recentArticles.map((article) => (
            <Card key={article.id} className="hover:shadow-lg transition-shadow cursor-pointer">
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
                  <span className="text-xs text-muted-foreground">{article.publishDate}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

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