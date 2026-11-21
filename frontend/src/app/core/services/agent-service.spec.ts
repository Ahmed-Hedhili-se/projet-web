import { parseSseBlock } from './agent-service';

describe('parseSseBlock', () => {
  it('should turn a block of the SSE stream into an event', () => {
    expect(
      parseSseBlock(
        'event: step\ndata: {"tool":"analyze_repo","label":"Analyzing github.com/acme/legal-llama"}',
      ),
    ).toEqual({
      event: 'step',
      data: { tool: 'analyze_repo', label: 'Analyzing github.com/acme/legal-llama' },
    });
  });

  it('should ignore an incomplete or unreadable block', () => {
    expect(parseSseBlock(': keep-alive')).toBeNull(); // commentaire SSE, sans événement
    expect(parseSseBlock('event: text\ndata: {not json')).toBeNull();
  });
});
