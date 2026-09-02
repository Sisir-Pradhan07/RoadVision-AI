from pathlib import Path
import zipfile

PROJECT_ROOT = Path(__file__).resolve().parent

DATASET = PROJECT_ROOT / "data" / "processed" / "roadvision_v4_dataset"
OUTPUT_ZIP = PROJECT_ROOT / "data" / "processed" / "roadvision_v4_dataset.zip"

print("Creating V4 dataset ZIP...")
print(f"Source: {DATASET}")
print(f"Output: {OUTPUT_ZIP}")

file_count = 0

with zipfile.ZipFile(
    OUTPUT_ZIP,
    "w",
    compression=zipfile.ZIP_DEFLATED,
    compresslevel=6,
) as zip_file:

    for file in DATASET.rglob("*"):
        if file.is_file():
            # Always use Linux-style paths inside ZIP
            archive_path = file.relative_to(DATASET).as_posix()

            zip_file.write(
                file,
                arcname=f"roadvision_v4_dataset/{archive_path}",
            )

            file_count += 1

print("\n========================================")
print("V4 ZIP CREATED")
print("========================================")
print(f"Files added : {file_count}")
print(f"ZIP path    : {OUTPUT_ZIP}")
print(f"ZIP size    : {OUTPUT_ZIP.stat().st_size / (1024 * 1024):.2f} MB")
print("========================================")