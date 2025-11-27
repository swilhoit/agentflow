import { logger } from './logger';

/**
 * Intent Classifier
 * Quickly determines if a message is conversational or an actionable task
 * Uses pattern matching for speed (no AI call needed for common cases)
 */

export type MessageIntent = 
  | 'greeting'           // "hello", "hi", "hey"
  | 'farewell'           // "bye", "goodbye", "see you"
  | 'gratitude'          // "thanks", "thank you"
  | 'affirmation'        // "yes", "ok", "sure", "sounds good"
  | 'negation'           // "no", "nope", "cancel"
  | 'small_talk'         // "how are you", "what's up"
  | 'agent_question'     // "what can you do", "who are you"
  | 'clarification'      // "what?", "huh?", "can you repeat"
  | 'task';              // Everything else - actual work to do

export interface ClassificationResult {
  intent: MessageIntent;
  confidence: 'high' | 'medium' | 'low';
  shouldExecuteTask: boolean;
  suggestedResponse?: string;
  reasoning: string;
}

// Common greeting patterns
const GREETING_PATTERNS = [
  /^(hi|hey|hello|yo|sup|hiya|howdy|greetings)[\s!.,?]*$/i,
  /^(good\s*(morning|afternoon|evening|night))[\s!.,?]*$/i,
  /^(what'?s?\s*up|wassup|wazzup)[\s!.,?]*$/i,
];

// Farewell patterns
const FAREWELL_PATTERNS = [
  /^(bye|goodbye|see\s*ya|later|cya|peace|ttyl|take\s*care)[\s!.,?]*$/i,
  /^(good\s*night|gn|have\s*a\s*good\s*(one|day|night))[\s!.,?]*$/i,
];

// Gratitude patterns
const GRATITUDE_PATTERNS = [
  /^(thanks|thank\s*you|thx|ty|appreciate\s*it|cheers)[\s!.,?]*$/i,
  /^(thanks\s*(a\s*lot|so\s*much|buddy|man|dude))[\s!.,?]*$/i,
];

// Affirmation patterns
const AFFIRMATION_PATTERNS = [
  /^(yes|yeah|yep|yup|ok|okay|sure|alright|sounds\s*good|perfect|great|cool|nice|awesome|got\s*it)[\s!.,?]*$/i,
  /^(right|correct|exactly|absolutely|definitely)[\s!.,?]*$/i,
];

// Negation patterns
const NEGATION_PATTERNS = [
  /^(no|nope|nah|never\s*mind|nevermind|cancel|stop|forget\s*it|don'?t)[\s!.,?]*$/i,
];

// Small talk patterns
const SMALL_TALK_PATTERNS = [
  /^how\s*(are\s*you|'?s\s*it\s*going|you\s*doing|have\s*you\s*been)[\s!.,?]*$/i,
  /^what'?s\s*(going\s*on|new|happening)[\s!.,?]*$/i,
  /^you\s*(good|okay|alright)[\s!.,?]*$/i,
];

// Agent meta-questions
const AGENT_QUESTION_PATTERNS = [
  /^(who|what)\s*(are\s*you|is\s*this)[\s!.,?]*$/i,
  /^what\s*(can\s*you\s*do|are\s*you(r)?\s*capabilities|do\s*you\s*do)[\s!.,?]*$/i,
  /^(help|help\s*me|what\s*commands)[\s!.,?]*$/i,
  /^(are\s*you\s*(a\s*bot|an?\s*ai|real))[\s!.,?]*$/i,
];

// Clarification patterns
const CLARIFICATION_PATTERNS = [
  /^(what|huh|sorry|pardon|excuse\s*me)[\s!.,?]*$/i,
  /^(can\s*you\s*(repeat|say\s*that\s*again|explain))[\s!.,?]*$/i,
  /^(i\s*don'?t\s*(understand|get\s*it))[\s!.,?]*$/i,
];

// Task indicators - if these appear, it's likely a task
const TASK_INDICATORS = [
  // Action verbs
  'create', 'make', 'build', 'add', 'remove', 'delete', 'update', 'modify', 'change',
  'deploy', 'start', 'stop', 'restart', 'run', 'execute', 'install', 'setup',
  'clone', 'push', 'pull', 'commit', 'merge', 'check', 'analyze', 'find', 'search',
  'list', 'show', 'display', 'get', 'fetch', 'send', 'move', 'copy', 'rename',
  // Objects
  'file', 'folder', 'directory', 'repo', 'repository', 'server', 'container',
  'card', 'board', 'task', 'issue', 'branch', 'project', 'workspace',
  'database', 'table', 'function', 'endpoint', 'api',
];

// Conversational responses
const RESPONSES: Record<MessageIntent, string[]> = {
  greeting: [
    "Hey! 👋 What can I help you with today?",
    "Hello! Ready to help. What do you need?",
    "Hi there! What would you like me to do?",
    "Hey! I'm here and ready. What's the task?",
  ],
  farewell: [
    "Goodbye! Let me know if you need anything else. 👋",
    "See you later! I'll be here when you need me.",
    "Take care! Come back anytime.",
  ],
  gratitude: [
    "You're welcome! Let me know if you need anything else.",
    "Happy to help! Anything else?",
    "No problem! I'm here if you need more help.",
  ],
  affirmation: [
    "Got it! What would you like me to do?",
    "Okay! Ready when you are - just tell me what you need.",
    "Sure thing! What's the task?",
  ],
  negation: [
    "No worries! Let me know if you change your mind or need something else.",
    "Okay, cancelled. What else can I help with?",
    "Understood. I'm here when you're ready.",
  ],
  small_talk: [
    "I'm doing great, thanks for asking! 🤖 Ready to help with any tasks you have.",
    "All good here! What can I do for you today?",
    "Running smoothly! Got something for me to work on?",
  ],
  agent_question: [
    "I'm your AI assistant! I can help you with:\n" +
    "• **Git/GitHub** - Clone repos, create branches, push code\n" +
    "• **Trello** - Manage boards, cards, and tasks\n" +
    "• **Deployment** - Deploy to Hetzner or Vercel\n" +
    "• **Containers** - Manage Docker containers\n" +
    "• **General tasks** - Run commands, manage files\n\n" +
    "Just tell me what you need!",
  ],
  clarification: [
    "Could you tell me more about what you'd like me to do?",
    "I want to make sure I understand - what would you like me to help with?",
    "Let me know what task you have in mind and I'll get right on it!",
  ],
  task: [], // Tasks don't get canned responses
};

export class IntentClassifier {
  /**
   * Classify a message's intent
   */
  static classify(message: string): ClassificationResult {
    const trimmed = message.trim();
    const lower = trimmed.toLowerCase();
    
    // Empty or very short messages
    if (trimmed.length === 0) {
      return {
        intent: 'clarification',
        confidence: 'high',
        shouldExecuteTask: false,
        suggestedResponse: this.getRandomResponse('clarification'),
        reasoning: 'Empty message',
      };
    }

    // Check each pattern category in order of specificity
    
    // Greetings
    if (GREETING_PATTERNS.some(p => p.test(trimmed))) {
      return {
        intent: 'greeting',
        confidence: 'high',
        shouldExecuteTask: false,
        suggestedResponse: this.getRandomResponse('greeting'),
        reasoning: 'Matched greeting pattern',
      };
    }

    // Farewells
    if (FAREWELL_PATTERNS.some(p => p.test(trimmed))) {
      return {
        intent: 'farewell',
        confidence: 'high',
        shouldExecuteTask: false,
        suggestedResponse: this.getRandomResponse('farewell'),
        reasoning: 'Matched farewell pattern',
      };
    }

    // Gratitude
    if (GRATITUDE_PATTERNS.some(p => p.test(trimmed))) {
      return {
        intent: 'gratitude',
        confidence: 'high',
        shouldExecuteTask: false,
        suggestedResponse: this.getRandomResponse('gratitude'),
        reasoning: 'Matched gratitude pattern',
      };
    }

    // Affirmations
    if (AFFIRMATION_PATTERNS.some(p => p.test(trimmed))) {
      return {
        intent: 'affirmation',
        confidence: 'high',
        shouldExecuteTask: false,
        suggestedResponse: this.getRandomResponse('affirmation'),
        reasoning: 'Matched affirmation pattern',
      };
    }

    // Negations
    if (NEGATION_PATTERNS.some(p => p.test(trimmed))) {
      return {
        intent: 'negation',
        confidence: 'high',
        shouldExecuteTask: false,
        suggestedResponse: this.getRandomResponse('negation'),
        reasoning: 'Matched negation pattern',
      };
    }

    // Small talk
    if (SMALL_TALK_PATTERNS.some(p => p.test(trimmed))) {
      return {
        intent: 'small_talk',
        confidence: 'high',
        shouldExecuteTask: false,
        suggestedResponse: this.getRandomResponse('small_talk'),
        reasoning: 'Matched small talk pattern',
      };
    }

    // Agent questions
    if (AGENT_QUESTION_PATTERNS.some(p => p.test(trimmed))) {
      return {
        intent: 'agent_question',
        confidence: 'high',
        shouldExecuteTask: false,
        suggestedResponse: this.getRandomResponse('agent_question'),
        reasoning: 'Matched agent meta-question pattern',
      };
    }

    // Clarifications
    if (CLARIFICATION_PATTERNS.some(p => p.test(trimmed))) {
      return {
        intent: 'clarification',
        confidence: 'high',
        shouldExecuteTask: false,
        suggestedResponse: this.getRandomResponse('clarification'),
        reasoning: 'Matched clarification pattern',
      };
    }

    // Check for task indicators
    const hasTaskIndicator = TASK_INDICATORS.some(indicator => 
      lower.includes(indicator)
    );

    // Short messages without task indicators are likely conversational
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount <= 3 && !hasTaskIndicator) {
      // Could be a short question or casual message
      return {
        intent: 'clarification',
        confidence: 'medium',
        shouldExecuteTask: false,
        suggestedResponse: "I'm not sure what you mean. Could you give me a bit more detail about what you'd like me to do?",
        reasoning: 'Short message without task indicators',
      };
    }

    // If it has task indicators or is long enough, treat as task
    return {
      intent: 'task',
      confidence: hasTaskIndicator ? 'high' : 'medium',
      shouldExecuteTask: true,
      reasoning: hasTaskIndicator 
        ? 'Contains task action keywords' 
        : 'Longer message likely describing a task',
    };
  }

  /**
   * Quick check if message is conversational (no AI call needed)
   */
  static isConversational(message: string): boolean {
    const result = this.classify(message);
    return !result.shouldExecuteTask;
  }

  /**
   * Get a random response for an intent
   */
  private static getRandomResponse(intent: MessageIntent): string {
    const responses = RESPONSES[intent];
    if (!responses || responses.length === 0) {
      return "What can I help you with?";
    }
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * For debugging/logging
   */
  static getClassificationSummary(message: string): string {
    const result = this.classify(message);
    return `Intent: ${result.intent} (${result.confidence} confidence) - ${result.reasoning}`;
  }
}


