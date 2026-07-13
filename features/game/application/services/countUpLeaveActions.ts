import type { CountUpGameState } from '../../domain/countUp';

export type CountUpLeaveChoiceId = 'pause_to_hub' | 'continue_game' | 'abort_to_hub';

export type CountUpLeaveChoice = {
  id: CountUpLeaveChoiceId;
  label: string;
  style?: 'cancel' | 'destructive';
  run: () => Promise<void>;
};

type CountUpLeaveActionsInput = {
  gameId: string;
  countUp: {
    pauseGame(gameId: string): Promise<CountUpGameState>;
    abortGame(gameId: string): Promise<void>;
  };
  navigateToGameHub: () => void;
};

export function createCountUpLeaveChoices({
  gameId,
  countUp,
  navigateToGameHub,
}: CountUpLeaveActionsInput): CountUpLeaveChoice[] {
  return [
    {
      id: 'pause_to_hub',
      label: '一時停止してゲームハブへ戻る',
      run: async () => {
        await countUp.pauseGame(gameId);
        navigateToGameHub();
      },
    },
    {
      id: 'continue_game',
      label: 'ゲームを続ける',
      style: 'cancel',
      run: async () => {},
    },
    {
      id: 'abort_to_hub',
      label: '途中終了する',
      style: 'destructive',
      run: async () => {
        await countUp.abortGame(gameId);
        navigateToGameHub();
      },
    },
  ];
}
