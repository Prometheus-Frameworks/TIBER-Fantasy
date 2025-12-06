import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0e1a]">
      <Card className="w-full max-w-md mx-4 bg-[#141824] border-gray-700">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <h1 className="text-2xl font-bold text-white">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-gray-400">
            The page you're looking for doesn't exist or has been moved.
          </p>
          
          <Link href="/">
            <Button className="mt-6 w-full" variant="outline" data-testid="button-go-home">
              <Home className="h-4 w-4 mr-2" />
              Go to Homepage
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
