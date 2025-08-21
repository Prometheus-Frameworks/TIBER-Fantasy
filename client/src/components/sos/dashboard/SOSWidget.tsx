import { ReactNode, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, X, Move, Eye, EyeOff } from 'lucide-react';

interface SOSWidgetProps {
  id?: number;
  title: string;
  children: ReactNode;
  isEditable?: boolean;
  isVisible?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleVisibility?: () => void;
  className?: string;
}

export default function SOSWidget({ 
  id,
  title, 
  children, 
  isEditable = false,
  isVisible = true,
  onEdit,
  onDelete,
  onToggleVisibility,
  className = ""
}: SOSWidgetProps) {
  const [isDragging, setIsDragging] = useState(false);

  if (!isVisible) {
    return (
      <Card className={`p-4 border-dashed border-gray-300 bg-gray-50 dark:bg-gray-800 ${className}`}>
        <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
          <span className="text-sm">Hidden: {title}</span>
          {isEditable && (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={onToggleVisibility}>
                <Eye className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={onDelete}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className={`relative ${isDragging ? 'shadow-lg ring-2 ring-blue-500' : ''} ${className}`}>
      {isEditable && (
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onToggleVisibility}>
            <EyeOff className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onEdit}>
            <Settings className="w-3 h-3" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-6 w-6 p-0 cursor-move" 
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
          >
            <Move className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onDelete}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
      
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-3 pr-16">{title}</h3>
        {children}
      </div>
    </Card>
  );
}