import type { MatchGameServicePort } from './MatchGameServicePort';

export type MatchLeaveChoiceId = 'pause_to_hub' | 'continue_match' | 'abort_to_hub';

export type MatchLeaveChoice = {
  id: MatchLeaveChoiceId;
  label: string;
  style?: 'default' | 'cancel' | 'destructive';
  run: () => Promise<void>;
};

export function createMatchLeaveChoices(input: {
  matchId: string;
  match: Pick<MatchGameServicePort, 'pauseMatch' | 'abortMatch'>;
  navigateToGameHub: () => void;
}): MatchLeaveChoice[] {
  return [
    {
      id: 'pause_to_hub',
      label: '一時停止してゲームハブへ戻る',
      run: async () => {
        await input.match.pauseMatch(input.matchId);
        input.navigateToGameHub();
      },
    },
    {
      id: 'continue_match',
      label: 'ゲームを続ける',
      style: 'cancel',
      run: async () => {},
    },
    {
      id: 'abort_to_hub',
      label: '途中終了する',
      style: 'destructive',
      run: async () => {
        await input.match.abortMatch(input.matchId);
        input.navigateToGameHub();
      },
    },
  ];
}
