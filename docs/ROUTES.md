# Routes

Expo Router の画面一覧です。

| Route                              | 画面                     | 主な機能                                                           | 主な遷移先                                                                                                                     |
| ---------------------------------- | ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `/`                                | 初期設定                 | rating、level、machineType、mainProblems の保存                    | `/home`                                                                                                                        |
| `/home`                            | ホーム                   | プロフィール、今週の回数、おすすめ練習、分析サマリー、主要メニュー | `/practice`, `/records`, `/photo-score`, `/analysis`, `/consult`, `/consult/form-photo`, `/library`, `/favorites`, `/settings` |
| `/practice`                        | 今日の練習               | おすすめ練習、補助練習、フィルタ、お気に入り                       | `/practice/[id]`, `/record`                                                                                                    |
| `/practice/[id]`                   | 練習詳細                 | 手順、評価ポイント、関連資料、メニュー別履歴                       | `/record`, `/practice/[id]/records`, `/library/[id]`                                                                           |
| `/practice/[id]/records`           | メニュー別記録一覧       | 対象練習メニューの記録一覧                                         | `/records/[recordId]`, `/practice/[id]`                                                                                        |
| `/record`                          | 練習記録入力             | 練習メニュー検索/選択、手入力、写真スコア記録導線、記録保存        | `/analysis`, `/photo-score`                                                                                                    |
| `/photo-score`                     | 写真スコア開始           | 写真撮影/選択、対象ボード選択、基準画像ステータス                  | `/photo-score/calibrate`, `/photo-score/reference`, `/record`                                                                  |
| `/photo-score/reference`           | 基準ボード画像           | 空ボード基準画像の一覧、登録、撮り直し、削除                       | `/photo-score/reference/register`, `/photo-score`                                                                              |
| `/photo-score/reference/register`  | 基準画像登録             | 空ボード写真選択/撮影、中心/20方向/外周設定、撮影条件メモ保存      | `/photo-score/reference`, `/photo-score`                                                                                       |
| `/photo-score/calibrate`           | ボード設定               | 中心、20方向、外周半径の手動キャリブレーション                     | `/photo-score/mark`, `/photo-score`                                                                                            |
| `/photo-score/mark`                | 位置タップ               | 基準画像比較、候補選択、手動追加、ドラッグ微調整、スコア自動判定   | `/photo-score/result`, `/photo-score`                                                                                          |
| `/photo-score/result`              | 写真スコア結果           | 合計、Bull、Triple、Double、グルーピング分析、練習記録保存         | `/analysis`, `/photo-score/mark`, `/photo-score`                                                                               |
| `/records`                         | 練習記録一覧             | 全記録一覧、簡易集計、写真スコア記録導線                           | `/records/[id]`, `/record`, `/photo-score`                                                                                     |
| `/records/[id]`                    | 練習記録詳細             | 保存済み記録の詳細、編集、削除                                     | `/records/[id]/edit`, `/records`, `/analysis`                                                                                  |
| `/records/[id]/edit`               | 練習記録編集             | 既存記録の編集保存                                                 | `/records/[id]`                                                                                                                |
| `/analysis`                        | 分析                     | 期間別集計、グラフ風UI、改善コメント、おすすめ練習                 | `/practice/[id]`, `/record`, `/records`, `/consult`                                                                            |
| `/consult`                         | フォーム相談             | 固定ロジック相談、関連練習、関連資料、履歴保存                     | `/consult/form-photo`, `/consult/history`, `/practice/[id]`, `/record`, `/library/[id]`                                        |
| `/consult/form-photo`              | フォーム写真相談         | 3枚写真、自己チェック、直近写真スコア傾向から固定ロジック助言      | `/consult/form-photo/history`, `/practice/[id]`, `/record`, `/consult`                                                         |
| `/consult/form-photo/history`      | フォーム写真相談履歴     | 保存済みフォーム写真相談の一覧                                     | `/consult/form-photo/history/[id]`, `/consult/form-photo`                                                                      |
| `/consult/form-photo/history/[id]` | フォーム写真相談履歴詳細 | 相談結果、写真、自己チェック、関連練習、削除                       | `/practice/[id]`, `/record`, `/consult/form-photo/history`, `/consult/form-photo`                                              |
| `/consult/history`                 | 相談履歴一覧             | 保存済み相談の一覧                                                 | `/consult/history/[id]`, `/consult`                                                                                            |
| `/consult/history/[id]`            | 相談履歴詳細             | 回答詳細、関連練習、関連資料、削除                                 | `/practice/[id]`, `/record`, `/library/[id]`, `/consult/history`                                                               |
| `/library`                         | 資料ライブラリ           | 検索、カテゴリ/タグ絞り込み、関連練習フィルタ                      | `/library/[id]`, `/practice/[id]`                                                                                              |
| `/library/[id]`                    | 資料詳細                 | 記事本文、関連練習、関連相談、相談導線                             | `/practice/[id]`, `/consult`, `/library`                                                                                       |
| `/favorites`                       | お気に入り練習           | お気に入り登録済み練習メニュー一覧                                 | `/practice/[id]`, `/record`                                                                                                    |
| `/settings`                        | 設定編集                 | プロフィール再編集、表示テーマ、背景色、公開前情報                 | `/home`, `/legal/privacy`, `/legal/terms`, `/legal/credits`                                                                    |
| `/legal/privacy`                   | プライバシー             | 端末内保存、外部送信なし、今後の更新方針                           | `/settings`                                                                                                                    |
| `/legal/terms`                     | 利用規約                 | 一般情報、非公式アプリ、医療・専門指導ではない旨                   | `/settings`                                                                                                                    |
| `/legal/credits`                   | クレジット               | 開発、ロゴ、技術、公式素材不使用の明記                             | `/settings`                                                                                                                    |

## 共通導線

- BottomNav: `/home`, `/practice`, `/records`, `/analysis`, `/consult`
- 詳細画面は一覧または関連元へ戻るボタンを持つ
- 危険操作は確認ダイアログと赤系ボタンを使う
