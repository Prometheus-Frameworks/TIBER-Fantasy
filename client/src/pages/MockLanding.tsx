// Mock Landing Page Template - Easily Identifiable for Visual Inspection
import { ArrowLeft, AlertTriangle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface MockLandingProps {
  title: string;
  route: string;
  status?: 'planned' | 'building' | 'missing';
  description?: string;
  features?: string[];
}

export default function MockLanding({ 
  title, 
  route, 
  status = 'missing', 
  description,
  features = []
}: MockLandingProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'planned': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'building': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'missing': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'planned': return <CheckCircle className="w-4 h-4" />;
      case 'building': return <AlertTriangle className="w-4 h-4" />;
      case 'missing': return <AlertTriangle className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>
        
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-3xl font-bold text-ink">{title}</h1>
          <Badge className={`${getStatusColor()} flex items-center gap-1`}>
            {getStatusIcon()}
            {status.toUpperCase()}
          </Badge>
        </div>
        
        <p className="text-body text-lg">
          {description || `Landing page for ${title} feature`}
        </p>
      </div>

      {/* Status Card */}
      <Card className="mb-8 border-2 border-dashed border-gold/30 bg-gradient-to-r from-gold/5 to-plum/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gold">
            <AlertTriangle className="w-5 h-5" />
            Mock Landing Page - Visual Inspection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Route Information</h3>
              <p className="text-sm text-body">
                <strong>Path:</strong> {route}
              </p>
              <p className="text-sm text-body">
                <strong>Status:</strong> {status}
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Development Notes</h3>
              <p className="text-sm text-body">
                This is a placeholder page for easy identification during visual inspection.
                Replace with actual implementation when ready.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Planned Features */}
      {features.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Planned Features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {features.map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="mt-8 flex gap-4">
        <Link href="/">
          <Button>Return to Home</Button>
        </Link>
        <Link href="/compass">
          <Button variant="outline">Player Compass</Button>
        </Link>
        <Link href="/consensus">
          <Button variant="outline">OTC Consensus</Button>
        </Link>
      </div>
    </div>
  );
}