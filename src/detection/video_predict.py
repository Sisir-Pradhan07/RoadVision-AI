import cv2
from pathlib import Path
from collections import defaultdict

from ultralytics import YOLO

from src.analysis.road_health import calculate_road_health


# ============================================================
# RoadVision AI - Video Analysis
# ============================================================

MODEL_PATH = Path("models/detection/roadvision_v4.pt")
OUTPUT_DIR = Path("outputs/videos").resolve()

# Video input limits
MAX_VIDEO_DURATION = 60  # seconds
MAX_VIDEO_SIZE_MB = 500
MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024

# Tracking quality
MIN_TRACK_FRAMES = 3


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


def validate_video(video_path: str):
    """Validate video format, size, duration, and readability."""

    video_path = Path(video_path)

    # Check file existence
    if not video_path.exists():
        raise FileNotFoundError(
            f"Video not found: {video_path}"
        )

    # Check file format
    if video_path.suffix.lower() not in SUPPORTED_VIDEO_EXTENSIONS:
        raise ValueError(
            f"Unsupported video format: {video_path.suffix}"
        )

    # Check file size
    file_size = video_path.stat().st_size

    if file_size > MAX_VIDEO_SIZE_BYTES:
        raise ValueError(
            f"Video file is "
            f"{file_size / (1024 * 1024):.1f} MB. "
            f"Maximum allowed size is "
            f"{MAX_VIDEO_SIZE_MB} MB."
        )

    # Open video
    cap = cv2.VideoCapture(str(video_path))

    if not cap.isOpened():
        raise ValueError(
            f"Unable to open video: {video_path}"
        )

    # Get video information
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)

    if fps <= 0:
        cap.release()
        raise ValueError(
            "Unable to determine video FPS."
        )

    # Calculate duration
    duration = frame_count / fps

    cap.release()

    # Check duration
    if duration > MAX_VIDEO_DURATION:
        raise ValueError(
            f"Video is {duration:.1f} seconds long. "
            f"Maximum allowed duration is "
            f"{MAX_VIDEO_DURATION} seconds."
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


def prepare_health_detections(valid_tracks):
    """Convert tracked defects into Road Health detection format."""

    detections = []

    for defect in valid_tracks.values():
        detections.append({
            "class": defect["class"],
            "confidence": defect["max_confidence"],
        })

    return detections


def analyze_video(video_path: str, confidence: float = 0.25):
    """
    Analyze a road video using YOLO11s + ByteTrack.

    Tracks are filtered using a minimum frame-persistence
    requirement so short unstable detections are ignored.
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
            f"Model not found: {MODEL_PATH}"
        )

    model = YOLO(str(MODEL_PATH))

    video_path = video_info["path"]

    # --------------------------------------------------------
    # Open video
    # --------------------------------------------------------

    cap = cv2.VideoCapture(str(video_path))

    if not cap.isOpened():
        raise ValueError(
            f"Unable to open video: {video_path}"
        )

    fps = video_info["fps"]
    frame_count = video_info["frame_count"]

    width = int(
        cap.get(cv2.CAP_PROP_FRAME_WIDTH)
    )

    height = int(
        cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
    )

    # --------------------------------------------------------
    # Prepare output
    # --------------------------------------------------------

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    output_path = (
        OUTPUT_DIR /
        f"{video_path.stem}_tracked.mp4"
    )

    fourcc = cv2.VideoWriter_fourcc(
        *"mp4v"
    )

    writer = cv2.VideoWriter(
        str(output_path),
        fourcc,
        fps,
        (width, height)
    )

    if not writer.isOpened():
        cap.release()
        raise ValueError(
            "Unable to create output video."
        )

    # --------------------------------------------------------
    # Tracking storage
    # --------------------------------------------------------

    frame_number = 0
    total_detections = 0

    tracked_defects = defaultdict(
        lambda: {
            "class": None,
            "frames_seen": 0,
            "max_confidence": 0.0,
        }
    )

    # --------------------------------------------------------
    # Start analysis
    # --------------------------------------------------------

    print("\n=== ROADVISION AI VIDEO ANALYSIS ===")
    print(f"Video: {video_path}")
    print(
        f"Duration: "
        f"{video_info['duration']} seconds"
    )
    print(f"FPS: {fps}")
    print(f"Total Frames: {frame_count}")

    print("\nAnalyzing video with tracking...\n")

    while True:

        success, frame = cap.read()

        if not success:
            break

        frame_number += 1

        # ----------------------------------------------------
        # YOLO + ByteTrack
        # ----------------------------------------------------

        results = model.track(
            source=frame,
            conf=confidence,
            persist=True,
            tracker="bytetrack.yaml",
            verbose=False
        )

        result = results[0]

        # ----------------------------------------------------
        # Draw detections/tracking on frame
        # ----------------------------------------------------

        annotated_frame = result.plot()

        # ----------------------------------------------------
        # Process detections
        # ----------------------------------------------------

        if result.boxes is not None:

            frame_detections = len(
                result.boxes
            )

            total_detections += frame_detections

            if result.boxes.id is not None:

                track_ids = (
                    result.boxes.id
                    .int()
                    .cpu()
                    .tolist()
                )

                classes = (
                    result.boxes.cls
                    .int()
                    .cpu()
                    .tolist()
                )

                confidences = (
                    result.boxes.conf
                    .cpu()
                    .tolist()
                )

                for (
                    track_id,
                    class_id,
                    conf
                ) in zip(
                    track_ids,
                    classes,
                    confidences
                ):

                    class_name = result.names[
                        class_id
                    ]

                    tracked_defects[
                        track_id
                    ]["class"] = class_name

                    tracked_defects[
                        track_id
                    ]["frames_seen"] += 1

                    tracked_defects[
                        track_id
                    ]["max_confidence"] = max(
                        tracked_defects[
                            track_id
                        ]["max_confidence"],
                        float(conf)
                    )

        # ----------------------------------------------------
        # Write annotated frame
        # ----------------------------------------------------

        writer.write(
            annotated_frame
        )

        # ----------------------------------------------------
        # Progress
        # ----------------------------------------------------

        if (
            frame_number % 30 == 0
            or frame_number == frame_count
        ):

            progress = (
                frame_number /
                frame_count
            ) * 100

            print(
                f"Progress: {progress:.1f}% "
                f"({frame_number}/{frame_count})"
            )

    # --------------------------------------------------------
    # Release resources
    # --------------------------------------------------------

    cap.release()
    writer.release()

    # --------------------------------------------------------
    # Filter unstable tracks
    # --------------------------------------------------------

    valid_tracks = {
        track_id: defect
        for track_id, defect
        in tracked_defects.items()
        if defect["frames_seen"]
        >= MIN_TRACK_FRAMES
    }

    # --------------------------------------------------------
    # Prepare Road Health analysis
    # --------------------------------------------------------

    health_detections = prepare_health_detections(
        valid_tracks
    )

    health = calculate_road_health(
        health_detections
    )

    # --------------------------------------------------------
    # Final analysis
    # --------------------------------------------------------

    print("\n=== ANALYSIS COMPLETE ===")

    print(
        f"Frames analyzed: "
        f"{frame_number}"
    )

    print(
        f"Total frame detections: "
        f"{total_detections}"
    )

    print(
        f"Raw tracked objects: "
        f"{len(tracked_defects)}"
    )

    print(
        f"Valid tracked defects: "
        f"{len(valid_tracks)}"
    )

    # --------------------------------------------------------
    # Road Health
    # --------------------------------------------------------

    print("\n=== ROAD HEALTH ===")

    print(
        f"Score: {health['score']}/100"
    )

    print(
        f"Severity: {health['severity']}"
    )

    print(
        f"Maintenance Priority: "
        f"{health['priority']}"
    )

    print(
        f"Total Defects: "
        f"{health['damage_count']}"
    )

    print("\nDamage Breakdown:")

    if health["damage_breakdown"]:

        for damage, count in (
            health["damage_breakdown"].items()
        ):
            print(
                f"- {damage}: {count}"
            )

    else:

        print("- None")

    print(
        f"\nOutput video: "
        f"{output_path}"
    )

    # --------------------------------------------------------
    # Display valid defects
    # --------------------------------------------------------

    print("\n=== VALID TRACKED DEFECTS ===")

    if valid_tracks:

        for track_id, defect in valid_tracks.items():

            print(
                f"- ID {track_id}: "
                f"{defect['class']} | "
                f"Frames: "
                f"{defect['frames_seen']} | "
                f"Max confidence: "
                f"{defect['max_confidence']:.2f}"
            )

    else:

        print(
            "- No persistent road defects detected."
        )

    # --------------------------------------------------------
    # Return analysis
    # --------------------------------------------------------

    return {
        "video": str(video_path),
        "output_video": str(output_path),
        "duration": video_info["duration"],
        "fps": fps,
        "frames_analyzed": frame_number,
        "total_frame_detections": total_detections,
        "raw_tracked_objects": len(
            tracked_defects
        ),
        "unique_tracked_objects": len(
            valid_tracks
        ),
        "tracked_defects": dict(
            valid_tracks
        ),
        "health": health,
    }


# ============================================================
# Command-line interface
# ============================================================

if __name__ == "__main__":

    import sys

    if len(sys.argv) < 2:

        print("Usage:")

        print(
            "python -m src.detection.video_predict "
            "<video_path>"
        )

        print("\nExample:")

        print(
            "python -m src.detection.video_predict "
            "Road_hole.mp4"
        )

        sys.exit(1)

    video = sys.argv[1]

    try:

        analysis = analyze_video(video)

        print(
            "\n=== ROADVISION VIDEO RESULT ==="
        )

        print(
            f"Frames analyzed: "
            f"{analysis['frames_analyzed']}"
        )

        print(
            f"Total frame detections: "
            f"{analysis['total_frame_detections']}"
        )

        print(
            f"Raw tracked objects: "
            f"{analysis['raw_tracked_objects']}"
        )

        print(
            f"Valid tracked defects: "
            f"{analysis['unique_tracked_objects']}"
        )

        print(
            f"Road Health Score: "
            f"{analysis['health']['score']}/100"
        )

        print(
            f"Severity: "
            f"{analysis['health']['severity']}"
        )

        print(
            f"Maintenance Priority: "
            f"{analysis['health']['priority']}"
        )

        print(
            f"Annotated video: "
            f"{analysis['output_video']}"
        )

    except Exception as error:

        print(f"\nError: {error}")

        sys.exit(1)