import { parseJsonResponse } from '../../lib/parse-json-response';

describe('parseJsonResponse', () => {
  it('parses plain JSON with no fence', () => {
    expect(parseJsonResponse('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips a ```json fenced block before parsing', () => {
    const raw = '```json\n{"a":1}\n```';
    expect(parseJsonResponse(raw)).toEqual({ a: 1 });
  });

  it('strips a fenced block with no language tag', () => {
    const raw = '```\n{"a":1}\n```';
    expect(parseJsonResponse(raw)).toEqual({ a: 1 });
  });

  it('strips a fenced block with surrounding prose', () => {
    const raw = 'Here you go:\n```json\n{"a":1}\n```\nHope that helps!';
    expect(parseJsonResponse(raw)).toEqual({ a: 1 });
  });

  it('parses JSON arrays', () => {
    expect(parseJsonResponse('```json\n[1,2,3]\n```')).toEqual([1, 2, 3]);
  });
});
