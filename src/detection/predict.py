from pathlib import Path

from ultralytics import YOLO

from reports.report_generator import generate_report, save_report
from src.analysis.road_health import calculate_road_health


MODEL_PATH = Path("models/detection/roadvision_v3.pt")
OUTPUT_DIR = Path("outputs/predictions").resolve()


def predict_image(image_path: str, confidence: float = 0.25):
    """Run RoadVision detection and calculate road health."""

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found: {MODEL_PATH}"
        )

    model = YOLO(str(MODEL_PATH))

    results = model.predict(
        source=image_path,
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


if __name__ == "__main__":
    image = "test_road.jpg"

    print("Loading RoadVision AI model...")

    result, detections, health = predict_image(image)

    print("\n=== DETECTIONS ===")

    for detection in detections:
        print(
            f"- {detection['class']}: "
            f"{detection['confidence']:.2f}"
        )

    print("\n=== ROAD HEALTH ===")
    print(f"Score: {health['score']}/100")
    print(f"Severity: {health['severity']}")
    print(f"Maintenance Priority: {health['priority']}")
    print(f"Total Defects: {health['damage_count']}")

    print("\nDamage Breakdown:")

    for damage, count in health["damage_breakdown"].items():
        print(f"- {damage}: {count}")

    # Generate structured report
    report = generate_report(
        detections=detections,
        health=health,
        image_name=image,
    )

    # Save report
    report_path = save_report(
        report,
        f"reports/{Path(image).stem}_report.json",
    )

    print(f"\nReport saved to: {report_path}")