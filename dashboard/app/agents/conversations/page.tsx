import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { db_queries_agents } from '@/lib/database-agents';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  ArrowLeft,
  User,
  Bot,
  Mic,
  FileText,
  Clock,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function formatTimeAgo(date: Date | string | null): string {
  if (!date) return 'Unknown';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}

function getMessageTypeIcon(type: string) {
  switch (type) {
    case 'voice_transcript':
      return <Mic className="w-4 h-4 text-purple-500" />;
    case 'agent_response':
      return <Bot className="w-4 h-4 text-blue-500" />;
    case 'system':
      return <FileText className="w-4 h-4 text-gray-500" />;
    default:
      return <User className="w-4 h-4 text-emerald-500" />;
  }
}

function getMessageTypeBadge(type: string) {
  switch (type) {
    case 'voice_transcript':
      return { label: 'Voice', variant: 'default' as const, className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' };
    case 'agent_response':
      return { label: 'Agent', variant: 'default' as const, className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' };
    case 'system':
      return { label: 'System', variant: 'secondary' as const, className: '' };
    default:
      return { label: 'User', variant: 'default' as const, className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
  }
}

export default async function ConversationsPage() {
  const conversations = await db_queries_agents.getAllConversations(200);

  // Group conversations by channel
  const conversationsByChannel = conversations.reduce((acc: Record<string, any[]>, conv: any) => {
    const channelId = conv.channel_id || 'unknown';
    if (!acc[channelId]) {
      acc[channelId] = [];
    }
    acc[channelId].push(conv);
    return acc;
  }, {});

  // Get conversation stats
  const stats = {
    total: conversations.length,
    voice: conversations.filter((c: any) => c.message_type === 'voice_transcript').length,
    agent: conversations.filter((c: any) => c.message_type === 'agent_response').length,
    user: conversations.filter((c: any) => c.message_type === 'text' || !c.message_type).length,
    channels: Object.keys(conversationsByChannel).length
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <Link href="/agents" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3">
            <ArrowLeft className="w-3 h-3" />
            Back to Agents
          </Link>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Conversations</h1>
              <p className="text-sm text-muted-foreground mt-1">
                All agent conversations and interactions
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <MessageSquare className="w-4 h-4" />
                <span className="text-xs font-medium">Total Messages</span>
              </div>
              <div className="text-3xl font-bold tabular-nums">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <User className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-medium">User Messages</span>
              </div>
              <div className="text-3xl font-bold tabular-nums text-emerald-500">{stats.user}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Bot className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium">Agent Responses</span>
              </div>
              <div className="text-3xl font-bold tabular-nums text-blue-500">{stats.agent}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Mic className="w-4 h-4 text-purple-500" />
                <span className="text-xs font-medium">Voice Transcripts</span>
              </div>
              <div className="text-3xl font-bold tabular-nums text-purple-500">{stats.voice}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Filter className="w-4 h-4" />
                <span className="text-xs font-medium">Channels</span>
              </div>
              <div className="text-3xl font-bold tabular-nums">{stats.channels}</div>
            </CardContent>
          </Card>
        </div>

        {/* Conversations List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Recent Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            {conversations.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No conversations recorded yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Conversations will appear here when agents interact with users
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conv: any, i: number) => {
                  const typeBadge = getMessageTypeBadge(conv.message_type);
                  const isAgentMessage = conv.message_type === 'agent_response';

                  return (
                    <div
                      key={conv.id || i}
                      className={cn(
                        "p-4 rounded-lg border border-border",
                        isAgentMessage ? "bg-blue-500/5 ml-8" : "bg-background"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {getMessageTypeIcon(conv.message_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2 mb-2">
                            <Badge variant="outline" className={cn("text-xs", typeBadge.className)}>
                              {typeBadge.label}
                            </Badge>
                            <span className="text-sm font-medium">
                              {conv.username || (isAgentMessage ? 'Agent' : 'Unknown User')}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTimeAgo(conv.timestamp)}
                            </span>
                            {conv.channel_id && (
                              <span className="text-xs text-muted-foreground">
                                #{conv.channel_id.slice(-6)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-foreground whitespace-pre-wrap">
                            {conv.message}
                          </p>
                          {conv.metadata && Object.keys(conv.metadata).length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                View metadata
                              </summary>
                              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                                {JSON.stringify(conv.metadata, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversations by Channel */}
        {Object.keys(conversationsByChannel).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="w-4 h-4" />
                By Channel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(conversationsByChannel).map(([channelId, messages]: [string, any]) => {
                  const latestMessage = messages[0];
                  const messageTypes = {
                    user: messages.filter((m: any) => m.message_type === 'text' || !m.message_type).length,
                    agent: messages.filter((m: any) => m.message_type === 'agent_response').length,
                    voice: messages.filter((m: any) => m.message_type === 'voice_transcript').length
                  };

                  return (
                    <div
                      key={channelId}
                      className="p-4 rounded-lg border border-border bg-background"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">#{channelId.slice(-8)}</span>
                        <Badge variant="secondary">{messages.length} messages</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-emerald-500" />
                          {messageTypes.user}
                        </span>
                        <span className="flex items-center gap-1">
                          <Bot className="w-3 h-3 text-blue-500" />
                          {messageTypes.agent}
                        </span>
                        {messageTypes.voice > 0 && (
                          <span className="flex items-center gap-1">
                            <Mic className="w-3 h-3 text-purple-500" />
                            {messageTypes.voice}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        Latest: {latestMessage?.message?.substring(0, 100)}...
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatTimeAgo(latestMessage?.timestamp)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
