import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  BookOpen, 
  Search, 
  ExternalLink, 
  Copy, 
  Check,
  ChevronRight,
  Server,
  Tag,
  FileJson,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

type ApiEndpointDescriptor = {
  key: string;
  method: 'GET' | 'POST';
  path: string;
  description: string;
  tags: string[];
  sampleParams?: {
    path?: Record<string, string>;
    query?: Record<string, string | number | boolean>;
    body?: any;
  };
  importantFields?: string[];
};

type LexiconResponse = {
  success: boolean;
  endpoints: ApiEndpointDescriptor[];
  tags: string[];
  count: number;
};

type EndpointDetailResponse = {
  success: boolean;
  descriptor: ApiEndpointDescriptor;
  liveExample: any;
  importantFields: string[];
};

const METHOD_COLORS = {
  GET: 'bg-emerald-600 text-white',
  POST: 'bg-blue-600 text-white',
};

const TAG_COLORS: Record<string, string> = {
  forge: 'bg-purple-600/20 text-purple-400 border-purple-600/30',
  admin: 'bg-red-600/20 text-red-400 border-red-600/30',
  rankings: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
  debug: 'bg-orange-600/20 text-orange-400 border-orange-600/30',
  player: 'bg-cyan-600/20 text-cyan-400 border-cyan-600/30',
  environment: 'bg-green-600/20 text-green-400 border-green-600/30',
  matchup: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
  default: 'bg-gray-600/20 text-gray-400 border-gray-600/30',
};

function getTagColor(tag: string): string {
  return TAG_COLORS[tag] || TAG_COLORS.default;
}

function buildSampleUrl(descriptor: ApiEndpointDescriptor): string {
  let url = descriptor.path;
  
  if (descriptor.sampleParams?.path) {
    for (const [param, value] of Object.entries(descriptor.sampleParams.path)) {
      url = url.replace(`:${param}`, value);
    }
  }
  
  if (descriptor.sampleParams?.query) {
    const queryParams = new URLSearchParams();
    for (const [param, value] of Object.entries(descriptor.sampleParams.query)) {
      queryParams.append(param, String(value));
    }
    const queryString = queryParams.toString();
    if (queryString) {
      url = `${url}?${queryString}`;
    }
  }
  
  return url;
}

function generateCurlCommand(descriptor: ApiEndpointDescriptor): string {
  const url = buildSampleUrl(descriptor);
  const baseUrl = window.location.origin;
  
  if (descriptor.method === 'GET') {
    return `curl -X GET "${baseUrl}${url}"`;
  } else {
    const body = descriptor.sampleParams?.body 
      ? JSON.stringify(descriptor.sampleParams.body, null, 2)
      : '{}';
    return `curl -X POST "${baseUrl}${url}" \\\n  -H "Content-Type: application/json" \\\n  -d '${body}'`;
  }
}

function JsonViewer({ data, importantFields = [] }: { data: any; importantFields?: string[] }) {
  const renderValue = (value: any, key: string, depth: number = 0): JSX.Element => {
    const isImportant = importantFields.includes(key);
    const keyClass = isImportant 
      ? 'text-amber-400 font-semibold' 
      : 'text-cyan-400';
    
    if (value === null) {
      return <span className="text-gray-500">null</span>;
    }
    
    if (typeof value === 'boolean') {
      return <span className="text-purple-400">{value.toString()}</span>;
    }
    
    if (typeof value === 'number') {
      return <span className="text-emerald-400">{value}</span>;
    }
    
    if (typeof value === 'string') {
      const displayValue = value.length > 100 ? value.substring(0, 100) + '...' : value;
      return <span className="text-amber-300">"{displayValue}"</span>;
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-gray-500">[]</span>;
      }
      if (depth > 2) {
        return <span className="text-gray-500">[Array({value.length})]</span>;
      }
      return (
        <span>
          [
          {value.slice(0, 3).map((item, i) => (
            <span key={i}>
              {i > 0 && ', '}
              {renderValue(item, '', depth + 1)}
            </span>
          ))}
          {value.length > 3 && <span className="text-gray-500"> ...+{value.length - 3}</span>}
          ]
        </span>
      );
    }
    
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) {
        return <span className="text-gray-500">{'{}'}</span>;
      }
      if (depth > 1) {
        return <span className="text-gray-500">{'{...}'}</span>;
      }
      return (
        <div className="ml-4">
          {'{'}
          {keys.slice(0, 8).map((k, i) => (
            <div key={k} className="ml-4">
              <span className={keyClass}>"{k}"</span>: {renderValue(value[k], k, depth + 1)}
              {i < Math.min(keys.length - 1, 7) && ','}
            </div>
          ))}
          {keys.length > 8 && (
            <div className="ml-4 text-gray-500">...+{keys.length - 8} more fields</div>
          )}
          {'}'}
        </div>
      );
    }
    
    return <span className="text-gray-400">{String(value)}</span>;
  };
  
  return (
    <pre className="text-sm font-mono bg-[#0d1117] p-4 rounded-lg overflow-auto max-h-[500px]">
      {renderValue(data, '', 0)}
    </pre>
  );
}

export default function ApiLexicon() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedEndpointKey, setSelectedEndpointKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: lexiconData, isLoading: isLoadingLexicon } = useQuery<LexiconResponse>({
    queryKey: ['/api/admin/api-lexicon'],
  });

  const { data: endpointDetail, isLoading: isLoadingDetail } = useQuery<EndpointDetailResponse>({
    queryKey: ['/api/admin/api-lexicon', selectedEndpointKey],
    enabled: !!selectedEndpointKey,
  });

  const filteredEndpoints = lexiconData?.endpoints?.filter(ep => {
    const matchesSearch = !searchQuery || 
      ep.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesTag = !selectedTag || ep.tags.includes(selectedTag);
    
    return matchesSearch && matchesTag;
  }) || [];

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: 'Copied!',
      description: `${label} copied to clipboard`,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedDescriptor = selectedEndpointKey 
    ? lexiconData?.endpoints?.find(ep => ep.key === selectedEndpointKey)
    : null;

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <BookOpen className="h-8 w-8 text-purple-400" />
          <div>
            <h1 className="text-2xl font-bold">API Lexicon</h1>
            <p className="text-gray-400">Forge & Tiber Endpoint Reference</p>
          </div>
          <Badge className="ml-auto bg-purple-600/20 text-purple-400 border border-purple-600/30">
            {lexiconData?.count || 0} Endpoints
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card className="bg-[#141824] border-[#1e2538]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-400">Search & Filter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search endpoints..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-[#0d1117] border-[#1e2538] text-white placeholder:text-gray-500"
                    data-testid="input-search-endpoints"
                  />
                </div>
                
                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    variant="outline"
                    className={`cursor-pointer transition-colors ${
                      !selectedTag 
                        ? 'bg-purple-600/20 text-purple-400 border-purple-600/30' 
                        : 'bg-gray-600/10 text-gray-400 border-gray-600/30 hover:bg-gray-600/20'
                    }`}
                    onClick={() => setSelectedTag(null)}
                    data-testid="filter-tag-all"
                  >
                    All
                  </Badge>
                  {lexiconData?.tags?.slice(0, 12).map(tag => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className={`cursor-pointer transition-colors ${
                        selectedTag === tag 
                          ? getTagColor(tag)
                          : 'bg-gray-600/10 text-gray-400 border-gray-600/30 hover:bg-gray-600/20'
                      }`}
                      onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                      data-testid={`filter-tag-${tag}`}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#141824] border-[#1e2538]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Endpoints ({filteredEndpoints.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  {isLoadingLexicon ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
                    </div>
                  ) : filteredEndpoints.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No endpoints found
                    </div>
                  ) : (
                    <div className="divide-y divide-[#1e2538]">
                      {filteredEndpoints.map(ep => (
                        <button
                          key={ep.key}
                          onClick={() => setSelectedEndpointKey(ep.key)}
                          className={`w-full text-left p-3 hover:bg-[#1a1f2e] transition-colors ${
                            selectedEndpointKey === ep.key ? 'bg-[#1a1f2e]' : ''
                          }`}
                          data-testid={`endpoint-item-${ep.key}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`text-xs px-1.5 py-0 ${METHOD_COLORS[ep.method]}`}>
                              {ep.method}
                            </Badge>
                            <span className="text-sm font-mono text-gray-300 truncate flex-1">
                              {ep.path}
                            </span>
                            <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {ep.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {!selectedEndpointKey ? (
              <Card className="bg-[#141824] border-[#1e2538] h-full">
                <CardContent className="flex flex-col items-center justify-center h-full min-h-[600px] text-gray-500">
                  <Server className="h-12 w-12 mb-4 opacity-30" />
                  <p>Select an endpoint to view details</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card className="bg-[#141824] border-[#1e2538]">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`${METHOD_COLORS[selectedDescriptor?.method || 'GET']}`}>
                            {selectedDescriptor?.method}
                          </Badge>
                          <code className="text-lg font-mono text-white">
                            {selectedDescriptor?.path}
                          </code>
                        </div>
                        <CardDescription className="text-gray-400">
                          {selectedDescriptor?.description}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-[#0d1117] border-[#1e2538] hover:bg-[#1a1f2e]"
                          onClick={() => window.open(buildSampleUrl(selectedDescriptor!), '_blank')}
                          data-testid="button-open-endpoint"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Open
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-[#0d1117] border-[#1e2538] hover:bg-[#1a1f2e]"
                          onClick={() => copyToClipboard(generateCurlCommand(selectedDescriptor!), 'cURL command')}
                          data-testid="button-copy-curl"
                        >
                          {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          cURL
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-1.5">
                      {selectedDescriptor?.tags.map(tag => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className={getTagColor(tag)}
                        >
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    {selectedDescriptor?.sampleParams && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Sample Parameters</h4>
                        <div className="bg-[#0d1117] p-3 rounded-lg font-mono text-sm">
                          {selectedDescriptor.sampleParams.path && (
                            <div className="mb-2">
                              <span className="text-gray-500">Path: </span>
                              <span className="text-cyan-400">
                                {JSON.stringify(selectedDescriptor.sampleParams.path)}
                              </span>
                            </div>
                          )}
                          {selectedDescriptor.sampleParams.query && (
                            <div className="mb-2">
                              <span className="text-gray-500">Query: </span>
                              <span className="text-emerald-400">
                                {JSON.stringify(selectedDescriptor.sampleParams.query)}
                              </span>
                            </div>
                          )}
                          {selectedDescriptor.sampleParams.body && (
                            <div>
                              <span className="text-gray-500">Body: </span>
                              <span className="text-amber-400">
                                {JSON.stringify(selectedDescriptor.sampleParams.body)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedDescriptor?.importantFields && selectedDescriptor.importantFields.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Important Fields</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedDescriptor.importantFields.map(field => (
                            <Badge
                              key={field}
                              variant="outline"
                              className="bg-amber-600/10 text-amber-400 border-amber-600/30 font-mono text-xs"
                            >
                              {field}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-[#141824] border-[#1e2538]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                      <FileJson className="h-4 w-4" />
                      Live Response Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingDetail ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
                        <span className="ml-2 text-gray-400">Fetching live example...</span>
                      </div>
                    ) : endpointDetail?.liveExample ? (
                      <JsonViewer 
                        data={endpointDetail.liveExample} 
                        importantFields={endpointDetail.importantFields}
                      />
                    ) : (
                      <div className="flex items-center justify-center py-12 text-gray-500">
                        <AlertCircle className="h-5 w-5 mr-2" />
                        No live example available
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
