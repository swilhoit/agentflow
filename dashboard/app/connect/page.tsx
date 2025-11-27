'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface GuildInfo {
  guildId: string;
  guildName: string;
  memberCount?: number;
  icon?: string;
}

function ConnectServerPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const guildId = searchParams.get('guild');
  
  const [status, setStatus] = useState<'loading' | 'ready' | 'connecting' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [guildInfo, setGuildInfo] = useState<GuildInfo | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthAndGuild();
  }, [guildId]);

  const checkAuthAndGuild = async () => {
    try {
      // Check if user is authenticated
      const authRes = await fetch('/api/auth/session');
      const authData = await authRes.json();
      
      if (!authData.user) {
        // Redirect to login with return URL
        router.push(`/login?redirect=/connect?guild=${guildId}`);
        return;
      }
      
      setIsAuthenticated(true);

      if (!guildId) {
        setStatus('ready');
        return;
      }

      // Fetch guild info from our bot
      const guildRes = await fetch(`/api/discord/guild/${guildId}`);
      if (guildRes.ok) {
        const guild = await guildRes.json();
        setGuildInfo(guild);
      }
      
      // Check if already connected
      const connectionRes = await fetch(`/api/guilds/${guildId}`);
      if (connectionRes.ok) {
        const connection = await connectionRes.json();
        if (connection.isConnected) {
          setStatus('success');
          return;
        }
      }
      
      setStatus('ready');
    } catch (err) {
      console.error('Error checking auth/guild:', err);
      setStatus('error');
      setError('Failed to load page');
    }
  };

  const connectServer = async () => {
    if (!guildId) return;
    
    setStatus('connecting');
    setError(null);

    try {
      const res = await fetch('/api/guilds/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guildId,
          guildName: guildInfo?.guildName || `Server ${guildId}`,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to connect server');
      }

      setStatus('success');
    } catch (err: any) {
      setStatus('error');
      setError(err.message);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/70">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <span className="text-4xl">🤖</span>
          </div>
          <h1 className="text-3xl font-bold text-white">AgentFlow</h1>
          <p className="text-white/60 mt-2">Connect your Discord server</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20">
          
          {status === 'success' ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Server Connected!</h2>
              <p className="text-white/60 mb-6">
                {guildInfo?.guildName || 'Your server'} is now linked to your AgentFlow account.
              </p>
              <div className="space-y-3">
                <Link 
                  href="/settings/integrations"
                  className="block w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition"
                >
                  Configure Integrations
                </Link>
                <Link 
                  href="/dashboard"
                  className="block w-full py-3 px-4 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition"
                >
                  Go to Dashboard
                </Link>
              </div>
              <p className="text-white/40 text-sm mt-6">
                Now go back to Discord and try <code className="bg-white/10 px-2 py-0.5 rounded">!help</code>
              </p>
            </div>
          ) : status === 'error' ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Connection Failed</h2>
              <p className="text-red-400 mb-6">{error}</p>
              <button
                onClick={() => setStatus('ready')}
                className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition"
              >
                Try Again
              </button>
            </div>
          ) : !guildId ? (
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white mb-4">Add Bot to Server</h2>
              <p className="text-white/60 mb-6">
                First, add the AgentFlow bot to your Discord server, then come back here to complete the connection.
              </p>
              <a
                href={`https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID}&permissions=3147776&scope=bot%20applications.commands`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 px-4 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg font-medium transition"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
                  </svg>
                  Add to Discord
                </span>
              </a>
              <p className="text-white/40 text-sm mt-4">
                After adding, you'll be redirected back here automatically.
              </p>
            </div>
          ) : (
            <div>
              {/* Server Preview */}
              <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl mb-6">
                {guildInfo?.icon ? (
                  <img 
                    src={guildInfo.icon} 
                    alt={guildInfo.guildName} 
                    className="w-14 h-14 rounded-full"
                  />
                ) : (
                  <div className="w-14 h-14 bg-[#5865F2] rounded-full flex items-center justify-center">
                    <span className="text-white text-xl font-bold">
                      {(guildInfo?.guildName || 'S')[0]}
                    </span>
                  </div>
                )}
                <div>
                  <h3 className="text-white font-semibold">
                    {guildInfo?.guildName || `Server ${guildId.slice(0, 8)}...`}
                  </h3>
                  {guildInfo?.memberCount && (
                    <p className="text-white/50 text-sm">{guildInfo.memberCount} members</p>
                  )}
                </div>
              </div>

              <h2 className="text-xl font-semibold text-white mb-2">Connect This Server</h2>
              <p className="text-white/60 mb-6">
                Link this Discord server to your AgentFlow account to enable all features.
              </p>

              {/* What You Get */}
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">AI Agent Access</p>
                    <p className="text-white/50 text-xs">Claude-powered coding and task automation</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Financial Tracking</p>
                    <p className="text-white/50 text-xs">Connect your bank accounts securely</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Voice Commands</p>
                    <p className="text-white/50 text-xs">Talk to your AI assistant (Pro)</p>
                  </div>
                </div>
              </div>

              <button
                onClick={connectServer}
                disabled={status === 'connecting'}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'connecting' ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Connecting...
                  </span>
                ) : (
                  'Connect Server'
                )}
              </button>

              <p className="text-white/40 text-xs text-center mt-4">
                By connecting, you agree to our{' '}
                <Link href="/terms" className="underline hover:text-white/60">Terms of Service</Link>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-white/40 text-sm mt-6">
          Need help? <Link href="/help" className="text-purple-400 hover:text-purple-300">Contact Support</Link>
        </p>
      </div>
    </div>
  );
}

export default function ConnectServerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/70">Loading...</p>
        </div>
      </div>
    }>
      <ConnectServerPageContent />
    </Suspense>
  );
}








