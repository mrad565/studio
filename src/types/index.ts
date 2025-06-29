export interface Pattern {
  id: string;
  name: string;
  patternData: boolean[][];
  source: 'text' | 'image' | 'svg';
  promptOrFile?: string;
}
