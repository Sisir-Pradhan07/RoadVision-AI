from pathlib import Path
import shutil
import uuid

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from src.detection.predict import predict_image
from src.detection.video_predict import analyze_video


app = FastAPI(
    title="RoadVision AI",
    description="Intelligent Rural Road Condition & Infrastructure Monitoring System",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

OUTPUTS_DIR = Path("outputs")
OUTPUTS_DIR.mkdir(exist_ok=True)

app.mount(
    "/outputs",
    StaticFiles(directory=str(OUTPUTS_DIR)),
    name="outputs",
)


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "RoadVision AI",
    }


@app.post("/api/analyze/image")
async def analyze_image(file: UploadFile = File(...)):
    file_id = uuid.uuid4().hex
    file_path = UPLOAD_DIR / f"{file_id}_{file.filename}"

    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result, detections, health = predict_image(str(file_path))

    output_image = Path(result.save_dir) / file_path.name

    return {
    "filename": file.filename,
    "output_image": f"/outputs/predictions/{output_image.name}",
    "detections": detections,
    "health": health,
}

@app.post("/api/analyze/video")
async def analyze_video_endpoint(file: UploadFile = File(...)):
    file_id = uuid.uuid4().hex
    file_path = UPLOAD_DIR / f"{file_id}_{file.filename}"

    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = analyze_video(str(file_path))

    output_video = Path(result["output_video"])

    result["output_video"] = f"/outputs/videos/{output_video.name}"

    return result