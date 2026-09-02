from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
DATASET = PROJECT_ROOT / "data" / "processed" / "roadvision_v4_dataset"

VALID_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

total_errors = 0


def check_split(split):
    global total_errors

    images_dir = DATASET / "images" / split
    labels_dir = DATASET / "labels" / split

    images = [
        p for p in images_dir.iterdir()
        if p.is_file() and p.suffix.lower() in VALID_EXTENSIONS
    ]

    labels = list(labels_dir.glob("*.txt"))

    image_stems = {p.stem for p in images}
    label_stems = {p.stem for p in labels}

    missing_labels = image_stems - label_stems
    orphan_labels = label_stems - image_stems

    print(f"\n--- {split.upper()} ---")
    print(f"Images : {len(images)}")
    print(f"Labels : {len(labels)}")

    if missing_labels:
        print(f"ERROR: {len(missing_labels)} images have no label")
        total_errors += len(missing_labels)

    if orphan_labels:
        print(f"ERROR: {len(orphan_labels)} labels have no image")
        total_errors += len(orphan_labels)

    # Check every label
    invalid_lines = 0
    empty_labels = 0
    class_counts = {}

    for label in labels:
        text = label.read_text(encoding="utf-8").strip()

        if not text:
            empty_labels += 1
            continue

        for line_number, line in enumerate(text.splitlines(), 1):
            parts = line.split()

            if len(parts) != 5:
                print(
                    f"ERROR: {label.name}, line {line_number}: "
                    f"expected 5 values"
                )
                invalid_lines += 1
                continue

            try:
                class_id = int(parts[0])
                values = [float(x) for x in parts[1:]]
            except ValueError:
                invalid_lines += 1
                continue

            if class_id not in range(5):
                print(
                    f"ERROR: {label.name}, line {line_number}: "
                    f"invalid class {class_id}"
                )
                invalid_lines += 1
                continue

            if not all(0 <= value <= 1 for value in values):
                print(
                    f"ERROR: {label.name}, line {line_number}: "
                    f"coordinate outside 0-1"
                )
                invalid_lines += 1
                continue

            class_counts[class_id] = class_counts.get(class_id, 0) + 1

    total_errors += invalid_lines

    print(f"Empty labels     : {empty_labels}")
    print(f"Invalid label lines: {invalid_lines}")

    print("Class distribution:")
    names = {
        0: "longitudinal crack",
        1: "transverse crack",
        2: "alligator crack",
        3: "other corruption",
        4: "pothole",
    }

    for class_id in range(5):
        print(
            f"  {class_id} - {names[class_id]}: "
            f"{class_counts.get(class_id, 0)}"
        )


print("========================================")
print("ROADVISION V4 DATASET INTEGRITY CHECK")
print("========================================")

if not DATASET.exists():
    raise RuntimeError(f"Dataset not found: {DATASET}")

check_split("train")
check_split("val")

print("\n========================================")

if total_errors == 0:
    print("✅ DATASET CHECK PASSED")
    print("No missing labels, orphan labels, or invalid YOLO labels.")
else:
    print(f"❌ DATASET CHECK FAILED")
    print(f"Total errors: {total_errors}")

print("========================================")