import { MOCK_GPUS } from './mock-gpus';
import { mockRecommend } from './mock-recommendation';

describe('mockRecommend', () => {
  it('should recommend the cheapest GPU that fits a 7B LLM in inference', () => {
    const result = mockRecommend({ modelType: 'LLM', parametersBillions: 7, mode: 'INFERENCE', budgetPerHour: 2 }, MOCK_GPUS);
    expect(result.requiredVramGb).toBe(16.8);              // 7 × 2 × 1.2
    expect(result.recommendation?.gpu.name).toBe('NVIDIA RTX 4090');
    expect(result.recommendation?.gpuCount).toBe(1);
    expect(result.recommendation?.withinBudget).toBe(true);
    expect(result.alternatives.length).toBe(2);
  });

  it('should use several GPUs for a large model in training', () => {
    const result = mockRecommend({ modelType: 'LLM', parametersBillions: 13, mode: 'TRAINING', budgetPerHour: 40 }, MOCK_GPUS);
    expect(result.requiredVramGb).toBe(249.6);             // 13 × 16 × 1.2
    expect(result.recommendation?.gpuCount).toBeGreaterThan(1);
  });

  it('should flag the recommendation when nothing fits the budget', () => {
    const result = mockRecommend({ modelType: 'LLM', parametersBillions: 70, mode: 'INFERENCE', budgetPerHour: 0.5 }, MOCK_GPUS);
    expect(result.recommendation?.withinBudget).toBe(false);
    expect(result.explanation).toContain('No configuration fits your');
  });

  it('should return null when no configuration of up to 8 GPUs can hold the model', () => {
    const result = mockRecommend({ modelType: 'LLM', parametersBillions: 2000, mode: 'TRAINING', budgetPerHour: 40 }, MOCK_GPUS);
    expect(result.recommendation).toBeNull();
    expect(result.alternatives).toEqual([]);
  });
});
