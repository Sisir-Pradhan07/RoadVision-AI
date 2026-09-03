from pathlib import Path
import sys

from ultralytics import YOLO

from reports.report_generator import generate_report, save_report
from src.analysis.road_health import calculate_road_health


MODEL_PATH = Path("models/detection/roadvision_v4.pt")
OUTPUT_DIR = Path("outputs/predictions").resolve()


def predict_image(image_path: str, confidence: float = 0.25):
    """Run RoadVision detection and calculate road health."""

    image_path = Path(image_path)

    if not image_path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found: {MODEL_PATH}"
        )

    model = YOLO(str(MODEL_PATH))

    results = model.predict(
        source=str(image_path),
        conf=confidence,
        save=True,
        project=str(OUTPUT_DIR.parent),
        name=OUTPUT_DIR.name,
        exist_ok=True,
    )

    result = results[0]

    detections = []

    for box in result.boxes:
        class_id = int(box.cls[0])
        confidence_score = float(box.conf[0])
        class_name = result.names[class_id]

        detections.append({
            "class": class_name,
            "confidence": confidence_score,
        })

    health = calculate_road_health(detections)

    return result, detections, health


def print_results(image_path, detections, health, report_path):
    """Display RoadVision analysis results."""

    print("\n=== ROADVISION AI ===")
    print(f"Image: {image_path}")

    print("\n=== DETECTIONS ===")

    if detections:
        for detection in detections:
            print(
                f"- {detection['class']}: "
                f"{detection['confidence']:.2f}"
            )
    else:
        print("- No road damage detected.")

    print("\n=== ROAD HEALTH ===")
    print(f"Score: {health['score']}/100")
    print(f"Severity: {health['severity']}")
    print(f"Maintenance Priority: {health['priority']}")
    print(f"Total Defects: {health['damage_count']}")

    print("\nDamage Breakdown:")

    if health["damage_breakdown"]:
        for damage, count in health["damage_breakdown"].items():
            print(f"- {damage}: {count}")
    else:
        print("- None")

    print(f"\nReport saved to: {report_path}")


if __name__ == "__main__":

    if len(sys.argv) < 2:
        print("Usage:")
        print("python -m src.detection.predict <image_path>")
        print("\nExample:")
        print("python -m src.detection.predict test_road.jpg")
        sys.exit(1)

    image = sys.argv[1]

    try:
        print("Loading RoadVision AI model...")

        result, detections, health = predict_image(image)

        report = generate_report(
            detections=detections,
            health=health,
            image_name=Path(image).name,
        )

        report_path = save_report(
            report,
            f"reports/{Path(image).stem}_report.json",
        )

        print_results(
            image,
            detections,
            health,
            report_path,
        )

    except Exception as error:
        print(f"\nError: {error}")
        sys.exit(1)