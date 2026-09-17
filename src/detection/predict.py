from pathlib import Path
import sys
from types import SimpleNamespace

import cv2
import numpy as np
import onnxruntime as ort

from reports.report_generator import generate_report, save_report
from src.analysis.road_health import calculate_road_health


MODEL_PATH = Path("models/detection/roadvision_v4.onnx")
OUTPUT_DIR = Path("outputs/predictions").resolve()

CLASS_NAMES = {
    0: "longitudinal crack",
    1: "transverse crack",
    2: "alligator crack",
    3: "other corruption",
    4: "pothole",
}


def letterbox(image, new_shape=(640, 640)):
    height, width = image.shape[:2]

    scale = min(
        new_shape[0] / height,
        new_shape[1] / width,
    )

    new_width = int(round(width * scale))
    new_height = int(round(height * scale))

    resized = cv2.resize(
        image,
        (new_width, new_height),
        interpolation=cv2.INTER_LINEAR,
    )

    pad_width = new_shape[1] - new_width
    pad_height = new_shape[0] - new_height

    left = pad_width // 2
    right = pad_width - left
    top = pad_height // 2
    bottom = pad_height - top

    padded = cv2.copyMakeBorder(
        resized,
        top,
        bottom,
        left,
        right,
        cv2.BORDER_CONSTANT,
        value=(114, 114, 114),
    )

    return padded, scale, left, top


def calculate_iou(box, boxes):
    x1 = np.maximum(box[0], boxes[:, 0])
    y1 = np.maximum(box[1], boxes[:, 1])
    x2 = np.minimum(box[2], boxes[:, 2])
    y2 = np.minimum(box[3], boxes[:, 3])

    intersection = (
        np.maximum(0, x2 - x1)
        * np.maximum(0, y2 - y1)
    )

    area1 = (
        (box[2] - box[0])
        * (box[3] - box[1])
    )

    area2 = (
        (boxes[:, 2] - boxes[:, 0])
        * (boxes[:, 3] - boxes[:, 1])
    )

    union = area1 + area2 - intersection

    return intersection / (union + 1e-6)


def nms(boxes, scores, iou_threshold=0.45):
    if len(boxes) == 0:
        return []

    order = scores.argsort()[::-1]
    keep = []

    while len(order) > 0:
        current = order[0]
        keep.append(current)

        if len(order) == 1:
            break

        ious = calculate_iou(
            boxes[current],
            boxes[order[1:]],
        )

        order = order[1:][ious < iou_threshold]

    return keep


def predict_image(image_path: str, confidence: float = 0.10):
    """Run RoadVision ONNX detection and calculate road health."""

    image_path = Path(image_path)

    if not image_path.exists():
        raise FileNotFoundError(
            f"Image not found: {image_path}"
        )

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found: {MODEL_PATH}"
        )

    image = cv2.imread(str(image_path))

    if image is None:
        raise ValueError(
            f"Unable to read image: {image_path}"
        )

    original = image.copy()

    input_image, scale, pad_x, pad_y = letterbox(
        image,
        (640, 640),
    )

    input_image = cv2.cvtColor(
        input_image,
        cv2.COLOR_BGR2RGB,
    )

    input_image = (
        input_image.astype(np.float32) / 255.0
    )

    input_image = np.transpose(
        input_image,
        (2, 0, 1),
    )

    input_image = np.expand_dims(
        input_image,
        axis=0,
    )

    session = ort.InferenceSession(
        str(MODEL_PATH),
        providers=["CPUExecutionProvider"],
    )

    input_name = session.get_inputs()[0].name

    outputs = session.run(
        None,
        {input_name: input_image},
    )

    predictions = outputs[0][0]

    boxes = []
    scores = []
    class_ids = []

    for prediction in predictions.T:
        x_center, y_center, width, height = prediction[:4]

        class_scores = prediction[4:]

        class_id = int(
            np.argmax(class_scores)
        )

        score = float(
            class_scores[class_id]
        )

        if score < confidence:
            continue

        x1 = x_center - width / 2
        y1 = y_center - height / 2
        x2 = x_center + width / 2
        y2 = y_center + height / 2

        x1 = (x1 - pad_x) / scale
        y1 = (y1 - pad_y) / scale
        x2 = (x2 - pad_x) / scale
        y2 = (y2 - pad_y) / scale

        x1 = max(
            0,
            min(x1, original.shape[1]),
        )
        y1 = max(
            0,
            min(y1, original.shape[0]),
        )
        x2 = max(
            0,
            min(x2, original.shape[1]),
        )
        y2 = max(
            0,
            min(y2, original.shape[0]),
        )

        boxes.append([x1, y1, x2, y2])
        scores.append(score)
        class_ids.append(class_id)

    detections = []
    annotated = original.copy()

    if boxes:
        boxes_np = np.array(
            boxes,
            dtype=np.float32,
        )

        scores_np = np.array(
            scores,
            dtype=np.float32,
        )

        class_ids_np = np.array(
            class_ids,
            dtype=np.int32,
        )

        final_indices = []

        for class_id in np.unique(class_ids_np):
            class_indices = np.where(
                class_ids_np == class_id
            )[0]

            class_keep = nms(
                boxes_np[class_indices],
                scores_np[class_indices],
            )

            final_indices.extend(
                class_indices[class_keep]
            )

        for index in final_indices:
            x1, y1, x2, y2 = (
                boxes_np[index].astype(int)
            )

            class_id = int(
                class_ids_np[index]
            )

            score = float(
                scores_np[index]
            )

            class_name = CLASS_NAMES.get(
                class_id,
                str(class_id),
            )

            detections.append({
                "class": class_name,
                "confidence": score,
            })

            cv2.rectangle(
                annotated,
                (x1, y1),
                (x2, y2),
                (0, 255, 0),
                2,
            )

            label = f"{class_name} {score:.2f}"

            (
                (text_width, text_height),
                baseline,
            ) = cv2.getTextSize(
                label,
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                1,
            )

            label_y = max(
                y1,
                text_height + baseline,
            )

            cv2.rectangle(
                annotated,
                (
                    x1,
                    label_y - text_height - baseline,
                ),
                (
                    x1 + text_width,
                    label_y,
                ),
                (0, 255, 0),
                -1,
            )

            cv2.putText(
                annotated,
                label,
                (x1, label_y - baseline),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 0, 0),
                1,
                cv2.LINE_AA,
            )

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    output_path = (
    OUTPUT_DIR
    / image_path.name
)

    cv2.imwrite(
        str(output_path),
        annotated,
    )

    health = calculate_road_health(detections)

    # Keep compatibility with app.py, which expects
    # result.save_dir and uses it to locate the output image.
    result = SimpleNamespace(
        save_dir=OUTPUT_DIR,
    )

    return result, detections, health


def print_results(
    image_path,
    detections,
    health,
    report_path,
):
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
            print(f"- {damage}: {count}")
    else:
        print("- None")

    print(f"\nReport saved to: {report_path}")


if __name__ == "__main__":

    if len(sys.argv) < 2:
        print("Usage:")
        print(
            "python -m src.detection.predict "
            "<image_path>"
        )
        print("\nExample:")
        print(
            "python -m src.detection.predict "
            "test_road.jpg"
        )
        sys.exit(1)

    image = sys.argv[1]

    try:
        print("Loading RoadVision AI ONNX model...")

        result, detections, health = predict_image(
            image
        )

        report = generate_report(
            detections=detections,
            health=health,
            image_name=Path(image).name,
        )

        report_path = save_report(
            report,
            f"reports/"
            f"{Path(image).stem}_report.json",
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