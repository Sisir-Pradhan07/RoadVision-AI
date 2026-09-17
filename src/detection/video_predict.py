import cv2
import numpy as np
from pathlib import Path
from collections import defaultdict
from math import sqrt

import onnxruntime as ort

from src.analysis.road_health import calculate_road_health


# ============================================================
# RoadVision AI - ONNX Video Analysis
# ============================================================

MODEL_PATH = Path("models/detection/roadvision_v4.onnx")
OUTPUT_DIR = Path("outputs/videos").resolve()

IMG_SIZE = 640

# Video input limits
MAX_VIDEO_DURATION = 60
MAX_VIDEO_SIZE_MB = 500
MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024

# Tracking quality
MIN_TRACK_FRAMES = 3
MAX_TRACK_DISTANCE = 120
MAX_MISSED_FRAMES = 8

CLASS_NAMES = {
    0: "longitudinal crack",
    1: "transverse crack",
    2: "alligator crack",
    3: "other corruption",
    4: "pothole",
}

SUPPORTED_VIDEO_EXTENSIONS = {
    ".mp4",
    ".avi",
    ".mov",
    ".mkv",
    ".webm",
    ".m4v",
    ".mpeg",
    ".mpg",
}


# ============================================================
# Video Validation
# ============================================================

def validate_video(video_path: str):
    """Validate video format, size, duration, and readability."""

    video_path = Path(video_path)

    if not video_path.exists():
        raise FileNotFoundError(
            f"Video not found: {video_path}"
        )

    if video_path.suffix.lower() not in SUPPORTED_VIDEO_EXTENSIONS:
        raise ValueError(
            f"Unsupported video format: {video_path.suffix}"
        )

    file_size = video_path.stat().st_size

    if file_size > MAX_VIDEO_SIZE_BYTES:
        raise ValueError(
            f"Video file is {file_size / (1024 * 1024):.1f} MB. "
            f"Maximum allowed size is {MAX_VIDEO_SIZE_MB} MB."
        )

    cap = cv2.VideoCapture(str(video_path))

    if not cap.isOpened():
        raise ValueError(
            f"Unable to open video: {video_path}"
        )

    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)

    if fps <= 0:
        cap.release()
        raise ValueError("Unable to determine video FPS.")

    duration = frame_count / fps

    cap.release()

    if duration > MAX_VIDEO_DURATION:
        raise ValueError(
            f"Video is {duration:.1f} seconds long. "
            f"Maximum allowed duration is {MAX_VIDEO_DURATION} seconds."
        )

    return {
        "path": video_path,
        "duration": round(duration, 2),
        "fps": round(fps, 2),
        "frame_count": int(frame_count),
        "file_size_mb": round(
            file_size / (1024 * 1024), 2
        ),
    }


# ============================================================
# ONNX Preprocessing
# ============================================================

def letterbox(image, new_size=640):
    """Resize while preserving aspect ratio."""

    h, w = image.shape[:2]

    scale = min(new_size / w, new_size / h)

    new_w = int(round(w * scale))
    new_h = int(round(h * scale))

    resized = cv2.resize(
        image,
        (new_w, new_h),
        interpolation=cv2.INTER_LINEAR,
    )

    canvas = np.full(
        (new_size, new_size, 3),
        114,
        dtype=np.uint8,
    )

    pad_x = (new_size - new_w) // 2
    pad_y = (new_size - new_h) // 2

    canvas[
        pad_y:pad_y + new_h,
        pad_x:pad_x + new_w
    ] = resized

    return canvas, scale, pad_x, pad_y


def preprocess_frame(frame):
    """Prepare OpenCV BGR frame for ONNX."""

    image, scale, pad_x, pad_y = letterbox(
        frame,
        IMG_SIZE,
    )

    image = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2RGB,
    )

    image = image.astype(np.float32) / 255.0

    image = np.transpose(
        image,
        (2, 0, 1),
    )

    image = np.expand_dims(
        image,
        axis=0,
    )

    return image, scale, pad_x, pad_y


# ============================================================
# ONNX Postprocessing
# ============================================================

def box_iou(box_a, box_b):
    """Calculate IoU between two XYXY boxes."""

    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_w = max(0, inter_x2 - inter_x1)
    inter_h = max(0, inter_y2 - inter_y1)

    intersection = inter_w * inter_h

    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)

    union = area_a + area_b - intersection

    if union <= 0:
        return 0.0

    return intersection / union


def nms_classwise(detections, iou_threshold=0.45):
    """Perform NMS separately for each class."""

    if not detections:
        return []

    final = []

    classes = set(
        detection["class_id"]
        for detection in detections
    )

    for class_id in classes:

        class_detections = [
            d for d in detections
            if d["class_id"] == class_id
        ]

        class_detections.sort(
            key=lambda d: d["confidence"],
            reverse=True,
        )

        while class_detections:

            best = class_detections.pop(0)

            final.append(best)

            remaining = []

            for detection in class_detections:

                iou = box_iou(
                    best["box"],
                    detection["box"],
                )

                if iou < iou_threshold:
                    remaining.append(detection)

            class_detections = remaining

    return final


def postprocess(
    outputs,
    original_shape,
    scale,
    pad_x,
    pad_y,
    confidence_threshold=0.25,
):
    """Decode YOLO ONNX output."""

    output = outputs[0]

    if output.ndim == 3:
        output = output[0]

    # YOLO output is normally:
    # [84, 8400] -> transpose to [8400, 84]
    if output.shape[0] < output.shape[1]:
        output = output.T

    detections = []

    original_h, original_w = original_shape[:2]

    for row in output:

        if len(row) < 6:
            continue

        cx, cy, w, h = row[:4]

        class_scores = row[4:]

        class_id = int(
            np.argmax(class_scores)
        )

        confidence = float(
            class_scores[class_id]
        )

        if confidence < confidence_threshold:
            continue

        x1 = cx - w / 2
        y1 = cy - h / 2
        x2 = cx + w / 2
        y2 = cy + h / 2

        # Remove letterbox padding
        x1 = (x1 - pad_x) / scale
        y1 = (y1 - pad_y) / scale
        x2 = (x2 - pad_x) / scale
        y2 = (y2 - pad_y) / scale

        # Clamp to original frame
        x1 = max(0, min(original_w - 1, x1))
        y1 = max(0, min(original_h - 1, y1))
        x2 = max(0, min(original_w - 1, x2))
        y2 = max(0, min(original_h - 1, y2))

        if x2 <= x1 or y2 <= y1:
            continue

        detections.append({
            "class_id": class_id,
            "class": CLASS_NAMES.get(
                class_id,
                f"class_{class_id}",
            ),
            "confidence": confidence,
            "box": [
                float(x1),
                float(y1),
                float(x2),
                float(y2),
            ],
        })

    return nms_classwise(detections)


# ============================================================
# Lightweight Object Tracker
# ============================================================

class SimpleTracker:

    def __init__(self):
        self.next_id = 1
        self.tracks = {}

    def center(self, box):
        x1, y1, x2, y2 = box

        return (
            (x1 + x2) / 2,
            (y1 + y2) / 2,
        )

    def update(self, detections):

        assignments = []
        used_tracks = set()

        for detection in detections:

            best_id = None
            best_score = 0.0

            det_center = self.center(
                detection["box"]
            )

            for track_id, track in self.tracks.items():

                if track_id in used_tracks:
                    continue

                if track["class_id"] != detection["class_id"]:
                    continue

                track_center = self.center(
                    track["box"]
                )

                distance = sqrt(
                    (det_center[0] - track_center[0]) ** 2
                    +
                    (det_center[1] - track_center[1]) ** 2
                )

                if distance > MAX_TRACK_DISTANCE:
                    continue

                iou = box_iou(
                    track["box"],
                    detection["box"],
                )

                score = iou + (
                    max(
                        0,
                        1 - distance / MAX_TRACK_DISTANCE
                    ) * 0.3
                )

                if score > best_score:
                    best_score = score
                    best_id = track_id

            if best_id is None:

                best_id = self.next_id
                self.next_id += 1

                self.tracks[best_id] = {
                    "box": detection["box"],
                    "class_id": detection["class_id"],
                    "class": detection["class"],
                    "frames_seen": 0,
                    "max_confidence": 0.0,
                    "missed": 0,
                }

            track = self.tracks[best_id]

            track["box"] = detection["box"]
            track["frames_seen"] += 1
            track["max_confidence"] = max(
                track["max_confidence"],
                detection["confidence"],
            )
            track["missed"] = 0

            used_tracks.add(best_id)

            assignments.append(
                (best_id, detection)
            )

        # Increase missed count for unmatched tracks
        for track_id in list(self.tracks.keys()):

            if track_id not in used_tracks:

                self.tracks[track_id]["missed"] += 1

                if (
                    self.tracks[track_id]["missed"]
                    > MAX_MISSED_FRAMES
                ):
                    del self.tracks[track_id]

        return assignments


# ============================================================
# Health Preparation
# ============================================================

def prepare_health_detections(valid_tracks):
    """Convert tracked defects into Road Health format."""

    detections = []

    for defect in valid_tracks.values():

        detections.append({
            "class": defect["class"],
            "confidence": defect["max_confidence"],
        })

    return detections


# ============================================================
# Video Analysis
# ============================================================

def analyze_video(
    video_path: str,
    confidence: float = 0.25,
):
    """
    Analyze road video using YOLO11s exported to ONNX.

    Uses ONNX Runtime for CPU inference and a lightweight
    IoU-based tracker for persistent defect tracking.
    """

    # --------------------------------------------------------
    # Validate video
    # --------------------------------------------------------

    video_info = validate_video(video_path)

    # --------------------------------------------------------
    # Check model
    # --------------------------------------------------------

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"ONNX model not found: {MODEL_PATH}"
        )

    # --------------------------------------------------------
    # Create ONNX session
    # --------------------------------------------------------

    session = ort.InferenceSession(
        str(MODEL_PATH),
        providers=["CPUExecutionProvider"],
    )

    input_name = session.get_inputs()[0].name

    # --------------------------------------------------------
    # Open video
    # --------------------------------------------------------

    video_path = video_info["path"]

    cap = cv2.VideoCapture(
        str(video_path)
    )

    if not cap.isOpened():
        raise ValueError(
            f"Unable to open video: {video_path}"
        )

    fps = video_info["fps"]

    width = int(
        cap.get(cv2.CAP_PROP_FRAME_WIDTH)
    )

    height = int(
        cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
    )

    # --------------------------------------------------------
    # Output directory
    # --------------------------------------------------------

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    output_path = (
        OUTPUT_DIR
        / f"{video_path.stem}_tracked.mp4"
    )

    # Try H264 first, then MPEG-4 fallback
    fourcc = cv2.VideoWriter_fourcc(
        *"avc1"
    )

    writer = cv2.VideoWriter(
        str(output_path),
        fourcc,
        fps,
        (width, height),
    )

    if not writer.isOpened():

        writer.release()

        fourcc = cv2.VideoWriter_fourcc(
            *"mp4v"
        )

        writer = cv2.VideoWriter(
            str(output_path),
            fourcc,
            fps,
            (width, height),
        )

    if not writer.isOpened():

        cap.release()

        raise RuntimeError(
            "Unable to create output video."
        )

    # --------------------------------------------------------
    # Tracker
    # --------------------------------------------------------

    tracker = SimpleTracker()

    frame_number = 0
    total_detections = 0

    tracked_defects = {}

    # --------------------------------------------------------
    # Process frames
    # --------------------------------------------------------

    while True:

        success, frame = cap.read()

        if not success:
            break

        frame_number += 1

        # ----------------------------------------------------
        # Preprocess
        # ----------------------------------------------------

        input_tensor, scale, pad_x, pad_y = (
            preprocess_frame(frame)
        )

        # ----------------------------------------------------
        # ONNX inference
        # ----------------------------------------------------

        outputs = session.run(
            None,
            {
                input_name: input_tensor
            },
        )

        detections = postprocess(
            outputs,
            frame.shape,
            scale,
            pad_x,
            pad_y,
            confidence,
        )

        total_detections += len(
            detections
        )

        # ----------------------------------------------------
        # Tracking
        # ----------------------------------------------------

        assignments = tracker.update(
            detections
        )

        # ----------------------------------------------------
        # Draw detections
        # ----------------------------------------------------

        for track_id, detection in assignments:

            x1, y1, x2, y2 = map(
                int,
                detection["box"],
            )

            class_name = detection["class"]
            conf = detection["confidence"]

            label = (
                f"{class_name} "
                f"{conf:.2f} "
                f"ID:{track_id}"
            )

            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                (0, 255, 0),
                2,
            )

            label_y = max(
                25,
                y1 - 8,
            )

            cv2.putText(
                frame,
                label,
                (x1, label_y),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 255, 0),
                2,
                cv2.LINE_AA,
            )

            # ------------------------------------------------
            # Store tracked defect
            # ------------------------------------------------

            if track_id not in tracked_defects:

                tracked_defects[track_id] = {
                    "class": class_name,
                    "frames_seen": 0,
                    "max_confidence": 0.0,
                }

            tracked_defects[
                track_id
            ]["frames_seen"] = tracker.tracks[
                track_id
            ]["frames_seen"]

            tracked_defects[
                track_id
            ]["max_confidence"] = max(
                tracked_defects[
                    track_id
                ]["max_confidence"],
                conf,
            )

        # ----------------------------------------------------
        # Frame information
        # ----------------------------------------------------

        cv2.putText(
            frame,
            f"RoadVision AI | Frame {frame_number}",
            (20, 35),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.75,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )

        writer.write(frame)

    # --------------------------------------------------------
    # Cleanup
    # --------------------------------------------------------

    cap.release()
    writer.release()

    # --------------------------------------------------------
    # Filter short tracks
    # --------------------------------------------------------

    valid_tracks = {
        track_id: defect
        for track_id, defect in tracked_defects.items()
        if defect["frames_seen"] >= MIN_TRACK_FRAMES
    }

    # --------------------------------------------------------
    # Road Health
    # --------------------------------------------------------

    health_detections = prepare_health_detections(
        valid_tracks
    )

    health = calculate_road_health(
        health_detections
    )

    # --------------------------------------------------------
    # Return same structure as previous pipeline
    # --------------------------------------------------------

    return {
        "video": str(video_path),
        "output_video": str(output_path),
        "duration": video_info["duration"],
        "fps": fps,
        "frames_analyzed": frame_number,
        "total_frame_detections": total_detections,
        "raw_tracked_objects": len(tracked_defects),
        "unique_tracked_objects": len(valid_tracks),
        "tracked_defects": valid_tracks,
        "health": health,
    }


# ============================================================
# CLI
# ============================================================

if __name__ == "__main__":

    import sys

    if len(sys.argv) < 2:
        print(
            "Usage: python -m src.detection.video_predict "
            "<video_path>"
        )
        raise SystemExit(1)

    result = analyze_video(
        sys.argv[1]
    )

    print("\nRoadVision AI Video Analysis")
    print("=" * 50)

    print(
        f"Frames analyzed: "
        f"{result['frames_analyzed']}"
    )

    print(
        f"Frame detections: "
        f"{result['total_frame_detections']}"
    )

    print(
        f"Tracked objects: "
        f"{result['raw_tracked_objects']}"
    )

    print(
        f"Valid tracked objects: "
        f"{result['unique_tracked_objects']}"
    )

    print(
        f"Health score: "
        f"{result['health']['score']}"
    )

    print(
        f"Severity: "
        f"{result['health']['severity']}"
    )

    print(
        f"Priority: "
        f"{result['health']['priority']}"
    )

    print(
        f"Output: "
        f"{result['output_video']}"
    )