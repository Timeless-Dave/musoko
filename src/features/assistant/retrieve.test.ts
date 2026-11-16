import { describe, expect, it } from 'vitest';
import { answerQuestion } from './retrieve';

describe('assistant retrieve', () => {
  it('answers how to find food from the guide', () => {
    const { answer } = answerQuestion('How do I find food near me?');
    expect(answer.toLowerCase()).toContain('find food');
  });

  it('answers location privacy from the guide', () => {
    const { answer } = answerQuestion('Does Musoko show a farm street address?');
    expect(answer.toLowerCase()).toMatch(/street address|opt in|private/);
  });

  it('does not invent checkout', () => {
    const { answer } = answerQuestion('Where is the cart and checkout?');
    expect(answer.toLowerCase()).not.toMatch(/add to cart|pay now/);
  });
});