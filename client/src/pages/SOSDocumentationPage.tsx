import { useEffect, useState } from 'react';

export default function SOSDocumentationPage() {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/docs/SOS-how-it-works.md')
      .then(response => response.text())
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(error => {
        console.error('Failed to load documentation:', error);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <div className="mb-6">
          <a 
            href="/sos" 
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 no-underline"
          >
            ← Back to SOS
          </a>
        </div>
        <MarkdownRenderer content={content} />
      </div>
    </div>
  );
}

function MarkdownRenderer({ content }: { content: string }) {
  // Simple markdown parser for the most common elements
  const parseMarkdown = (text: string) => {
    return text
      .split('\n')
      .map((line, index) => {
        // Headers
        if (line.startsWith('# ')) {
          return <h1 key={index} className="text-3xl font-bold mt-8 mb-4 text-slate-900 dark:text-slate-100">{line.slice(2)}</h1>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={index} className="text-2xl font-semibold mt-6 mb-3 text-slate-800 dark:text-slate-200">{line.slice(3)}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={index} className="text-xl font-semibold mt-5 mb-2 text-slate-700 dark:text-slate-300">{line.slice(4)}</h3>;
        }

        // Code blocks
        if (line.startsWith('```')) {
          return <div key={index} className="bg-slate-100 dark:bg-slate-800 p-1 rounded text-sm font-mono"></div>;
        }

        // Code inline
        const codeInlineRegex = /`([^`]+)`/g;
        let processedLine = line;
        const codeMatches = [...line.matchAll(codeInlineRegex)];
        
        // Bullet points
        if (line.startsWith('- ') || line.startsWith('* ')) {
          const bulletContent = line.slice(2);
          return (
            <li key={index} className="ml-4 mb-2 text-slate-700 dark:text-slate-300">
              {renderInlineElements(bulletContent)}
            </li>
          );
        }

        // Numbered lists
        if (/^\d+\.\s/.test(line)) {
          const numberContent = line.replace(/^\d+\.\s/, '');
          return (
            <li key={index} className="ml-4 mb-2 text-slate-700 dark:text-slate-300 list-decimal">
              {renderInlineElements(numberContent)}
            </li>
          );
        }

        // Empty lines
        if (line.trim() === '') {
          return <br key={index} />;
        }

        // Bold text
        const boldRegex = /\*\*([^*]+)\*\*/g;
        
        // Regular paragraphs
        return (
          <p key={index} className="mb-3 text-slate-600 dark:text-slate-400 leading-relaxed">
            {renderInlineElements(line)}
          </p>
        );
      });
  };

  const renderInlineElements = (text: string) => {
    // Handle code inline
    const parts = text.split(/(`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-sm font-mono">
            {part.slice(1, -1)}
          </code>
        );
      }
      
      // Handle bold text
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((boldPart, j) => {
        if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
          return <strong key={`${i}-${j}`}>{boldPart.slice(2, -2)}</strong>;
        }
        return boldPart;
      });
    });
  };

  return <div>{parseMarkdown(content)}</div>;
}