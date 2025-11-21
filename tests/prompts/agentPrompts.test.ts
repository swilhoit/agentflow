import { buildSystemPrompt } from '../../src/prompts/agentPrompts';

describe('Agent Prompts', () => {
  it('should generate a prompt with conversation history', () => {
    const context = {
      command: 'test command',
      conversationHistory: 'previous chat',
      hasTrello: false
    };
    const prompt = buildSystemPrompt(context);
    expect(prompt).toContain('previous chat');
    expect(prompt).toContain('test command');
  });

  it('should include Trello instructions if enabled', () => {
    const context = {
      command: 'test',
      conversationHistory: '',
      hasTrello: true
    };
    const prompt = buildSystemPrompt(context);
    expect(prompt).toContain('Trello REST API');
  });

  it('should exclude Trello instructions if disabled', () => {
    const context = {
      command: 'test',
      conversationHistory: '',
      hasTrello: false
    };
    const prompt = buildSystemPrompt(context);
    expect(prompt).not.toContain('Trello REST API');
  });
});

