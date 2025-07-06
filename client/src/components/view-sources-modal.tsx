import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, Shield, Eye, Clock, CheckCircle, AlertCircle } from "lucide-react";

interface DataSource {
  id: string;
  name: string;
  type: string;
  category: string;
  description: string;
  dataPoints: string[];
  updateFrequency: string;
  reliability: 'High' | 'Medium' | 'Experimental';
  legalStatus: string;
}

interface ApiIntegration {
  name: string;
  purpose: string;
  dataType: string;
  frequency: string;
}

export function ViewSourcesModal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const { data: sourcesData } = useQuery({
    queryKey: ["/api/data-sources"],
    enabled: open,
  });

  const { data: integrationsData } = useQuery({
    queryKey: ["/api/data-sources/integrations"],
    enabled: open,
  });

  const { data: complianceData } = useQuery({
    queryKey: ["/api/data-sources/compliance"],
    enabled: open,
  });

  const sources = sourcesData?.sources || [];
  const integrations = integrationsData?.categories || [];
  const compliance = complianceData || {};

  const getReliabilityIcon = (reliability: string) => {
    switch (reliability) {
      case 'High': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'Medium': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getReliabilityColor = (reliability: string) => {
    switch (reliability) {
      case 'High': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Data Sources & API Integrations
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="sources" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sources">Data Sources</TabsTrigger>
            <TabsTrigger value="integrations">API Integrations</TabsTrigger>
            <TabsTrigger value="compliance">Legal Compliance</TabsTrigger>
          </TabsList>

          <TabsContent value="sources" className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Transparent disclosure of all data sources powering Prometheus analytics
            </div>
            
            <div className="grid gap-4">
              {sources.map((source: DataSource) => (
                <Card key={source.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="text-lg">{source.name}</span>
                      <div className="flex items-center gap-2">
                        {getReliabilityIcon(source.reliability)}
                        <Badge className={getReliabilityColor(source.reliability)}>
                          {source.reliability}
                        </Badge>
                      </div>
                    </CardTitle>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">{source.type}</Badge>
                      <Badge variant="outline">{source.category}</Badge>
                      <Badge variant="outline">{source.legalStatus}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-gray-600">{source.description}</p>
                    
                    <div>
                      <h4 className="font-medium text-sm mb-2">Data Points:</h4>
                      <div className="flex flex-wrap gap-1">
                        {source.dataPoints.map((point, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {point}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {source.updateFrequency}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Technical overview of our API integrations (safe for public disclosure)
            </div>
            
            <div className="space-y-4">
              {integrations.map((category: any, idx: number) => (
                <Card key={idx}>
                  <CardHeader>
                    <CardTitle className="text-lg">{category.category}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3">
                      {category.integrations.map((integration: ApiIntegration, integrationIdx: number) => (
                        <div key={integrationIdx} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{integration.name}</h4>
                            <Badge variant="outline" className="text-xs">
                              {integration.frequency}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{integration.purpose}</p>
                          <p className="text-xs text-gray-500">
                            <strong>Data Type:</strong> {integration.dataType}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-900">Why We Share This</span>
              </div>
              <p className="text-sm text-blue-800">
                Transparency builds trust. By disclosing our data integration approach, 
                you can verify our commitment to authentic, authorized data sources while 
                understanding the scope and reliability of our analytics.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Legal compliance status and data governance overview
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-green-600" />
                  Legal Compliance Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="font-medium text-green-700">
                    Status: {compliance.status || 'Compliant'}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600">
                  {compliance.summary || 'All data sources properly licensed and compliant with platform terms.'}
                </p>

                {compliance.recommendations && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Ongoing Compliance Measures:</h4>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      {compliance.recommendations.map((rec: string, idx: number) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data Governance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Privacy Compliant</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Terms Compliant</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Proper Attribution</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Licensed APIs Only</span>
                  </div>
                </div>
                
                <div className="bg-gray-50 border rounded-lg p-3 mt-4">
                  <p className="text-xs text-gray-600">
                    <strong>Legal Notice:</strong> All data usage complies with platform Terms of Service 
                    and API licensing agreements. No proprietary data is redistributed without authorization.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}