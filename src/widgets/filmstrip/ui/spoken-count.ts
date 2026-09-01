/** Spoken caption under each frame ("One, e, &, a, Two…", §6.2). Only the
 *  numbers are spelled out; subdivision syllables are already words. */
const SPOKEN: Record<string, string> = {
  '1': 'One',
  '2': 'Two',
  '3': 'Three',
  '4': 'Four',
  '5': 'Five',
  '6': 'Six',
  '7': 'Seven',
  '8': 'Eight',
}

export function spokenCount(label: string): string {
  return SPOKEN[label] ?? label
}
