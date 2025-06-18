"""CourtCoordinateSystem
   - ピクセル座標を NBA コート座標系 (feet) に変換するホモグラフィ簡易実装
   - 今後: キャリブレーションパラメータを外部ファイルから読み込み
"""
from typing import Dict

import numpy as np

class CourtCoordinateSystem:
    def __init__(self):
        # 仮のホモグラフィ行列 (3x3)。実プロジェクトではキャリブレーションで推定。
        self._H = np.array(
            [
                [0.0005, 0.0, -47],
                [0.0, 0.0005, -25],
                [0.0, 0.0, 1.0],
            ]
        )

    def convert_to_court_coordinates(self, pixel_x: float, pixel_y: float) -> Dict[str, float]:
        # ホモグラフィを用いた透視変換 (x', y', w')
        vec = np.array([pixel_x, pixel_y, 1.0])
        mapped = self._H @ vec
        if mapped[2] == 0:
            raise ValueError("Invalid homography (w=0)")
        x_ft = mapped[0] / mapped[2]
        y_ft = mapped[1] / mapped[2]

        # ゾーンの判定（簡易）
        zone = "perimeter"
        if abs(x_ft) < 16 and abs(y_ft) < 19:
            zone = "paint"
        elif abs(y_ft) > 22:
            zone = "backcourt"

        return {"x": x_ft, "y": y_ft, "zone": zone}
