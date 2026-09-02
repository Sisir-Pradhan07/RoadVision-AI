from pathlib import Path
import json
import shutil
import random

# --------------------------------------------------
# PATHS
# --------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent

SOURCE_RDD = PROJECT_ROOT / "data" / "processed" / "rdd2022_yolo"
SOURCE_POTHOLE = PROJECT_ROOT / "data" / "raw" / "pothole-detection"

OUTPUT = PROJECT_ROOT / "data" / "processed" / "roadvision_v4_dataset"

# Reproducible split
random.seed(42)

# --------------------------------------------------
# CREATE OUTPUT DIRECTORIES
# --------------------------------------------------

for split in ["train", "val"]:
    (OUTPUT / "images" / split).mkdir(parents=True, exist_ok=True)
    (OUTPUT / "labels" / split).mkdir(parents=True, exist_ok=True)

# --------------------------------------------------
# COPY EXISTING RDD2022 DATASET
# --------------------------------------------------

print("Copying existing RDD2022 dataset...")

for split in ["train", "val"]:
    source_images = SOURCE_RDD / "images" / split
    source_labels = SOURCE_RDD / "labels" / split

    output_images = OUTPUT / "images" / split
    output_labels = OUTPUT / "labels" / split

    image_count = 0
    label_count = 0

    for image in source_images.iterdir():
        if image.is_file():
            shutil.copy2(image, output_images / image.name)
            image_count += 1

    for label in source_labels.iterdir():
        if label.is_file():
            shutil.copy2(label, output_labels / label.name)
            label_count += 1

    print(
        f"  {split}: {image_count} images, "
        f"{label_count} labels"
    )

# --------------------------------------------------
# FIND POTHOLE IMAGES
# --------------------------------------------------

print("\nSearching pothole dataset...")

image_files = list(SOURCE_POTHOLE.rglob("*.png"))

print(f"Found {len(image_files)} PNG images")

if len(image_files) == 0:
    raise RuntimeError(
        "No PNG images found in pothole-detection folder."
    )

# --------------------------------------------------
# SPLIT POTHOLE DATASET 80/20
# --------------------------------------------------

random.shuffle(image_files)

split_index = int(len(image_files) * 0.8)

pothole_train = image_files[:split_index]
pothole_val = image_files[split_index:]

print(f"Pothole train: {len(pothole_train)}")
print(f"Pothole val:   {len(pothole_val)}")

# --------------------------------------------------
# CONVERT JSON → YOLO
# --------------------------------------------------

def find_json_for_image(image_path):
    """
    Find the JSON annotation corresponding to an image.
    Dataset annotations use the filename:
    image.png.json
    """

    # Most likely: potholes10.png.json
    same_folder = image_path.parent / (image_path.name + ".json")

    if same_folder.exists():
        return same_folder

    # Fallback: search recursively
    matches = list(
        SOURCE_POTHOLE.rglob(image_path.name + ".json")
    )

    if matches:
        return matches[0]

    return None


def convert_pothole(image_path, split, index):
    json_path = find_json_for_image(image_path)

    if json_path is None:
        raise RuntimeError(
            f"No JSON annotation found for:\n{image_path}"
        )

    with open(json_path, "r", encoding="utf-8") as f:
        annotation = json.load(f)

    # Get image dimensions from annotation
    width = annotation["size"]["width"]
    height = annotation["size"]["height"]

    objects = annotation.get("objects", [])

    # Unique filename to avoid collisions
    new_name = f"pothole_{index:04d}"

    output_image = (
        OUTPUT / "images" / split / f"{new_name}.png"
    )

    output_label = (
        OUTPUT / "labels" / split / f"{new_name}.txt"
    )

    # Copy image
    shutil.copy2(image_path, output_image)

    yolo_lines = []

    for obj in objects:

        # Only pothole objects
        if obj.get("classTitle", "").lower() != "pothole":
            continue

        points = obj["points"]["exterior"]

        if len(points) < 2:
            continue

        x1, y1 = points[0]
        x2, y2 = points[1]

        # Normalize bounding box
        x_center = ((x1 + x2) / 2) / width
        y_center = ((y1 + y2) / 2) / height

        box_width = abs(x2 - x1) / width
        box_height = abs(y2 - y1) / height

        # Pothole = class 4
        yolo_lines.append(
            f"4 {x_center:.6f} {y_center:.6f} "
            f"{box_width:.6f} {box_height:.6f}"
        )

    # Every pothole image should have at least one annotation
    if not yolo_lines:
        raise RuntimeError(
            f"No pothole annotation found in:\n{json_path}"
        )

    with open(output_label, "w", encoding="utf-8") as f:
        f.write("\n".join(yolo_lines))


# --------------------------------------------------
# PROCESS POTHOLES
# --------------------------------------------------

print("\nConverting pothole annotations...")

for i, image in enumerate(pothole_train):
    convert_pothole(image, "train", i)

for i, image in enumerate(pothole_val):
    convert_pothole(image, "val", i)

print("Pothole conversion complete.")

# --------------------------------------------------
# CREATE DATA.YAML
# --------------------------------------------------

yaml_content = """path: /content/roadvision_v4_dataset
train: images/train
val: images/val

names:
  0: longitudinal crack
  1: transverse crack
  2: alligator crack
  3: other corruption
  4: pothole
"""

with open(OUTPUT / "data.yaml", "w", encoding="utf-8") as f:
    f.write(yaml_content)

# --------------------------------------------------
# FINAL SUMMARY
# --------------------------------------------------

train_images = list(
    (OUTPUT / "images" / "train").glob("*")
)

val_images = list(
    (OUTPUT / "images" / "val").glob("*")
)

train_labels = list(
    (OUTPUT / "labels" / "train").glob("*.txt")
)

val_labels = list(
    (OUTPUT / "labels" / "val").glob("*.txt")
)

print("\n========================================")
print("V4 DATASET CREATED")
print("========================================")

print(f"Train images : {len(train_images)}")
print(f"Train labels : {len(train_labels)}")
print(f"Val images   : {len(val_images)}")
print(f"Val labels   : {len(val_labels)}")

print("\nClasses:")
print("0 - longitudinal crack")
print("1 - transverse crack")
print("2 - alligator crack")
print("3 - other corruption")
print("4 - pothole")

print(f"\nOutput:")
print(OUTPUT)

print("\nDone.")