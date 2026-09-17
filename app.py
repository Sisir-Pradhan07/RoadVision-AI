from pathlib import Path
import json
import shutil
import sqlite3
import uuid
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from reports.report_generator import generate_report
from src.detection.predict import predict_image
from src.detection.video_predict import analyze_video


app = FastAPI(
    title="RoadVision AI",
    description="Intelligent Rural Road Condition & Infrastructure Monitoring System",
    version="1.0.0",
)

app.mount(
    "/outputs",
    StaticFiles(directory="outputs"),
    name="outputs",
)

app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://road-vision-ai-beta.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

OUTPUTS_DIR = Path("outputs")
OUTPUTS_DIR.mkdir(exist_ok=True)

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

DATABASE_PATH = DATA_DIR / "roadvision.db"


app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOAD_DIR)),
    name="uploads",
)

app.mount(
    "/outputs",
    StaticFiles(directory=str(OUTPUTS_DIR)),
    name="outputs",
)


def init_database():
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS inspections (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                media_type TEXT NOT NULL,
                original_media TEXT NOT NULL,
                analyzed_media TEXT NOT NULL,
                road_name TEXT,
                location_name TEXT,
                report_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.commit()


init_database()


def save_public_inspection(
    *,
    inspection_id,
    filename,
    media_type,
    original_media,
    analyzed_media,
    road_name,
    location_name,
    report,
    created_at,
):
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.execute(
            """
            INSERT INTO inspections (
                id,
                filename,
                media_type,
                original_media,
                analyzed_media,
                road_name,
                location_name,
                report_json,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                inspection_id,
                filename,
                media_type,
                original_media,
                analyzed_media,
                road_name,
                location_name,
                json.dumps(report),
                created_at,
            ),
        )
        connection.commit()


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "RoadVision AI",
    }


@app.post("/api/analyze/image")
async def analyze_image(
    file: UploadFile = File(...),
    road_name: str = Form(""),
    location_name: str = Form(""),
):
    file_id = uuid.uuid4().hex
    safe_filename = Path(file.filename or "road_image").name
    file_path = UPLOAD_DIR / f"{file_id}_{safe_filename}"

    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result, detections, health = predict_image(
        str(file_path)
    )

    output_image = Path(result.save_dir) / file_path.name

    report = generate_report(
        detections=detections,
        health=health,
        image_name=safe_filename,
    )

    report["inspection"]["road_name"] = road_name
    report["inspection"]["location_name"] = location_name

    inspection_id = uuid.uuid4().hex
    created_at = report["inspection"]["date"]

    original_media = f"/uploads/{file_path.name}"
    analyzed_media = f"/outputs/predictions/{output_image.name}"

    save_public_inspection(
        inspection_id=inspection_id,
        filename=safe_filename,
        media_type="image",
        original_media=original_media,
        analyzed_media=analyzed_media,
        road_name=road_name,
        location_name=location_name,
        report=report,
        created_at=created_at,
    )

    return {
        "filename": safe_filename,
        "output_image": analyzed_media,
        "detections": detections,
        "health": health,
        "report": report,
        "inspection_id": inspection_id,
        "public_path": f"/analysis/{inspection_id}",
    }


@app.post("/api/analyze/video")
async def analyze_video_endpoint(
    file: UploadFile = File(...),
    road_name: str = Form(""),
    location_name: str = Form(""),
):
    file_id = uuid.uuid4().hex
    safe_filename = Path(file.filename or "road_video").name
    file_path = UPLOAD_DIR / f"{file_id}_{safe_filename}"

    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = analyze_video(
        str(file_path)
    )

    output_video = Path(
        result["output_video"]
    )

    result["output_video"] = (
        f"/outputs/videos/{output_video.name}"
    )

    report = generate_report(
        detections=result.get("detections", []),
        health=result["health"],
        image_name=safe_filename,
    )

    report["inspection"]["road_name"] = road_name
    report["inspection"]["location_name"] = location_name

    result["report"] = report

    inspection_id = uuid.uuid4().hex
    created_at = report["inspection"]["date"]

    original_media = f"/uploads/{file_path.name}"
    analyzed_media = result["output_video"]

    save_public_inspection(
        inspection_id=inspection_id,
        filename=safe_filename,
        media_type="video",
        original_media=original_media,
        analyzed_media=analyzed_media,
        road_name=road_name,
        location_name=location_name,
        report=report,
        created_at=created_at,
    )

    result["inspection_id"] = inspection_id
    result["public_path"] = f"/analysis/{inspection_id}"

    return result


@app.get("/api/public/inspection/{inspection_id}")
def get_public_inspection(inspection_id: str):
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.row_factory = sqlite3.Row

        row = connection.execute(
            """
            SELECT
                id,
                filename,
                media_type,
                original_media,
                analyzed_media,
                road_name,
                location_name,
                report_json,
                created_at
            FROM inspections
            WHERE id = ?
            """,
            (inspection_id,),
        ).fetchone()

    if row is None:
        return {
            "status": "not_found",
            "message": "Inspection not found.",
        }

    report = json.loads(row["report_json"])

    return {
        "status": "ok",
        "inspection": {
            "id": row["id"],
            "filename": row["filename"],
            "media_type": row["media_type"],
            "original_media": row["original_media"],
            "analyzed_media": row["analyzed_media"],
            "road_name": row["road_name"],
            "location_name": row["location_name"],
            "created_at": row["created_at"],
        },
        "report": report,
    }
