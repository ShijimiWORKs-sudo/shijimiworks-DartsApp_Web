import type { ZeroOneGameServicePort } from './ZeroOneGameServicePort';

export type ZeroOneLeaveChoiceId = 'pause_to_hub' | 'continue_game' | 'abort_to_hub';

export type ZeroOneLeaveChoice = {
  id: ZeroOneLeaveChoiceId;
  label: string;
  style?: 'default' | 'cancel' | 'destructive';
  run: () => Promise<void>;
};

export function createZeroOneLeaveChoices(input: {
  gameId: string;
  zeroOne: Pick<ZeroOneGameServicePort, 'pauseGame' | 'abortGame'>;
  navigateToGameHub: () => void;
}): ZeroOneLeaveChoice[] {
  return [
    {
      id: 'pause_to_hub',
      label: '一時停止してゲームハブへ戻る',
      run: async () => {
        await input.zeroOne.pauseGame(input.gameId);
        input.navigateToGameHub();
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
        await input.zeroOne.abortGame(input.gameId);
        input.navigateToGameHub();
      },
    },
  ];
}
