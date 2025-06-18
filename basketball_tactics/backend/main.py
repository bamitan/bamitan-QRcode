"""FastAPI サービス:
 - /frames エンドポイントでフレームデータを受け取り PlayerPosition を返す
 - /videos/file, /videos/url で動画取込
 - /jobs/{job_id} でジョブ進捗確認
 - /ws/positions WebSocket でリアルタイム位置を配信 (未実装)
"""
from typing import List
from fastapi import FastAPI, WebSocket, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import time
import boto3
from botocore.exceptions import BotoCoreError, ClientError
import yt_dlp as ydl
import uuid
import os
import shutil

from .court_coordinate import CourtCoordinateSystem

app = FastAPI(title="Basketball Tactical Backend", version="0.1.0")

# -----------------------------
# Pydantic models
# -----------------------------
class PlayerPosition(BaseModel):
    playerId: str
    courtX: float  # -47 ~ +47 (feet)
    courtY: float  # -25 ~ +25 (feet)
    timestamp: float
    team: str  # 'home' | 'away'
    role: str  # 'PG' | 'SG' | 'SF' | 'PF' | 'C'

class FrameData(BaseModel):
    timestamp: float
    # 将来的に base64 画像や検出結果を追加
    detections: List[dict] = []

class VideoURL(BaseModel):
    url: str

import logging

logger = logging.getLogger("tactics-backend")
logger.setLevel(logging.INFO)

TEMP_DIR = "tmp"
os.makedirs(TEMP_DIR, exist_ok=True)

# -----------------------------
# Core instances
# -----------------------------
coordinate_system = CourtCoordinateSystem()

# Serve static front-end
dist_dir = os.path.join(os.path.dirname(__file__), "../frontend")
app.mount("/", StaticFiles(directory=os.path.abspath(dist_dir), html=True), name="frontend")

# -----------------------------
# REST Endpoints
# -----------------------------
@app.post("/frames", response_model=List[PlayerPosition])
async def process_frame(data: FrameData):
    """フレーム単位で呼び出される。CV パイプライン → コート座標化 → プレイヤー位置返却"""
    player_positions: List[PlayerPosition] = []
    # TODO: YOLO + DeepSORT による実装。ここではダミー返却。
    current_time = data.timestamp or time.time()
    for idx in range(10):
        pos = coordinate_system.convert_to_court_coordinates(0, 0)  # ダミー
        player_positions.append(
            PlayerPosition(
                playerId=f"p{idx}",
                courtX=pos["x"],
                courtY=pos["y"],
                timestamp=current_time,
                team="home" if idx < 5 else "away",
                role=["PG", "SG", "SF", "PF", "C"][idx % 5],
            )
        )
    return player_positions

# -----------------------------
# Ingest Endpoints
# -----------------------------
@app.post("/videos/file")
async def upload_video(file: UploadFile = File(...)):
    """動画ファイルを受け取り、一旦ローカル tmp へ保存（今後 S3 へアップロード予定）"""
    ext = os.path.splitext(file.filename)[1]
    key = f"{uuid.uuid4()}{ext}"
    local_path = os.path.join(TEMP_DIR, key)
    with open(local_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    job_id = str(uuid.uuid4())
    return {"video_key": key, "job_id": job_id}

@app.post("/videos/url")
async def ingest_url(body: VideoURL):
    """URL（YouTube など）を受け取り、サーバ側でダウンロード→S3→AWS Batch ジョブ起動"""
    aws_bucket = os.getenv("TACTICS_RAW_BUCKET")
    batch_queue = os.getenv("TACTICS_BATCH_QUEUE")
    batch_job_def = os.getenv("TACTICS_JOB_DEFINITION")
    if not all([aws_bucket, batch_queue, batch_job_def]):
        raise HTTPException(status_code=500, detail="AWS env vars not set (TACTICS_RAW_BUCKET, TACTICS_BATCH_QUEUE, TACTICS_JOB_DEFINITION)")

    # 1. yt-dlp でダウンロード
    video_uuid = str(uuid.uuid4())
    local_path = os.path.join(TEMP_DIR, f"{video_uuid}.mp4")
    ydl_opts = {
        "outtmpl": local_path,
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4",
        "merge_output_format": "mp4",
        "quiet": True,
    }
    try:
        with ydl.YoutubeDL(ydl_opts) as downloader:
            downloader.download([body.url])
    except Exception as e:
        logger.error("yt-dlp download failed: %s", e)
        raise HTTPException(status_code=400, detail="Download failed")

    # 2. S3 へアップロード
    s3_key = f"raw/{video_uuid}.mp4"
    s3 = boto3.client("s3")
    try:
        s3.upload_file(local_path, aws_bucket, s3_key)
    except (BotoCoreError, ClientError) as e:
        logger.error("S3 upload failed: %s", e)
        raise HTTPException(status_code=500, detail="S3 upload failed")
    finally:
        # 保存容量節約のためローカル削除
        try:
            os.remove(local_path)
        except FileNotFoundError:
            pass

    # 3. AWS Batch ジョブ起動
    batch = boto3.client("batch")
    try:
        resp = batch.submit_job(
            jobName=f"tactics-{video_uuid}",
            jobQueue=batch_queue,
            jobDefinition=batch_job_def,
            containerOverrides={
                "environment": [
                    {"name": "INPUT_S3_KEY", "value": s3_key},
                    {"name": "OUTPUT_PREFIX", "value": f"results/{video_uuid}/"},
                ]
            },
        )
        job_id = resp["jobId"]
    except (BotoCoreError, ClientError) as e:
        logger.error("Batch submit failed: %s", e)
        raise HTTPException(status_code=500, detail="Batch submit failed")

    return {"video_key": s3_key, "job_id": job_id}

@app.get("/jobs/{job_id}")
async def job_status(job_id: str):
    """AWS Batch ジョブのステータスと S3 SVG 結果一覧を返す"""
    batch = boto3.client("batch")
    try:
        resp = batch.describe_jobs(jobs=[job_id])
    except (BotoCoreError, ClientError):
        raise HTTPException(status_code=404, detail="Job not found")
    if not resp["jobs"]:
        raise HTTPException(status_code=404, detail="Job not found")
    job = resp["jobs"][0]
    status = job["status"]
    result = {"job_id": job_id, "status": status}

    # If done, list SVGs
    if status == "SUCCEEDED":
        job_name = job.get("jobName", "")  # tactics-<uuid>
        if job_name.startswith("tactics-"):
            uuid_part = job_name.split("tactics-")[-1]
            prefix = f"results/{uuid_part}/svg/"
            bucket = os.getenv("TACTICS_RESULT_BUCKET", os.getenv("TACTICS_RAW_BUCKET"))
            s3 = boto3.client("s3")
            objects = s3.list_objects_v2(Bucket=bucket, Prefix=prefix).get("Contents", [])
            svg_keys = [obj["Key"] for obj in objects if obj["Key"].endswith(".svg")]
            # presign
            svg_urls = [
                s3.generate_presigned_url(
                    "get_object", Params={"Bucket": bucket, "Key": k}, ExpiresIn=3600
                )
                for k in svg_keys
            ]
            result["svg_urls"] = svg_urls
    return result

# -----------------------------
# WebSocket Endpoint (dummy)
# -----------------------------
@app.websocket("/ws/positions")
async def websocket_positions(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            msg = await ws.receive_text()
            await ws.send_text(msg)
    except Exception:
        await ws.close()

# -----------------------------
# Run helper (for `python -m ...`)
# -----------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("basketball_tactics.backend.main:app", host="0.0.0.0", port=8000, reload=True)
