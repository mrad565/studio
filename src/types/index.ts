export interface Pattern {
  id: string;
  name: string;
  patternData: boolean[][];
  esp32Code: string;
  source: 'text' | 'image';
  promptOrFile?: string;
}
