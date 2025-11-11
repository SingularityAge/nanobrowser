import { describe, expect, it } from 'vitest';

import { extractJsonFromModelOutput } from '../messages/utils';

describe('extractJsonFromModelOutput', () => {
  it('parses JSON objects surrounded by explanatory text', () => {
    const content = "Here's what I found: {\"result\":{\"done\":false}}";

    expect(extractJsonFromModelOutput(content)).toEqual({ result: { done: false } });
  });

  it('parses JSON arrays when leading commentary is present', () => {
    const content = 'Analysis complete. ["step-one","step-two"]';

    expect(extractJsonFromModelOutput(content)).toEqual(['step-one', 'step-two']);
  });

  it('ignores braces inside string literals when locating balanced JSON', () => {
    const content = 'Summary: {"message":"Use braces like {this}"}';

    expect(extractJsonFromModelOutput(content)).toEqual({ message: 'Use braces like {this}' });
  });
});

