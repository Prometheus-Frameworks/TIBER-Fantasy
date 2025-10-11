import { Rocket, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ComingSoonProps {
  title: string;
  description: string;
  features?: string[];
}

export default function ComingSoon({ title, description, features }: ComingSoonProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-2xl px-6">
        <div className="w-24 h-24 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Rocket className="w-12 h-12 text-blue-400" />
        </div>
        
        <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          {title}
        </h2>
        
        <p className="text-gray-400 text-lg mb-8">
          {description}
        </p>

        {features && features.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Planned Features
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {features.map((feature, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-left p-3 bg-[#1e2330] border border-gray-800 rounded-lg"
                >
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-300 text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button
          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          data-testid="button-notify-launch"
        >
          <Bell className="w-4 h-4 mr-2" />
          Notify Me When Ready
        </Button>
      </div>
    </div>
  );
}
