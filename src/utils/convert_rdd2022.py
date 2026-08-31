import json
import shutil
from pathlib import Path
import random

# --------------------------------------------------
# Paths
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parents[2]

RAW_DIR = BASE_DIR / "data" / "raw" / "RDD2022_sample"
OUTPUT_DIR = BASE_DIR / "data" / "processed" / "rdd2022_yolo"

# Fixed class mapping
CLASS_NAMES = {
    "longitudinal crack": 0,
    "transverse crack": 1,
    "alligator crack": 2,
    "other corruption": 3,
    "pothole": 4,
}

# --------------------------------------------------
# Create directories
# --------------------------------------------------

for split in ["train", "val", "test"]:
    (OUTPUT_DIR / "images" / split).mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "labels" / split).mkdir(parents=True, exist_ok=True)


def convert_annotation(json_file, label_file):
    """Convert one Supervisely JSON annotation to YOLO format."""

    with open(json_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    image_width = data["size"]["width"]
    image_height = data["size"]["height"]

    yolo_lines = []

    for obj in data.get("objects", []):

        class_name = obj.get("classTitle")

        if class_name not in CLASS_NAMES:
            continue

        # We only need rectangle annotations for this model
        if obj.get("geometryType") != "rectangle":
            continue

        points = obj["points"]["exterior"]

        if len(points) < 2:
            continue

        x1, y1 = points[0]
        x2, y2 = points[1]

        # Make sure coordinates are correctly ordered
        xmin = min(x1, x2)
        xmax = max(x1, x2)
        ymin = min(y1, y2)
        ymax = max(y1, y2)

        # Clamp coordinates to image dimensions
        xmin = max(0, min(xmin, image_width))
        xmax = max(0, min(xmax, image_width))
        ymin = max(0, min(ymin, image_height))
        ymax = max(0, min(ymax, image_height))

        box_width = xmax - xmin
        box_height = ymax - ymin

        if box_width <= 0 or box_height <= 0:
            continue

        center_x = xmin + box_width / 2
        center_y = ymin + box_height / 2

        # Normalize for YOLO
        center_x /= image_width
        center_y /= image_height
        box_width /= image_width
        box_height /= image_height

        class_id = CLASS_NAMES[class_name]

        yolo_lines.append(
            f"{class_id} "
            f"{center_x:.6f} "
            f"{center_y:.6f} "
            f"{box_width:.6f} "
            f"{box_height:.6f}"
        )

    with open(label_file, "w", encoding="utf-8") as f:
        f.write("\n".join(yolo_lines))


def process_split(source_split, destination_split):
    """Process one dataset split."""

    image_dir = RAW_DIR / source_split / "img"
    annotation_dir = RAW_DIR / source_split / "ann"

    images = list(image_dir.glob("*"))

    print(f"\nProcessing {source_split}: {len(images)} images")

    converted = 0

    for image_path in images:

        if image_path.suffix.lower() not in [".jpg", ".jpeg", ".png"]:
            continue

        json_path = annotation_dir / f"{image_path.name}.json"

        if not json_path.exists():
            print(f"Warning: annotation missing for {image_path.name}")
            continue

        output_image = (
            OUTPUT_DIR
            / "images"
            / destination_split
            / image_path.name
        )

        output_label = (
            OUTPUT_DIR
            / "labels"
            / destination_split
            / f"{image_path.stem}.txt"
        )

        shutil.copy2(image_path, output_image)

        convert_annotation(json_path, output_label)

        converted += 1

    print(f"Converted: {converted}")


# --------------------------------------------------
# Process dataset
# --------------------------------------------------

# Existing RDD train → our training set
process_split("train", "train")

# Existing RDD test → validation set for the MVP
process_split("test", "val")


# --------------------------------------------------
# Create data.yaml
# --------------------------------------------------

yaml_content = f"""path: {OUTPUT_DIR.as_posix()}
train: images/train
val: images/val

names:
"""

for class_id, class_name in enumerate(CLASS_NAMES):
    yaml_content += f"  {class_id}: {class_name}\n"

with open(OUTPUT_DIR / "data.yaml", "w", encoding="utf-8") as f:
    f.write(yaml_content)

print("\n========================================")
print("RDD2022 conversion completed!")
print(f"Output: {OUTPUT_DIR}")
print("========================================")
print("\nClasses:")

for class_id, class_name in enumerate(CLASS_NAMES):
    print(f"{class_id}: {class_name}")