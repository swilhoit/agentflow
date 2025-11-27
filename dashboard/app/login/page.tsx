'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginPageContent() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        const from = searchParams.get('from') || '/';
        router.push(from);
        router.refresh();
      } else {
        setError('ACCESS DENIED');
        setPassword('');
      }
    } catch (err) {
      setError('CONNECTION ERROR');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-5">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 255, 136, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 255, 136, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>
      
      {/* Scanning line animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute w-full h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-50"
          style={{
            animation: 'scan 3s linear infinite',
          }}
        />
      </div>
      
      <style jsx>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
        @keyframes blink {
          0%, 50%, 100% { opacity: 1; }
          25%, 75% { opacity: 0; }
        }
        @keyframes glitch {
          0%, 100% { transform: translate(0); }
          20% { transform: translate(-2px, 2px); }
          40% { transform: translate(-2px, -2px); }
          60% { transform: translate(2px, 2px); }
          80% { transform: translate(2px, -2px); }
        }
      `}</style>
      
      <div className="w-full max-w-md relative">
        {/* Terminal window */}
        <div className="border border-border bg-card shadow-2xl">
          {/* Terminal header */}
          <div className="border-b border-border px-4 py-2 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-destructive/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-accent/60" />
            </div>
            <span className="font-mono text-xs text-muted-foreground ml-2">AGENTFLOW_AUTH_v2.0</span>
          </div>
          
          {/* Terminal content */}
          <div className="p-8">
            {/* ASCII Art Logo */}
            <pre className="font-mono text-xs text-accent mb-6 leading-tight select-none">
{`   ___   _____  _____ _   _ _____ 
  / _ \\ /  ___|/  ___| \\ | |_   _|
 / /_\\ \\\\ \`--. \\ \`--.|  \\| | | |  
 |  _  | \`--. \\ \\--. \\ . \` | | |  
 | | | |/\\__/ //\\__/ / |\\  | | |  
 \\_| |_/\\____/ \\____/\\_| \\_/ \\_/  
                                  
       ███████╗██╗      ██████╗ ██╗    ██╗
       ██╔════╝██║     ██╔═══██╗██║    ██║
       █████╗  ██║     ██║   ██║██║ █╗ ██║
       ██╔══╝  ██║     ██║   ██║██║███╗██║
       ██║     ███████╗╚██████╔╝╚███╔███╔╝
       ╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝ `}
            </pre>
            
            {/* System messages */}
            <div className="font-mono text-xs space-y-1 mb-6 text-muted-foreground">
              <p>{'>'} SYSTEM BOOT SEQUENCE COMPLETE</p>
              <p>{'>'} INITIALIZING SECURITY PROTOCOL...</p>
              <p>{'>'} AWAITING AUTHENTICATION</p>
              <p className="text-accent">{'>'} ENTER ACCESS CODE_<span style={{ animation: 'blink 1s infinite' }}>█</span></p>
            </div>
            
            {/* Login form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="font-mono text-xs text-muted-foreground block mb-2">
                  PASSWORD://
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-background border border-border px-4 py-3 font-mono text-sm focus:outline-none focus:border-accent transition-colors"
                  placeholder="••••••••"
                  autoFocus
                  disabled={loading}
                />
              </div>
              
              {error && (
                <div 
                  className="font-mono text-xs text-destructive border border-destructive/30 bg-destructive/10 px-4 py-2"
                  style={{ animation: 'glitch 0.3s ease' }}
                >
                  ⚠ {error}
                </div>
              )}
              
              <button
                type="submit"
                disabled={loading || !password}
                className="w-full border border-accent bg-accent/10 text-accent font-mono text-sm py-3 hover:bg-accent hover:text-background transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-pulse">AUTHENTICATING</span>
                    <span style={{ animation: 'blink 0.5s infinite' }}>...</span>
                  </span>
                ) : (
                  '[AUTHENTICATE]'
                )}
              </button>
            </form>
            
            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-border">
              <p className="font-mono text-xs text-muted-foreground text-center">
                SECURE CONNECTION • TLS 1.3 ENCRYPTED
              </p>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -top-4 -left-4 w-8 h-8 border-l-2 border-t-2 border-accent/30" />
        <div className="absolute -top-4 -right-4 w-8 h-8 border-r-2 border-t-2 border-accent/30" />
        <div className="absolute -bottom-4 -left-4 w-8 h-8 border-l-2 border-b-2 border-accent/30" />
        <div className="absolute -bottom-4 -right-4 w-8 h-8 border-r-2 border-b-2 border-accent/30" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="font-mono text-sm text-muted-foreground">Loading...</div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}








