from pathlib import Path

base = Path("data/processed/rdd2022_yolo")
images = base / "images/train"
labels = base / "labels/train"

removed = 0

for label in list(labels.glob("*.txt")):
    if not label.read_text(encoding="utf-8").strip():
        image = images / f"{label.stem}.jpg"

        if image.exists():
            image.unlink()

        label.unlink()
        removed += 1

print("Empty training pairs removed:", removed)