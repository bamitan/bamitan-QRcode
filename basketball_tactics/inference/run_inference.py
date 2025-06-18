"""GPU inference pipeline for Basketball Tactics.
Environment variables provided by Batch:
INPUT_S3_KEY  – s3 key of raw mp4
OUTPUT_PREFIX – s3 prefix to store results (e.g. results/<uuid>/)
"""
import os
import json
import tempfile
import boto3
from pathlib import Path
import cv2
from ultralytics import YOLO
from deep_sort_realtime.deepsort_tracker import DeepSort
import svgwrite

RAW_BUCKET = os.getenv("TACTICS_RAW_BUCKET")
RESULT_BUCKET = os.getenv("TACTICS_RESULT_BUCKET", RAW_BUCKET)
INPUT_KEY = os.getenv("INPUT_S3_KEY")
OUTPUT_PREFIX = os.getenv("OUTPUT_PREFIX")

assert INPUT_KEY and OUTPUT_PREFIX, "Environment vars missing"

s3 = boto3.client("s3")

def download_video(tmp_dir: Path) -> Path:
    local = tmp_dir / "input.mp4"
    s3.download_file(RAW_BUCKET, INPUT_KEY, str(local))
    return local

def upload_json(obj: dict, key: str):
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".json")
    json.dump(obj, tmp)
    tmp.flush()
    s3.upload_file(tmp.name, RESULT_BUCKET, key)

def upload_text(text: str, key: str):
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
    tmp.write(text.encode("utf-8"))
    tmp.flush()
    s3.upload_file(tmp.name, RESULT_BUCKET, key)


def main():
    with tempfile.TemporaryDirectory() as td:
        tmp_dir = Path(td)
        video_path = download_video(tmp_dir)

        cap = cv2.VideoCapture(str(video_path))
        model = YOLO("yolov8n.pt")  # small model; fine-tune for players
        tracker = DeepSort(max_age=30)

        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1920
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 1080
        interval = int(fps * 2)  # 2-second step
        frame_idx = 0
        summary_idx = 0
        players_history = {}

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            detections = model(frame, imgsz=640, verbose=False)[0]
            bbox_xyxy = detections.boxes.xyxy.cpu().numpy()
            confs = detections.boxes.conf.cpu().numpy()
            cls = detections.boxes.cls.cpu().numpy()
            # class 0: person, 32: sports ball (COCO)
            filtered = [i for i, c in enumerate(cls) if c in (0, 32) and confs[i] > 0.3]
            dets = bbox_xyxy[filtered]
            confs_f = confs[filtered]
            outputs = tracker.update_tracks(dets, confs_f, frame)

            instant = []
            for t in outputs:
                if not t.is_confirmed():
                    continue
                x1, y1, x2, y2 = t.to_tlbr()
                cx = (x1 + x2) / 2
                cy = (y1 + y2) / 2
                instant.append({"id": t.track_id, "cx": cx, "cy": cy})
                players_history.setdefault(t.track_id, []).append((frame_idx, cx, cy))

            # summary every interval
            if frame_idx % interval == 0:
                summary_key = f"{OUTPUT_PREFIX}summary_{summary_idx}.json"
                upload_json({"frame": frame_idx, "players": instant}, summary_key)

                # generate SVG
                svg = svgwrite.Drawing(size=(500, 300))
                # court background
                svg.add(svg.rect(insert=(0,0), size=(500,300), fill="#fdf8ee", stroke="#333", stroke_width=2))
                svg.add(svg.rect(insert=(10,10), size=(480,280), fill="none", stroke="#333", stroke_width=2))
                svg.add(svg.line(start=(250,10), end=(250,290), stroke="#333", stroke_width=2))
                svg.add(svg.circle(center=(250,150), r=60, fill="none", stroke="#333", stroke_width=2))
                # players
                for p in instant:
                    sx = p["cx"] / width * 500
                    sy = p["cy"] / height * 300
                    color = "#ff5733" if p["id"] == 0 else "#0099ff"
                    svg.add(svg.circle(center=(sx,sy), r=8, fill=color))
                svg_key = f"{OUTPUT_PREFIX}svg/frame_{summary_idx}.svg"
                upload_text(svg.tostring(), svg_key)

                summary_idx += 1

            frame_idx += 1

        # flag completion
        upload_json({"status": "DONE"}, f"{OUTPUT_PREFIX}_complete.json")

if __name__ == "__main__":
    main()
