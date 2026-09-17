<div align="center">

# 🚧 RoadVision AI

### Intelligent Road Monitoring

**AI-powered rural road inspection, defect detection, and road-condition assessment from images and videos.**

<br>

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://road-vision-ai-beta.vercel.app)
[![API Docs](https://img.shields.io/badge/API%20Docs-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://roadvision-ai-backend-56c4.onrender.com/docs)
[![Backend](https://img.shields.io/badge/Backend-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://roadvision-ai-backend-56c4.onrender.com)
[![GitHub](https://img.shields.io/badge/Source-GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Sisir-Pradhan07/RoadVision-AI)

<br><br>

**Detect • Assess • Report • Improve**

</div>

---

## 🛣️ Overview

**RoadVision AI** is an AI-powered road inspection system designed to analyze road images and videos, detect visible road defects, assess road condition, and generate structured inspection insights.

The system combines computer vision, road-health assessment, geographic inspection mapping, reporting, inspection history, and public sharing into a single web-based platform.

> **Goal:** Transform road images and videos into useful inspection information that can support faster documentation and maintenance planning.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 📷 **Image Inspection** | Analyze road images for visible defects |
| 🎥 **Video Inspection** | Analyze road videos frame-by-frame |
| 🔎 **Defect Detection** | Detect five trained road-defect classes |
| 🧭 **Video Tracking** | Track detected objects across video frames |
| 📊 **Road Health Score** | Generate a 0–100 road-condition indicator |
| 🚦 **Severity Assessment** | Good, Moderate, Poor, or Critical |
| 🛠️ **Maintenance Priority** | Low, Medium, High, or Critical |
| 🗺️ **Inspection Map** | View inspections geographically |
| 📋 **Inspection Reports** | Generate structured inspection reports |
| 📄 **PDF Reports** | Download inspection reports as PDF |
| 🔗 **Public Inspection Links** | Share completed inspections |
| 📈 **Analytics** | View recent inspection statistics |
| 📚 **Inspection History** | Store recent inspection records |
| 📱 **Camera Capture** | Capture road photos and record videos |
| ⏳ **Progress Tracking** | Display upload/analysis progress |

---

## 🧠 AI Pipeline

```text
                 ROAD IMAGE / VIDEO
                         │
                         ▼
              ┌─────────────────────┐
              │  YOLO11s-based      │
              │  Trained Model      │
              └──────────┬──────────┘
                         │
                         ▼
                  ONNX Model Export
                         │
                         ▼
              ┌─────────────────────┐
              │    ONNX Runtime     │
              │ Production Inference│
              └──────────┬──────────┘
                         │
                ┌────────┴────────┐
                ▼                 ▼
         Defect Detection   Video Tracking
                │                 │
                └────────┬────────┘
                         ▼
              Road Health Assessment
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
          Health      Severity    Priority
           Score
              │
              ▼
       Reports • Map • History
              │
              ▼
         Public Sharing
```

---

## 🔍 Detected Road Defects

The current model contains **five road-defect classes**:

| Class | Description |
|---|---|
| **Longitudinal Crack** | Cracking mainly following the direction of the road |
| **Transverse Crack** | Cracking mainly crossing the direction of the road |
| **Alligator Crack** | Interconnected fatigue/cracking pattern |
| **Other Corruption** | Other visible road-surface deterioration represented in the training data |
| **Pothole** | Localized depression or hole in the road surface |

---

## 📊 Road Health Assessment

RoadVision AI generates a **Road Health Score from 0 to 100** based on detected road defects.

The prototype scoring system considers:

- Defect type
- Number of detections
- Detection confidence
- Defect-specific weighting
- Additional pothole weighting

### Severity

```text
Good
Moderate
Poor
Critical
```

### Maintenance Priority

```text
Low
Medium
High
Critical
```

The score is a **project-specific AI indicator** intended to support inspection and maintenance decisions. It is not a certified engineering road-condition rating.

---

## 🎯 Model Development

The model went through several development iterations.

| Version | Model | Epochs | mAP50 | mAP50-95 |
|---|---|---:|---:|---:|
| V1 | YOLO11n | 20 | Initial validation issue | Initial validation issue |
| V2 | YOLO11n | 50 | 0.297 | 0.130 |
| V3 | YOLO11s | 50 | 0.338 | 0.165 |
| **V4** | **YOLO11s** | **50** | **0.457** | **0.243** |

### V4 Validation Results

```text
Precision  : 0.544
Recall     : 0.467
mAP50      : 0.457
mAP50-95   : 0.243
```

The V4 validation run achieved approximately **0.757 mAP50 for pothole detection**.

> Validation performance does not guarantee identical performance on every real-world road image or video.

---

## ⚡ Production Optimization

The original development environment used the heavier:

```text
PyTorch
Ultralytics
YOLO model
```

For cloud deployment, the inference pipeline was optimized for a memory-constrained environment.

The trained model was exported to:

```text
models/detection/roadvision_v4.onnx
```

Production inference now uses:

```text
ONNX Runtime
```

instead of loading the full PyTorch inference stack.

### Development → Production

```text
YOLO11s Training
       │
       ▼
PyTorch / Ultralytics
       │
       ▼
Trained V4 Model
       │
       ▼
     ONNX
       │
       ▼
ONNX Runtime
       │
       ▼
Production Inference
```

This keeps the deployed backend lightweight while preserving the trained model.

---

## 🎥 Video Analysis

The production video pipeline performs:

```text
Video Upload
     ↓
Frame Extraction
     ↓
ONNX Detection
     ↓
IoU-based Object Tracking
     ↓
Defect Aggregation
     ↓
Road Health Assessment
     ↓
Annotated Video
```

The deployed version uses a **lightweight IoU-based tracker** instead of the original ByteTrack implementation to reduce production dependencies and resource usage.

---

## 🖥️ Inspection Workflow

```text
┌──────────────────────────┐
│ Upload / Capture Media   │
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ Add Road / Location      │
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ Start AI Inspection      │
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ Defect Detection         │
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ Health + Severity        │
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ Annotated Result         │
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ Report + Recommendation  │
└────────────┬─────────────┘
             ↓
     ┌───────┴────────┐
     ↓                ↓
  History          Public Link
     │
     ↓
    Map
```

---

## 🗺️ Inspection Map

Each inspection can contain:

- Road / Route
- Area / Village
- Latitude
- Longitude

RoadVision AI uses **Nominatim** for location lookup and **OpenStreetMap** for geographic visualization.

The map supports:

- Inspection markers
- Severity filtering
- Selected inspection focus
- Map reset
- Inspection count
- Road/location information

---

## 📋 Reports

Each inspection can generate structured information including:

- Inspection file
- Inspection date
- Road / route
- Area / village
- Road Health Score
- Severity
- Maintenance Priority
- Total defects
- Defect breakdown
- Detection confidence
- AI recommendation

Reports can be viewed directly inside the dashboard.

---

## 📄 PDF Reports

RoadVision AI can generate downloadable PDF inspection reports containing:

- Inspection details
- Road health
- Severity
- Maintenance priority
- Defect summary
- Detection confidence
- AI recommendation

---

## 🔗 Public Inspection Sharing

Completed inspections can be shared through a public inspection URL.

A public inspection page can display:

- Original media
- AI-analyzed media
- Road information
- Location
- Health Score
- Severity
- Maintenance Priority
- Defect breakdown
- Detection confidence
- Report download
- Analysis download
- Sharing options

Public route:

```text
/analysis/{inspection_id}
```

---

## 🧩 System Architecture

```text
┌───────────────────────────────────────────────┐
│               ROADVISION AI                  │
│                                               │
│ React + Vite Web Dashboard                   │
│                                               │
│ Upload • Camera • Map • History • Analytics  │
│ Reports • Public Sharing                     │
└───────────────────────┬───────────────────────┘
                        │
                        │ REST API
                        ▼
┌───────────────────────────────────────────────┐
│              FASTAPI BACKEND                  │
│                                               │
│ Image Analysis • Video Analysis               │
│ Public Inspection API                         │
└───────────────────────┬───────────────────────┘
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
     ┌────────────────┐   ┌────────────────┐
     │ Image Pipeline │   │ Video Pipeline │
     │                │   │                │
     │ ONNX Runtime   │   │ ONNX Runtime   │
     │ OpenCV         │   │ OpenCV         │
     └───────┬────────┘   │ IoU Tracker    │
             │            └───────┬────────┘
             └──────────┬─────────┘
                        ▼
              ┌────────────────────┐
              │ Road Health Engine │
              │                    │
              │ Score              │
              │ Severity           │
              │ Priority           │
              │ Defect Breakdown   │
              └─────────┬──────────┘
                        ▼
              ┌────────────────────┐
              │ Reports / History  │
              │ Map / Sharing      │
              └────────────────────┘
```

---

## 🛠️ Technology Stack

### Frontend

- React
- Vite
- JavaScript
- CSS
- Framer Motion
- Lucide React
- React Leaflet
- Leaflet
- Recharts
- jsPDF
- jspdf-autotable

### Backend

- Python
- FastAPI
- Uvicorn
- Pydantic
- OpenCV
- NumPy
- ONNX Runtime
- Pillow
- Pandas
- Scikit-learn
- Joblib

### AI / Computer Vision

- YOLO11s-based object detection
- PyTorch / Ultralytics for model training and development
- ONNX for production model format
- ONNX Runtime for production inference
- OpenCV for image/video processing
- Lightweight IoU-based object tracking

### Mapping

- OpenStreetMap
- Nominatim
- Leaflet
- React Leaflet

### Deployment

| Component | Platform |
|---|---|
| Frontend | Vercel |
| Backend | Render |
| Production Model | ONNX |
| Database | SQLite |

---

## 🚀 Live Deployment

### 🌐 Web Application

**RoadVision AI**

https://road-vision-ai-beta.vercel.app

### ⚙️ Backend

**FastAPI Backend**

https://roadvision-ai-backend-56c4.onrender.com

### 📚 API Documentation

**Swagger UI**

https://roadvision-ai-backend-56c4.onrender.com/docs

---

## 🔌 API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Backend health check |
| `POST` | `/api/analyze/image` | Analyze a road image |
| `POST` | `/api/analyze/video` | Analyze a road video |
| `GET` | `/api/public/inspection/{inspection_id}` | Retrieve public inspection |

Interactive API documentation:

```text
https://roadvision-ai-backend-56c4.onrender.com/docs
```

---

## 📁 Project Structure

```text
roadvision-ai/
│
├── dashboard/
│   ├── public/
│   │   └── roadvision-logo.png
│   │
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── ...
│   │
│   ├── index.html
│   ├── package.json
│   └── package-lock.json
│
├── src/
│   └── detection/
│       ├── predict.py
│       ├── video_predict.py
│       └── ...
│
├── models/
│   └── detection/
│       ├── roadvision_v4.pt
│       └── roadvision_v4.onnx
│
├── data/
│   ├── raw/
│   ├── processed/
│   └── roadvision.db
│
├── outputs/
│   ├── predictions/
│   └── videos/
│
├── uploads/
├── tests/
│
├── app.py
├── requirements.txt
├── build_v4_dataset.py
├── .gitignore
└── README.md
```

---

## 💻 Local Development

### 1. Clone the repository

```bash
git clone https://github.com/Sisir-Pradhan07/RoadVision-AI.git
cd RoadVision-AI
```

### 2. Create Python environment

Windows:

```cmd
python -m venv .venv
```

Activate:

```cmd
.venv\Scripts\activate
```

### 3. Install backend dependencies

```cmd
pip install -r requirements.txt
```

### 4. Start backend

```cmd
uvicorn app:app --reload
```

Backend:

```text
http://127.0.0.1:8000
```

Swagger:

```text
http://127.0.0.1:8000/docs
```

### 5. Install frontend dependencies

Open another terminal:

```cmd
cd dashboard
npm install
```

### 6. Start frontend

```cmd
npm run dev
```

Frontend:

```text
http://localhost:5173
```

---

## ⚙️ Environment Variable

Create:

```text
dashboard/.env
```

For local development:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

For production:

```env
VITE_API_BASE_URL=https://roadvision-ai-backend-56c4.onrender.com
```

---

## 📦 Production Optimization

The production backend was specifically optimized for a limited-memory cloud environment.

### Removed from production inference

```text
PyTorch runtime
TorchVision runtime
Ultralytics inference dependency
Original ByteTrack implementation
```

### Production stack

```text
ONNX
ONNX Runtime
OpenCV
NumPy
FastAPI
Lightweight IoU Tracking
```

The training environment and production environment are therefore separated.

---

## 🗃️ Dataset

The model was developed using road-damage datasets including:

- RDD2022-based road-damage data
- A focused pothole dataset
- A combined dataset used for the V4 training run

Large raw and processed datasets are excluded from Git to keep the repository manageable.

---

## 📸 Supported Input

### Images

```text
JPG
PNG
WEBP
```

### Videos

```text
MP4
AVI
MOV
```

Supported browsers can also provide:

```text
Camera Photo
Camera Video
```

---

## 📤 Output

### Image

Annotated road image with detected defect bounding boxes.

### Video

Annotated/tracked road video.

### Structured Analysis

Example:

```json
{
  "score": 82,
  "severity": "Moderate",
  "priority": "Medium",
  "damage_count": 4,
  "damage_breakdown": {
    "pothole": 2,
    "longitudinal crack": 2
  }
}
```

The exact result depends on the uploaded media and model detections.

---

## 🔬 Development → Production

RoadVision AI separates model development from production inference.

```text
              MODEL DEVELOPMENT
                     │
                     ▼
                 YOLO11s
                     │
                     ▼
            PyTorch / Ultralytics
                     │
                     ▼
                V4 Model
                     │
                     ▼
                ONNX Export
                     │
                     ▼
              PRODUCTION
                     │
                     ▼
              ONNX Runtime
                     │
             ┌───────┴───────┐
             ▼               ▼
       Image Analysis   Video Analysis
                             │
                       IoU Tracking
```

This architecture allows continued model experimentation without requiring the deployed backend to carry the full training stack.

---

## 🧪 Project Status

### Implemented

- [x] Image road-defect detection
- [x] Video road-defect detection
- [x] Lightweight video object tracking
- [x] Five road-defect classes
- [x] Road Health Score
- [x] Severity classification
- [x] Maintenance priority
- [x] Annotated image output
- [x] Annotated video output
- [x] Inspection reports
- [x] PDF report generation
- [x] Public inspection pages
- [x] Inspection history
- [x] Inspection location workflow
- [x] OpenStreetMap inspection map
- [x] Severity filtering
- [x] Inspection analytics
- [x] Camera photo capture
- [x] Camera video recording
- [x] Upload/analysis progress indicator
- [x] Vercel frontend deployment
- [x] Render backend deployment

---

## 🔮 Future Scope

- Crack segmentation
- Waterlogging detection
- Road-edge and shoulder damage detection
- Obstacle detection
- Road-surface condition classification
- Larger and more diverse datasets
- Road deterioration prediction
- Predictive maintenance recommendations
- Advanced GIS visualization
- Persistent cloud object storage
- Managed production database
- Android/mobile application
- Larger-scale field validation

---

## ⚠️ Limitations

RoadVision AI is currently a **prototype research/development system**.

Performance can vary depending on:

- Image quality
- Video quality
- Camera angle
- Lighting
- Weather
- Road-surface visibility
- Distance from the road
- Dataset coverage
- Similarity between input data and training data

The Road Health Score is a project-specific indicator and is not a certified engineering assessment.

The current limited cloud deployment also means generated files and local SQLite data should not be considered permanent production storage.

A larger production implementation would use:

- Persistent object storage
- Managed database
- Scalable inference infrastructure
- More extensive field validation

---

## 🎓 Project Objective

The objective of RoadVision AI is to demonstrate how computer vision and AI can assist road inspection by transforming road images and videos into structured information about visible defects and overall road condition.

The system is designed to support:

- Faster inspection workflows
- Consistent defect documentation
- Road-condition visualization
- Maintenance prioritization
- Inspection reporting
- Data-driven road monitoring

Final engineering and maintenance decisions should remain with qualified personnel.

---

## 👥 Team

RoadVision AI is developed as a **five-member academic project team** with responsibilities distributed across:

- AI development and system integration
- Presentation and project communication
- Final project documentation
- Dataset preparation and model training
- Additional project responsibilities

---

## 🌐 Links

| Resource | Link |
|---|---|
| 🚧 Live Application | https://road-vision-ai-beta.vercel.app |
| ⚙️ Backend | https://roadvision-ai-backend-56c4.onrender.com |
| 📚 API Documentation | https://roadvision-ai-backend-56c4.onrender.com/docs |
| 💻 GitHub Repository | https://github.com/Sisir-Pradhan07/RoadVision-AI |

---

<div align="center">

# 🚧 RoadVision AI

### Intelligent Road Monitoring

**Detect • Assess • Report • Improve**

<br>

Built to explore AI-assisted road inspection and smarter maintenance support.

</div>
