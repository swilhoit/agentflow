import { SmartIterationCalculator } from '../../src/utils/smartIterationCalculator';

describe('SmartIterationCalculator', () => {
  it('should return high confidence and low iterations for simple tasks', () => {
    const result = SmartIterationCalculator.calculate('list files');
    expect(result.confidence).toBe('high');
    expect(result.recommended).toBeLessThanOrEqual(5);
  });

  it('should return lower confidence and more iterations for complex tasks', () => {
    // Using "and then" to trigger complex task logic
    const result = SmartIterationCalculator.calculate('create a react app and then deploy it to vercel and then run tests');
    expect(result.recommended).toBeGreaterThan(10);
    expect(result.confidence).toBe('medium');
  });

  it('should handle empty input gracefully', () => {
    const result = SmartIterationCalculator.calculate('');
    expect(result.confidence).toBe('low'); // Default fallthrough is low confidence
    expect(result.recommended).toBe(8);
  });
});
